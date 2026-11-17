const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
const backUrl = process.env.QUADREI_BILLING_APP_URL?.trim();

if (!token) throw new Error('Defina MERCADOPAGO_ACCESS_TOKEN antes de executar.');
if (!backUrl || !/^https:\/\//.test(backUrl)) throw new Error('Defina QUADREI_BILLING_APP_URL com uma URL HTTPS pública.');

const plans = [
  ['essential', 'Quadrei Essencial', 9.90],
  ['professional', 'Quadrei Profissional', 29.90],
  ['institutional', 'Quadrei Institucional', 79.90],
];

for (const [key, reason, amount] of plans) {
  const response = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: amount, currency_id: 'BRL' },
      back_url: `${backUrl.replace(/\/$/, '')}/assinatura/retorno`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${key}: Mercado Pago ${response.status} — ${JSON.stringify(body)}`);
  console.log(`${key}=${body.id}`);
}
