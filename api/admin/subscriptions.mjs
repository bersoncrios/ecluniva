import { db, json, verifyUser } from '../billing/_shared.mjs';

const labels = { free: 'Grátis', essential: 'Essencial', professional: 'Profissional', institutional: 'Institucional' };

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const token = await verifyUser(req);
    const store = db();
    const profile = await store.doc(`users/${token.uid}`).get();
    if (!profile.exists || profile.data()?.role !== 'admin') return json(res, 403, { error: 'Acesso restrito à administração.' });

    const snapshots = await store.collectionGroup('billing').get();
    const societies = await store.collection('societies').get();
    const societyById = new Map(societies.docs.map(doc => [doc.id, doc.data()]));
    const rows = snapshots.docs.map(doc => {
      const billing = doc.data();
      const societyId = doc.id;
      const userId = doc.ref.parent.parent?.id || '';
      const society = societyById.get(societyId);
      return {
        id: doc.ref.path,
        societyId,
        societyName: society ? `${society.type} · ${society.name}` : 'Sociedade não encontrada',
        churchName: society?.churchName || '',
        ownerId: userId,
        plan: labels[billing.plan] ? billing.plan : 'free',
        planName: labels[billing.plan] || labels.free,
        status: String(billing.status || 'unknown'),
        subscriptionId: String(billing.subscriptionId || ''),
        updatedAt: billing.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    }).filter(row => row.status !== 'unknown').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return json(res, 200, { subscriptions: rows });
  } catch (error) {
    console.error('Falha ao carregar painel administrativo:', error);
    return json(res, 401, { error: 'Não foi possível carregar os dados administrativos.' });
  }
}
