import admin from 'firebase-admin';
import { db, json, mercado, plans, validWebhook } from './_shared.mjs';

async function saveBillingState(store, billingRef, next) {
  const previousSnapshot = await billingRef.get();
  const previous = previousSnapshot.data() || {};
  await billingRef.set(next, { merge: true });
  if (previous.status !== next.status || previous.plan !== next.plan) {
    await store.collection('adminAuditEvents').add({ type: 'subscription_status_changed', actorId: 'mercadopago', target: billingRef.path, summary: `Assinatura ${previous.status || 'nova'} → ${next.status} (${next.plan})`, createdAt: new Date() });
  }
}

function subscriptionDates(subscription) {
  return {
    nextPaymentAt: subscription.next_payment_date || subscription.auto_recurring?.next_payment_date || null,
    expiresAt: subscription.date_end || subscription.auto_recurring?.end_date || null,
  };
}

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
        const dates = subscriptionDates(subscription);
        const store = db();
        const known = await store.collection('billingCheckoutIntents').where('subscriptionId', '==', subscription.id).limit(1).get();
        if (!known.empty) {
          const intent = known.docs[0], data = intent.data();
          const account = await admin.auth().getUser(data.uid);
          if (account.email?.toLowerCase() === email) {
            await saveBillingState(store, store.doc(`users/${data.uid}/billing/${data.societyId}`), { plan, status: subscription.status, subscriptionId: subscription.id, payerEmail: email, ...dates, updatedAt: new Date() });
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
            await saveBillingState(store, billingRef, { plan, status: subscription.status, subscriptionId: subscription.id, payerEmail: email, ...dates, updatedAt: new Date() });
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
