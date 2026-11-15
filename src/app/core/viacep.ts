import { STATES } from './models.js';

export interface PostalAddress { street: string; neighborhood: string; city: string; state: string; }

export class PostalCodeNotFoundError extends Error {
  constructor() { super('CEP não encontrado.'); this.name = 'PostalCodeNotFoundError'; }
}

export function postalCodeDigits(raw: string): string | null {
  const value = raw.trim();
  return /^\d{5}-?\d{3}$/.test(value) ? value.replace('-', '') : null;
}

export async function lookupPostalCode(raw: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<PostalAddress> {
  const code = postalCodeDigits(raw);
  if (!code) throw new Error('Informe os 8 dígitos do CEP.');
  const response = await request(`https://viacep.com.br/ws/${code}/json/`, {
    signal, credentials: 'omit', headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Serviço de CEP indisponível.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Resposta de CEP inválida.');
  const data = result as Record<string, unknown>;
  if (data['erro'] === true || data['erro'] === 'true') throw new PostalCodeNotFoundError();
  const fields = { street: ['logradouro', 160], neighborhood: ['bairro', 100], city: ['localidade', 100], state: ['uf', 2] } as const;
  const address: PostalAddress = {street:'', neighborhood:'', city:'', state:''};
  for (const field of Object.keys(fields) as (keyof PostalAddress)[]) {
    const [key, limit] = fields[field];
    const value = data[key];
    if (typeof value !== 'string' || value.trim().length > limit) throw new Error('Resposta de CEP inválida.');
    address[field] = value.trim();
  }
  if (!address.city || !(STATES as readonly string[]).includes(address.state)) throw new Error('Resposta de CEP inválida.');
  return address;
}
