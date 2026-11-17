import crypto from 'node:crypto';
import admin from 'firebase-admin';

export const plans = {
  essential: { id: process.env.MERCADOPAGO_PLAN_ESSENTIAL_ID, price: 9.90, label: 'Quadrei Essencial' },
  professional: { id: process.env.MERCADOPAGO_PLAN_PROFESSIONAL_ID, price: 29.90, label: 'Quadrei Profissional' },
  institutional: { id: process.env.MERCADOPAGO_PLAN_INSTITUTIONAL_ID, price: 79.90, label: 'Quadrei Institucional' },
};

export function init() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
}

export function db() {
  init();
  return admin.firestore();
}

export async function verifyUser(req) {
  init();
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new Error('Sessão ausente.');
  return admin.auth().verifyIdToken(header.slice(7));
}

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export function validWebhook(req) {
  const signature = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const dataId = String(req.query?.['data.id'] || req.query?.data_id || req.body?.data?.id || '');
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
  const values = Object.fromEntries(signature.split(',').map(item => item.split('=').map(value => value.trim())).filter(item => item.length === 2));
  if (!secret || !values.v1 || !values.ts || !dataId || !requestId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (expected.length !== values.v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(values.v1));
}

export async function mercado(path, options = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
