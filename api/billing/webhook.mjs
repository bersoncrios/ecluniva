import admin from 'firebase-admin';
import { db, json, mercado, plans, validWebhook } from './_shared.mjs';

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
      const plan = Object.entries(plans).find(([, item]) => item.id && item.id === subscription.preapproval_plan_id)?.[0];
      const email = String(subscription.payer_email || '').trim().toLowerCase();
      if (plan && email) {
        const store = db();
        const known = await store.collection('billingCheckoutIntents').where('subscriptionId', '==', subscription.id).limit(1).get();
        if (!known.empty) {
          const intent = known.docs[0], data = intent.data();
          const account = await admin.auth().getUser(data.uid);
          if (account.email?.toLowerCase() === email) {
            await store.doc(`users/${data.uid}/billing/${data.societyId}`).set({ plan, status: subscription.status, subscriptionId: subscription.id, payerEmail: email, updatedAt: new Date() }, { merge: true });
          }
        } else {
        const intents = await store.collection('billingCheckoutIntents').where('payerEmail', '==', email).get();
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const candidates = intents.docs.filter(item => item.data().planId === subscription.preapproval_plan_id && item.data().status === 'pending' && item.data().createdAt?.toDate?.().getTime() >= cutoff);
        const current = await Promise.all(candidates.map(async intent => {
          const data = intent.data();
          const billingRef = store.doc(`users/${data.uid}/billing/${data.societyId}`);
          const billing = await billingRef.get();
          return billing.data()?.checkoutIntentId === intent.id ? { intent, data, billingRef } : null;
        }));
        const matches = current.filter(Boolean);
        if (matches.length === 1) {
          const { intent, data, billingRef } = matches[0];
          const society = await store.doc(`societies/${data.societyId}`).get();
          const account = await admin.auth().getUser(data.uid);
          if (society.exists && society.data()?.ownerId === data.uid && account.email?.toLowerCase() === email) {
            await billingRef.set({ plan, status: subscription.status, subscriptionId: subscription.id, payerEmail: email, updatedAt: new Date() }, { merge: true });
            await intent.ref.update({ status: 'completed', subscriptionId: subscription.id, completedAt: new Date() });
          }
        }
        }
      }
    }
    return json(res, 200, { received: true });
  } catch (error) {
    console.error('Falha ao processar webhook do Mercado Pago:', error);
    return json(res, 500, { error: 'Falha ao processar a notificação.' });
  }
}
