import admin from 'firebase-admin';
import { db, json, verifyUser } from '../billing/_shared.mjs';

const planPrices = { essential: 9.90, professional: 29.90, institutional: 79.90 };
const planNames = { free: 'Grátis', essential: 'Essencial', professional: 'Profissional', institutional: 'Institucional' };

async function requireAdmin(req) {
  const token = await verifyUser(req);
  const profile = await db().doc(`users/${token.uid}`).get();
  if (!profile.exists || profile.data()?.role !== 'admin') throw new Error('Acesso restrito à administração.');
  return token;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Método não permitido.' });
  try {
    const token = await requireAdmin(req);
    const store = db();
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const threadId = typeof body.threadId === 'string' ? body.threadId : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(threadId)) return json(res, 400, { error: 'Atendimento inválido.' });
      const [profile, account] = await Promise.all([store.doc(`users/${token.uid}`).get(), admin.auth().getUser(token.uid)]);
      if (profile.data()?.role !== 'admin') return json(res, 403, { error: 'Acesso restrito à administração.' });
      const threadRef = store.doc(`supportThreads/${threadId}`);
      const eventRef = store.collection('adminAuditEvents').doc();
      if (body.action === 'markRead') {
        await store.runTransaction(async transaction => {
          const thread = await transaction.get(threadRef);
          if (!thread.exists) throw new Error('Atendimento não encontrado.');
          transaction.update(threadRef, { unreadByAdmin: false, updatedAt: new Date() });
          transaction.set(eventRef, { type: 'support_read', actorId: token.uid, threadId, summary: 'Atendimento consultado pela administração', createdAt: new Date() });
        });
        return json(res, 200, { ok: true });
      }
      if (!message || message.length > 4000) return json(res, 400, { error: 'Escreva uma resposta de até 4.000 caracteres.' });
      const item = { id: store.collection('_ids').doc().id, senderId: token.uid, senderName: account.displayName || account.email || 'Administração', senderRole: 'admin', text: message, createdAt: new Date().toISOString() };
      await store.runTransaction(async transaction => {
        const thread = await transaction.get(threadRef);
        if (!thread.exists) throw new Error('Atendimento não encontrado.');
        transaction.update(threadRef, { messages: [...(thread.data().messages || []), item].slice(-200), status: 'open', unreadByAdmin: false, updatedAt: new Date(), lastAdminReplyAt: new Date() });
        transaction.set(eventRef, { type: 'support_reply', actorId: token.uid, threadId, summary: 'Resposta enviada ao usuário', createdAt: new Date() });
      });
      return json(res, 201, { message: item });
    }

    const [billingSnapshots, societySnapshots, threadsSnapshot, auditsSnapshot] = await Promise.all([
      store.collectionGroup('billing').get(), store.collection('societies').get(), store.collection('supportThreads').get(),
      store.collection('adminAuditEvents').orderBy('createdAt', 'desc').limit(50).get(),
    ]);
    const societyById = new Map(societySnapshots.docs.map(item => [item.id, item.data()]));
    const uidSet = new Set(billingSnapshots.docs.map(item => item.ref.parent.parent?.id).filter(Boolean));
    const authUsers = await Promise.all([...uidSet].map(async uid => { try { return [uid, await admin.auth().getUser(uid)]; } catch { return [uid, null]; } }));
    const userById = new Map(authUsers);
    const subscriptions = billingSnapshots.docs.map(doc => {
      const billing = doc.data(), societyId = doc.id, ownerId = doc.ref.parent.parent?.id || '', society = societyById.get(societyId), plan = billing.plan || 'free';
      return { id: doc.ref.path, societyId, societyName: society ? `${society.type} · ${society.name}` : 'Sociedade não encontrada', churchName: society?.churchName || '', ownerId, ownerEmail: userById.get(ownerId)?.email || '', plan, planName: planNames[plan] || planNames.free, status: String(billing.status || 'unknown'), subscriptionId: String(billing.subscriptionId || ''), updatedAt: billing.updatedAt?.toDate?.()?.toISOString?.() || null };
    }).filter(row => row.status !== 'unknown').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const active = subscriptions.filter(item => item.status === 'authorized');
    const mrr = active.reduce((sum, item) => sum + (planPrices[item.plan] || 0), 0);
    const attention = subscriptions.filter(item => ['pending', 'paused', 'cancelled', 'cancelled_by_user', 'rejected'].includes(item.status));
    const threads = threadsSnapshot.docs.map(doc => ({ id: doc.id, userName: doc.data().userName || '', userEmail: doc.data().userEmail || '', status: doc.data().status || 'open', updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || null, unreadByAdmin: doc.data().unreadByAdmin === true, messages: doc.data().messages || [] })).sort((a, b) => Number(b.unreadByAdmin) - Number(a.unreadByAdmin) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const audits = auditsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null }));
    return json(res, 200, { stats: { societies: societySnapshots.size, subscriptions: subscriptions.length, active: active.length, pending: subscriptions.filter(item => item.status === 'pending').length, mrrEstimate: mrr }, subscriptions, attention, threads, audits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível abrir o painel administrativo.';
    return json(res, message.includes('restrito') ? 403 : 401, { error: message });
  }
}
