import { db, json, mercado, plans, verifyUser } from './_shared.mjs';

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
    const externalReference = `quadrei:${user.uid}:${societyId}:${plan}`;
    const subscription = await mercado('/preapproval', { method: 'POST', body: JSON.stringify({
      preapproval_plan_id: selected.id,
      reason: selected.label,
      external_reference: externalReference,
      payer_email: user.email || undefined,
      back_url: `${process.env.QUADREI_BILLING_APP_URL}/assinatura/retorno`,
    }) });
    await db().doc(`users/${user.uid}/billing/${societyId}`).set({ plan, status: 'pending', externalReference, subscriptionId: subscription.id, updatedAt: new Date() }, { merge: true });
    return json(res, 200, { id: subscription.id, checkoutUrl: subscription.init_point || subscription.sandbox_init_point });
  } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.' }); }
}
