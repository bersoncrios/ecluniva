import admin from 'firebase-admin';
import { db, json, verifyUser } from './billing/_shared.mjs';

const MAX_MESSAGE = 4000;

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Método não permitido.' });
  try {
    const user = await verifyUser(req);
    const store = db();
    const ref = store.collection('supportThreads').doc(user.uid);
    if (req.method === 'GET') {
      const snapshot = await ref.get();
      const thread = snapshot.exists ? snapshot.data() : null;
      return json(res, 200, { messages: thread?.messages || [], status: thread?.status || 'open' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > MAX_MESSAGE) return json(res, 400, { error: `A mensagem deve ter de 1 a ${MAX_MESSAGE} caracteres.` });
    const account = await admin.auth().getUser(user.uid);
    const item = { id: store.collection('_ids').doc().id, senderId: user.uid, senderName: account.displayName || account.email || 'Usuário', senderRole: 'user', text: message, createdAt: new Date().toISOString() };
    await store.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.exists ? snapshot.data() : {};
      transaction.set(ref, { userId: user.uid, userEmail: account.email || '', userName: account.displayName || '', status: 'open', messages: [...(previous.messages || []), item].slice(-200), createdAt: previous.createdAt || new Date(), updatedAt: new Date(), unreadByAdmin: true }, { merge: false });
      if (!snapshot.exists) transaction.set(store.collection('adminAuditEvents').doc(), { type: 'support_opened', actorId: user.uid, target: user.email || '', summary: 'Novo atendimento recebido', createdAt: new Date() });
    });
    return json(res, 201, { message: item });
  } catch (error) {
    console.error('Falha no atendimento:', error);
    return json(res, 401, { error: 'Não foi possível acessar o atendimento.' });
  }
}
