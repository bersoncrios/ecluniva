import { db, json, plans, verifyUser } from './_shared.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const user = await verifyUser(req);
    const { plan, societyId } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const selected = plans[plan];
    if (!selected?.id || !['essential', 'professional', 'institutional'].includes(plan)) return json(res, 400, { error: 'Plano inválido ou não configurado.' });
    if (typeof societyId !== 'string' || !societyId) return json(res, 400, { error: 'Sociedade inválida.' });
    const society = await db().doc(`societies/${societyId}`).get();
    if (!society.exists || society.data()?.ownerId !== user.uid) return json(res, 403, { error: 'Sociedade indisponível.' });
    if (!user.email) return json(res, 400, { error: 'A conta precisa ter um e-mail para iniciar a assinatura.' });
    const store = db();
    const intent = store.collection('billingCheckoutIntents').doc();
    await intent.set({ uid: user.uid, societyId, payerEmail: user.email.toLowerCase(), plan, planId: selected.id, status: 'pending', createdAt: new Date() });
    await store.doc(`users/${user.uid}/billing/${societyId}`).set({ plan, status: 'pending', checkoutIntentId: intent.id, updatedAt: new Date() }, { merge: true });
    const checkoutUrl = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${encodeURIComponent(selected.id)}`;
    return json(res, 200, { checkoutUrl });
  } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.' }); }
}
