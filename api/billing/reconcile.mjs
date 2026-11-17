import { db, json, mercado, plans, verifyUser } from './_shared.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const user = await verifyUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const societyId = typeof body.societyId === 'string' ? body.societyId : '';
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    if (!societyId || !/^[A-Za-z0-9_-]{6,100}$/.test(subscriptionId)) return json(res, 400, { error: 'Informe o ID da assinatura e a sociedade.' });

    const store = db();
    const society = await store.doc(`societies/${societyId}`).get();
    if (!society.exists || society.data()?.ownerId !== user.uid) return json(res, 403, { error: 'Sociedade indisponível.' });

    const billingRef = store.doc(`users/${user.uid}/billing/${societyId}`);
    const billing = await billingRef.get();
    const intentId = billing.data()?.checkoutIntentId;
    if (!intentId) return json(res, 404, { error: 'Não há uma tentativa de assinatura pendente para esta sociedade.' });
    const intentRef = store.doc(`billingCheckoutIntents/${intentId}`);
    const intentSnapshot = await intentRef.get();
    if (!intentSnapshot.exists) return json(res, 404, { error: 'A tentativa de assinatura não foi encontrada.' });
    const intent = intentSnapshot.data();
    if (intent.uid !== user.uid || intent.societyId !== societyId || (intent.status !== 'pending' && !(intent.status === 'completed' && intent.subscriptionId === subscriptionId))) return json(res, 409, { error: 'A tentativa não está mais pendente para esta sociedade.' });

    const subscription = await mercado(`/preapproval/${encodeURIComponent(subscriptionId)}`);
    if (String(subscription.id) !== subscriptionId || subscription.preapproval_plan_id !== intent.planId) return json(res, 400, { error: 'Essa assinatura não corresponde ao plano selecionado.' });
    const payerEmail = String(subscription.payer_email || '').trim().toLowerCase();
    if (!user.email || payerEmail !== user.email.toLowerCase() || payerEmail !== intent.payerEmail) return json(res, 403, { error: 'O e-mail pagador da assinatura não corresponde à conta Quadrei.' });

    if (subscription.status !== 'authorized') return json(res, 409, { error: `O Mercado Pago informa status "${subscription.status || 'desconhecido'}". O plano será liberado quando a assinatura estiver autorizada.` });
    const plan = Object.entries(plans).find(([, item]) => item.id === subscription.preapproval_plan_id)?.[0];
    if (!plan || plan !== intent.plan) return json(res, 400, { error: 'O plano retornado pelo Mercado Pago não corresponde à tentativa.' });

    await store.runTransaction(async transaction => {
      const [currentBilling, currentIntent] = await Promise.all([transaction.get(billingRef), transaction.get(intentRef)]);
      if (currentBilling.data()?.checkoutIntentId !== intentId || (currentIntent.data()?.status !== 'pending' && !(currentIntent.data()?.status === 'completed' && currentIntent.data()?.subscriptionId === subscriptionId))) throw new Error('A tentativa de assinatura foi alterada. Atualize a página e tente novamente.');
      transaction.set(billingRef, { plan, status: 'authorized', subscriptionId, payerEmail, updatedAt: new Date() }, { merge: true });
      transaction.update(intentRef, { status: 'completed', subscriptionId, completedAt: new Date() });
    });
    return json(res, 200, { synchronized: true, plan, status: 'authorized' });
  } catch (error) {
    console.error('Falha ao reconciliar assinatura do Mercado Pago:', error);
    return json(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível verificar a assinatura.' });
  }
}
