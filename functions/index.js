import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

if (!getApps().length) initializeApp();
const db = getFirestore();
const mpToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');
const mpWebhookSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
const appUrl = defineString('QUADREI_BILLING_APP_URL', { default: 'https://ecluniva.vercel.app' });
const prices = { essential: 9.90, professional: 29.90, institutional: 79.90 };

function send(res, status, body) { res.status(status).set('Content-Type', 'application/json').send(body); }
async function mercado(path, options = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, { ...options, headers: { Authorization: `Bearer ${mpToken.value()}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}`);
  return body;
}
function validSignature(req) {
  const signature = String(req.get('x-signature') || ''), requestId = String(req.get('x-request-id') || ''), id = String(req.query['data.id'] || req.query.data_id || req.body?.data?.id || '');
  const values = Object.fromEntries(signature.split(',').map(item=>item.split('=').map(value=>value.trim())).filter(item=>item.length===2));
  if (!values.v1 || !values.ts || !requestId || !id) return false;
  const expected = crypto.createHmac('sha256', mpWebhookSecret.value()).update(`id:${id};request-id:${requestId};ts:${values.ts};`).digest('hex');
  return expected.length === values.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(values.v1));
}

export const billingCheckout = onRequest({ secrets: [mpToken], cors: true }, async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return send(res, 401, { error: 'Sessão ausente.' });
    const user = await getAuth().verifyIdToken(header.slice(7));
    const { plan, societyId } = req.body || {};
    if (!(plan in prices) || typeof societyId !== 'string' || !societyId) return send(res, 400, { error: 'Plano ou sociedade inválidos.' });
    const society = await db.doc(`societies/${societyId}`).get();
    if (!society.exists || society.data()?.ownerId !== user.uid) return send(res, 403, { error: 'Sociedade indisponível.' });
    const subscription = await mercado('/preapproval', { method: 'POST', body: JSON.stringify({ reason: `Quadrei ${plan}`, external_reference: `quadrei:${user.uid}:${societyId}:${plan}`, payer_email: user.email || undefined, back_url: `${appUrl.value()}/assinatura/retorno`, auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: prices[plan], currency_id: 'BRL' } }) });
    await db.doc(`users/${user.uid}/billing/${societyId}`).set({ plan, status: 'pending', subscriptionId: subscription.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return send(res, 200, { checkoutUrl: subscription.init_point || subscription.sandbox_init_point, id: subscription.id });
  } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.' }); }
});

export const mercadoPagoWebhook = onRequest({ secrets: [mpToken, mpWebhookSecret], cors: false }, async (req, res) => {
  if (req.method !== 'POST' || !validSignature(req)) return send(res, 401, { error: 'Notificação inválida.' });
  try {
    const type = req.body?.type || req.query.type, id = req.body?.data?.id || req.query['data.id'] || req.query.data_id;
    if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
      const invoice = type === 'subscription_authorized_payment' ? await mercado(`/authorized_payments/${id}`) : null;
      const subscription = invoice?.preapproval_id ? await mercado(`/preapproval/${invoice.preapproval_id}`) : await mercado(`/preapproval/${id}`);
      const match = String(subscription.external_reference || '').match(/^quadrei:([^:]+):([^:]+):([^:]+)$/);
      if (match) { const [, uid, societyId, plan] = match; await db.doc(`users/${uid}/billing/${societyId}`).set({ plan, status: subscription.status, subscriptionId: subscription.id, nextPaymentAt: subscription.next_payment_date || null, expiresAt: subscription.date_end || subscription.auto_recurring?.end_date || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); }
    }
    return send(res, 200, { received: true });
  } catch { return send(res, 200, { received: true }); }
});
