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
    if (intent.uid !== user.uid || intent.societyId !== societyId || !['pending', 'completed'].includes(intent.status)) return json(res, 409, { error: 'A tentativa não está mais pendente para esta sociedade.' });

    let subscription, invoice = null, inputWasTransaction = false;
    try {
      subscription = await mercado(`/preapproval/${encodeURIComponent(subscriptionId)}`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Mercado Pago 404:')) throw error;
      inputWasTransaction = true;
      try {
        invoice = await mercado(`/authorized_payments/${encodeURIComponent(subscriptionId)}`);
      } catch (invoiceError) {
        if (!(invoiceError instanceof Error) || !invoiceError.message.startsWith('Mercado Pago 404:')) throw invoiceError;
        const results = await mercado(`/authorized_payments/search?payment_id=${encodeURIComponent(subscriptionId)}`);
        invoice = (results.results || []).find(item => String(item.payment?.id) === subscriptionId);
        if (!invoice) return json(res, 404, { error: 'O número informado não corresponde a uma assinatura ou fatura de assinatura encontrada nesta conta Mercado Pago.' });
      }
      if (!invoice.preapproval_id) return json(res, 404, { error: 'Esse ID é de uma cobrança sem assinatura vinculada. Informe o ID da assinatura (preapproval_id).' });
      subscription = await mercado(`/preapproval/${encodeURIComponent(String(invoice.preapproval_id))}`);
    }
    const resolvedSubscriptionId = String(subscription.id || '');
    if (!resolvedSubscriptionId || subscription.preapproval_plan_id !== intent.planId) return json(res, 400, { error: `A assinatura encontrada está vinculada a outro plano. Confira o ID do plano ${intent.plan} configurado na Vercel.` });
    if (intent.status === 'completed' && intent.subscriptionId !== resolvedSubscriptionId) return json(res, 409, { error: 'A tentativa já foi concluída com outra assinatura.' });
    const payerEmail = String(subscription.payer_email || '').trim().toLowerCase();
    if (subscription.status !== 'authorized') return json(res, 409, { error: `O Mercado Pago informa status "${subscription.status || 'desconhecido'}". O plano será liberado quando a assinatura estiver autorizada.` });
    const plan = Object.entries(plans).find(([, item]) => item.id === subscription.preapproval_plan_id)?.[0];
    if (!plan || plan !== intent.plan) return json(res, 400, { error: 'O plano retornado pelo Mercado Pago não corresponde à tentativa.' });
    const expectedAmount = plans[plan].price;
    if (Math.round(Number(subscription.auto_recurring?.transaction_amount) * 100) !== Math.round(expectedAmount * 100)) return json(res, 400, { error: 'O valor recorrente da assinatura não corresponde ao preço deste plano.' });
    if (inputWasTransaction && (invoice?.payment?.status !== 'approved' || Math.round(Number(invoice.transaction_amount) * 100) !== Math.round(expectedAmount * 100))) return json(res, 409, { error: 'A transação não aparece como aprovada pelo valor esperado para este plano.' });

    await store.runTransaction(async transaction => {
      const [currentBilling, currentIntent] = await Promise.all([transaction.get(billingRef), transaction.get(intentRef)]);
      if (currentBilling.data()?.checkoutIntentId !== intentId || (currentIntent.data()?.status !== 'pending' && !(currentIntent.data()?.status === 'completed' && currentIntent.data()?.subscriptionId === resolvedSubscriptionId))) throw new Error('A tentativa de assinatura foi alterada. Atualize a página e tente novamente.');
      transaction.set(billingRef, { plan, status: 'authorized', subscriptionId: resolvedSubscriptionId, payerEmail, updatedAt: new Date() }, { merge: true });
      transaction.update(intentRef, { status: 'completed', subscriptionId: resolvedSubscriptionId, completedAt: new Date() });
    });
    return json(res, 200, { synchronized: true, plan, status: 'authorized' });
  } catch (error) {
    console.error('Falha ao reconciliar assinatura do Mercado Pago:', error);
    return json(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível verificar a assinatura.' });
  }
}
