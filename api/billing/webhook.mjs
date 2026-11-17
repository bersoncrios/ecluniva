import { db, json, mercado, validWebhook } from './_shared.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  if (!validWebhook(req)) return json(res, 401, { error: 'Assinatura inválida.' });
  try {
    const type = req.body?.type || req.query?.type;
    const id = req.body?.data?.id || req.query?.['data.id'] || req.query?.data_id;
    if (!id) return json(res, 200, { received: true });
    if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
      const invoice = type === 'subscription_authorized_payment' ? await mercado(`/authorized_payments/${id}`) : null;
      const subscription = type === 'subscription_authorized_payment' && invoice?.preapproval_id
        ? await mercado(`/preapproval/${invoice.preapproval_id}`)
        : await mercado(`/preapproval/${id}`);
      const reference = String(subscription.external_reference || '');
      const match = reference.match(/^quadrei:([^:]+):([^:]+):([^:]+)$/);
      if (match) {
        const [, uid, societyId, plan] = match;
        await db().doc(`users/${uid}/billing/${societyId}`).set({ plan, status: subscription.status, subscriptionId: subscription.id, payerEmail: subscription.payer_email || '', updatedAt: new Date() }, { merge: true });
      }
    }
    return json(res, 200, { received: true });
  } catch { return json(res, 200, { received: true }); }
}
