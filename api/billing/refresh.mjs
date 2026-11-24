import { db, json, mercado, verifyUser } from './_shared.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const user = await verifyUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const societyId = typeof body.societyId === 'string' ? body.societyId : '';
    if (!societyId) return json(res, 400, { error: 'Sociedade inválida.' });
    const store = db();
    const society = await store.doc(`societies/${societyId}`).get();
    if (!society.exists || society.data()?.ownerId !== user.uid) return json(res, 403, { error: 'Sociedade indisponível.' });
    const billingRef = store.doc(`users/${user.uid}/billing/${societyId}`), billing = await billingRef.get(), current = billing.data() || {};
    let subscriptionId = current.subscriptionId;
    if (!subscriptionId && current.checkoutIntentId) {
      const intent = await store.doc(`billingCheckoutIntents/${current.checkoutIntentId}`).get();
      const intentData = intent.data() || {};
      if (intentData.planId && intentData.payerEmail) {
        const query = new URLSearchParams({ preapproval_plan_id: String(intentData.planId), payer_email: String(intentData.payerEmail) });
        const search = await mercado(`/preapproval/search?${query}`);
        const candidate = (search.results || []).filter(item => ['authorized', 'pending'].includes(String(item.status || ''))).sort((a, b) => String(b.date_created || '').localeCompare(String(a.date_created || '')))[0];
        subscriptionId = candidate?.id || '';
      }
    }
    if (!subscriptionId) return json(res, 200, { refreshed: false, nextPaymentAt: null, expiresAt: null });
    const subscription = await mercado(`/preapproval/${encodeURIComponent(String(subscriptionId))}`);
    const nextPaymentAt = subscription.next_payment_date || subscription.auto_recurring?.next_payment_date || null;
    const expiresAt = subscription.date_end || subscription.auto_recurring?.end_date || null;
    await billingRef.set({ status: subscription.status || current.status, subscriptionId: String(subscription.id || subscriptionId), payerEmail: subscription.payer_email || current.payerEmail || null, nextPaymentAt, expiresAt, updatedAt: new Date() }, { merge: true });
    return json(res, 200, { refreshed: true, subscriptionId: String(subscription.id || subscriptionId), status: subscription.status || current.status, nextPaymentAt, expiresAt });
  } catch (error) {
    console.error('Falha ao atualizar validade da assinatura:', error);
    return json(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível atualizar a validade.' });
  }
}
