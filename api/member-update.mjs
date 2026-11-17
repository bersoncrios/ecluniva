import crypto from 'node:crypto';
import admin from 'firebase-admin';
import { db, json, verifyUser } from './billing/_shared.mjs';

const STATES = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const ADDRESS_FIELDS = ['postalCode','street','number','complement','neighborhood','city','state'];

function bodyOf(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
}

function invalidLink(res) {
  return json(res, 404, { error: 'Este link não está mais disponível. Peça um novo à pessoa responsável pelo cadastro.' });
}

function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Araguaina', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Confira os dados informados.');
  const allowed = ['name','birthDate','phone','email','address'];
  if (Object.keys(input).some(key => !allowed.includes(key)) || allowed.some(key => !(key in input))) throw new Error('Confira os campos enviados.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const birthDate = input.birthDate === null || input.birthDate === '' ? null : input.birthDate;
  const phoneRaw = typeof input.phone === 'string' ? input.phone.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (name.length < 2 || name.length > 120) throw new Error('Informe o nome com 2 a 120 caracteres.');
  if (birthDate !== null && (!validDate(birthDate) || birthDate > todayISO())) throw new Error('Informe uma data de nascimento válida, que não seja futura.');
  if (phoneRaw && !/^[\d\s()+.\-]+$/.test(phoneRaw)) throw new Error('Confira o telefone com DDD.');
  const phone = phoneRaw.replace(/\D/g, '');
  if (phone && !/^\d{10,11}$/.test(phone)) throw new Error('Informe um telefone com DDD e 10 ou 11 dígitos.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Confira o e-mail informado.');
  const address = input.address;
  if (!address || typeof address !== 'object' || Array.isArray(address) || Object.keys(address).some(key => !ADDRESS_FIELDS.includes(key)) || ADDRESS_FIELDS.some(key => !(key in address))) throw new Error('Confira o endereço informado.');
  const limits = { postalCode:8, street:160, number:20, complement:100, neighborhood:100, city:100, state:2 };
  const normalizedAddress = {};
  for (const field of ADDRESS_FIELDS) {
    if (typeof address[field] !== 'string') throw new Error('Confira o endereço informado.');
    const value = address[field].trim();
    if (value.length > limits[field]) throw new Error('Um dos campos do endereço ultrapassou o limite de caracteres.');
    normalizedAddress[field] = field === 'postalCode' ? value.replace(/\D/g, '') : value;
  }
  normalizedAddress.state = normalizedAddress.state.toUpperCase();
  if (normalizedAddress.postalCode && !/^\d{8}$/.test(normalizedAddress.postalCode)) throw new Error('Informe os 8 dígitos do CEP.');
  if (normalizedAddress.state && !STATES.has(normalizedAddress.state)) throw new Error('Selecione uma UF válida.');
  return { name, birthDate, phone, email, address: normalizedAddress };
}

async function createLink(req, res, body) {
  let user;
  try { user = await verifyUser(req); }
  catch { return json(res, 401, { error:'Entre novamente para gerar o link.' }); }
  const { societyId, memberId } = body;
  if (typeof societyId !== 'string' || !ID_PATTERN.test(societyId) || typeof memberId !== 'string' || !ID_PATTERN.test(memberId)) return json(res, 400, { error:'Cadastro indisponível.' });

  const store = db();
  const societyRef = store.doc(`societies/${societyId}`);
  const memberRef = societyRef.collection('members').doc(memberId);
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenRef = store.doc(`memberUpdateTokens/${tokenHash}`);
  const pointerRef = societyRef.collection('memberUpdateLinks').doc(memberId);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await store.runTransaction(async transaction => {
      const [society, member, currentPointer] = await Promise.all([transaction.get(societyRef), transaction.get(memberRef), transaction.get(pointerRef)]);
      if (!society.exists || society.data()?.ownerId !== user.uid || !member.exists) throw new Error('Cadastro indisponível.');
      const previousHash = currentPointer.data()?.tokenHash;
      const previousRef = typeof previousHash === 'string' ? store.doc(`memberUpdateTokens/${previousHash}`) : null;
      const previousToken = previousRef ? await transaction.get(previousRef) : null;
      if (previousRef && previousToken?.exists && previousToken.data()?.status === 'active') transaction.update(previousRef,{status:'revoked',revokedAt:admin.firestore.FieldValue.serverTimestamp()});
      transaction.create(tokenRef, { societyId, memberId, status:'active', createdBy:user.uid, createdAt:admin.firestore.FieldValue.serverTimestamp(), expiresAt });
      transaction.set(pointerRef, { tokenHash, expiresAt, updatedAt:admin.firestore.FieldValue.serverTimestamp() });
    });
    return json(res, 200, { token, expiresAt:expiresAt.toDate().toISOString() });
  } catch (error) {
    return json(res, 400, { error:error instanceof Error ? error.message : 'Não foi possível gerar o link.' });
  }
}

async function resolveLink(store, token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenRef = store.doc(`memberUpdateTokens/${tokenHash}`);
  const tokenSnapshot = await tokenRef.get();
  if (!tokenSnapshot.exists) return null;
  const grant = tokenSnapshot.data();
  if (grant.status !== 'active' || !grant.expiresAt || grant.expiresAt.toMillis() <= Date.now()) return null;
  const societyRef = store.doc(`societies/${grant.societyId}`);
  const memberRef = societyRef.collection('members').doc(grant.memberId);
  const pointerRef = societyRef.collection('memberUpdateLinks').doc(grant.memberId);
  const [society, member, pointer] = await Promise.all([societyRef.get(), memberRef.get(), pointerRef.get()]);
  if (!society.exists || !member.exists || !pointer.exists || pointer.data()?.tokenHash !== tokenHash || pointer.data()?.expiresAt?.toMillis() <= Date.now()) return null;
  return { tokenHash, tokenRef, grant, society:society.data(), member:member.data() };
}

function publicMember(member) {
  const address = member.address && typeof member.address === 'object' ? member.address : {};
  return {
    name: String(member.name || ''),
    birthDate: typeof member.birthDate === 'string' ? member.birthDate : null,
    phone: String(member.phone || ''),
    email: String(member.email || ''),
    address: Object.fromEntries(ADDRESS_FIELDS.map(field => [field, String(address[field] || '')])),
  };
}

async function loadMember(req, res, body) {
  const resolved = await resolveLink(db(), body.token);
  if (!resolved) return invalidLink(res);
  return json(res, 200, {
    member:publicMember(resolved.member),
    society:{ name:String(resolved.society.name || ''), type:String(resolved.society.type || ''), churchName:String(resolved.society.churchName || '') },
    expiresAt:resolved.grant.expiresAt.toDate().toISOString(),
  });
}

async function submitMember(req, res, body) {
  const store = db();
  const resolved = await resolveLink(store, body.token);
  if (!resolved) return invalidLink(res);
  let input;
  try { input = normalizeInput(body.member); }
  catch (error) { return json(res, 400, { error:error.message }); }

  const societyId = resolved.grant.societyId, memberId = resolved.grant.memberId;
  const societyRef = store.doc(`societies/${societyId}`), memberRef = societyRef.collection('members').doc(memberId);
  const pointerRef = societyRef.collection('memberUpdateLinks').doc(memberId);
  const birthdayRef = societyRef.collection('communicationBirthdays').doc(memberId);
  try {
    await store.runTransaction(async transaction => {
      const [tokenSnapshot, pointer, society, member] = await Promise.all([transaction.get(resolved.tokenRef), transaction.get(pointerRef), transaction.get(societyRef), transaction.get(memberRef)]);
      const grant = tokenSnapshot.data();
      if (!tokenSnapshot.exists || grant?.status !== 'active' || grant.expiresAt?.toMillis() <= Date.now() || !pointer.exists || pointer.data()?.tokenHash !== resolved.tokenHash || !society.exists || !member.exists) throw new Error('LINK_UNAVAILABLE');
      const receivedDate = typeof member.data().receivedDate === 'string' ? member.data().receivedDate : null;
      if (input.birthDate && receivedDate && receivedDate < input.birthDate) throw new Error('INVALID_DATE_ORDER');
      const status = member.data().status === 'inactive' ? 'inactive' : 'active';
      transaction.update(memberRef, { ...input, updatedAt:admin.firestore.FieldValue.serverTimestamp() });
      transaction.set(birthdayRef, { name:input.name, month:input.birthDate ? Number(input.birthDate.slice(5,7)) : 0, day:input.birthDate ? Number(input.birthDate.slice(8,10)) : 0, active:status === 'active' && !!input.birthDate });
      transaction.update(resolved.tokenRef, { status:'used', usedAt:admin.firestore.FieldValue.serverTimestamp() });
    });
    return json(res, 200, { updated:true });
  } catch (error) {
    if (error instanceof Error && error.message === 'LINK_UNAVAILABLE') return invalidLink(res);
    if (error instanceof Error && error.message === 'INVALID_DATE_ORDER') return json(res, 400, { error:'A data de nascimento não pode ser posterior à data de recebimento registrada. Peça à administração para conferir essa informação.' });
    console.error('Falha ao atualizar cadastro por link:', error);
    return json(res, 500, { error:'Não foi possível salvar as alterações. Tente novamente.' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error:'Método não permitido.' });
  res.setHeader('Cache-Control','no-store, max-age=0');
  try {
    const body = bodyOf(req);
    if (body.action === 'create') return await createLink(req, res, body);
    if (body.action === 'load') return await loadMember(req, res, body);
    if (body.action === 'submit') return await submitMember(req, res, body);
    return json(res, 400, { error:'Operação inválida.' });
  } catch (error) {
    console.error('Falha na atualização cadastral por link:', error);
    return json(res, 500, { error:'Não foi possível processar a solicitação.' });
  }
}
