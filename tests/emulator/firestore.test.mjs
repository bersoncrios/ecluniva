import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST obrigatório: execute npm run test:emulator. Nenhum projeto remoto será usado.');
const [host, portText] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
if (!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Os testes aceitam somente emulador local.');
let env;
const initialTime=Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const society = (ownerId='owner',extras={}) => ({ownerId,churchName:'Igreja Presbiteriana de Teste',type:'SAF',name:'Esperança',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extras});
const member = (extras={}) => ({name:'Ana Maria',birthDate:null,receivedDate:null,office:'',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''},phone:'',email:'',status:'active',notes:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...extras});
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const societyRef = (database,id='own') => doc(database,'societies',id);
const memberRef = (database,id='member',societyId='own') => doc(database,'societies',societyId,'members',id);

before(async () => {
  env=await initializeTestEnvironment({projectId:'demo-societas',firestore:{host,port:Number(portText),rules:readFileSync('firestore.rules','utf8')}});
});
after(async () => {if(env) await env.cleanup();});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const database=context.firestore();
    await setDoc(societyRef(database),society('owner',{createdAt:initialTime,updatedAt:initialTime}));
    await setDoc(societyRef(database,'other'),society('other',{createdAt:initialTime,updatedAt:initialTime}));
    await setDoc(memberRef(database),member({createdAt:initialTime,updatedAt:initialTime}));
  });
});

test('owner reads own society/member and queries only owned societies', async () => {
  const database=db('owner');
  assert.equal((await assertSucceeds(getDoc(societyRef(database)))).data().name,'Esperança');
  assert.equal((await assertSucceeds(getDoc(memberRef(database)))).data().name,'Ana Maria');
  const societies=await assertSucceeds(getDocs(query(collection(database,'societies'),where('ownerId','==','owner'))));
  assert.deepEqual(societies.docs.map(item=>item.id),['own']);
  assert.equal((await assertSucceeds(getDocs(collection(database,'societies','own','members')))).size,1);
  await assertFails(getDocs(collection(database,'societies')));
  await assertFails(getDocs(query(collection(database,'societies'),where('ownerId','==','other'))));
});

test('anonymous and other owner cannot read/list/write known IDs', async () => {
  for(const uid of [null,'other']) {
    const database=db(uid);
    await assertFails(getDoc(societyRef(database)));
    await assertFails(getDoc(memberRef(database)));
    await assertFails(getDocs(collection(database,'societies','own','members')));
    await assertFails(updateDoc(societyRef(database),{name:'Alterada',updatedAt:serverTimestamp()}));
    await assertFails(setDoc(memberRef(database,'new'),member()));
    await assertFails(updateDoc(memberRef(database),{name:'Alterada',updatedAt:serverTimestamp()}));
  }
  await assertFails(setDoc(societyRef(db(null),'new'),society()));
});

test('society creation accepts owner and server time, rejects forged owner/timestamps/schema/type', async () => {
  const database=db('owner');
  await assertSucceeds(setDoc(societyRef(database,'new'),society()));
  for(const [index,patch] of [
    {ownerId:'other'}, {type:'INVALID'}, {name:' '}, {name:' A'}, {churchName:'A'}, {churchName:'x'.repeat(161)},
    {name:'x'.repeat(121)}, {unexpected:true}, {createdAt:initialTime}, {updatedAt:initialTime}, {ownerId:123},
  ].entries()) await assertFails(setDoc(societyRef(database,`invalid-${index}`),society('owner',patch)));
  const incomplete=society(); delete incomplete.churchName;
  await assertFails(setDoc(societyRef(database,'incomplete'),incomplete));
});

test('society update preserves owner and creation; deletion and unknown paths are denied', async () => {
  const database=db('owner');
  await assertSucceeds(updateDoc(societyRef(database),{name:'Unidade atualizada',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(societyRef(database),{ownerId:'other',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(societyRef(database),{createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(societyRef(database),{name:'Sem timestamp'}));
  await assertFails(deleteDoc(societyRef(database)));
  await assertFails(setDoc(doc(database,'unknown','document'),{ownerId:'owner'}));
});

test('owner creates, edits, inactivates and reactivates members without losing stored fields', async () => {
  const database=db('owner');
  const ref=memberRef(database,'new');
  await assertSucceeds(setDoc(ref,member({name:'José Ávila',birthDate:'2000-02-29',receivedDate:'2020-01-01',phone:'63999991234',email:'jose@example.com',address:{postalCode:'77000000',street:'Rua da Paz',number:'s/n',complement:'',neighborhood:'Centro',city:'Palmas',state:'TO'}})));
  const created=(await getDoc(ref)).data().createdAt;
  await assertSucceeds(updateDoc(ref,{name:'José da Silva Ávila',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref,{status:'inactive',updatedAt:serverTimestamp()}));
  let stored=(await getDoc(ref)).data();
  assert.equal(stored.status,'inactive');
  assert.equal(stored.birthDate,'2000-02-29');
  assert.equal(stored.phone,'63999991234');
  assert.equal(stored.createdAt.isEqual(created),true);
  await assertSucceeds(updateDoc(ref,{status:'active',updatedAt:serverTimestamp()}));
  assert.equal((await getDoc(ref)).data().status,'active');
});

test('member write rejects extras, missing fields, invalid types and status on create', async () => {
  const database=db('owner');
  for(const [index,patch] of [
    {name:'A'}, {name:' Ana'}, {name:'Ana '}, {name:'x'.repeat(121)}, {status:'inactive'}, {status:'removed'},
    {id:'forged'}, {ownerId:'owner'}, {office:12}, {notes:null}, {birthDate:''},
    {createdAt:initialTime}, {updatedAt:initialTime},
  ].entries()) await assertFails(setDoc(memberRef(database,`invalid-${index}`),member(patch)));
  const incomplete=member(); delete incomplete.notes;
  await assertFails(setDoc(memberRef(database,'incomplete'),incomplete));
  await assertFails(setDoc(memberRef(database,'no-parent','missing-society'),member()));
});

test('member write enforces field limits, email/phone and structured address', async () => {
  const database=db('owner');
  for(const [index,patch] of [
    {office:'x'.repeat(101)}, {notes:'x'.repeat(2001)}, {phone:'123'}, {phone:'(63)999991234'},
    {email:'sem-arroba'}, {email:'x'.repeat(255)}, {address:{}}, {address:{...member().address,extra:'no'}},
    {address:{...member().address,postalCode:'77000-000'}}, {address:{...member().address,state:'XX'}},
    {address:{...member().address,street:'x'.repeat(161)}}, {address:{...member().address,number:'x'.repeat(21)}},
    {address:{...member().address,city:'x'.repeat(101)}}, {address:{...member().address,state:null}},
  ].entries()) await assertFails(setDoc(memberRef(database,`invalid-${index}`),member(patch)));
  await assertSucceeds(setDoc(memberRef(database,'limits'),member({name:'x'.repeat(120),office:'x'.repeat(100),notes:'x'.repeat(2000),address:{...member().address,street:'x'.repeat(160),number:'x'.repeat(20),city:'x'.repeat(100),state:'TO'}})));
});

test('member date validation rejects impossible days, non-leap centuries, future and inverted receipt', async () => {
  const database=db('owner');
  for(const [index,birthDate] of ['1900-02-29','2023-02-29','2020-04-31','2020-13-01','2020-00-01','2020-01-00','0000-01-01','2999-01-01','2000-2-01','invalid'].entries()) {
    await assertFails(setDoc(memberRef(database,`invalid-date-${index}`),member({birthDate})));
  }
  await assertFails(setDoc(memberRef(database,'future-received'),member({receivedDate:'2999-01-01'})));
  await assertFails(setDoc(memberRef(database,'inverted'),member({birthDate:'2000-02-29',receivedDate:'1999-12-31'})));
  await assertSucceeds(setDoc(memberRef(database,'leap'),member({birthDate:'2000-02-29',receivedDate:'2000-02-29'})));
  await assertSucceeds(setDoc(memberRef(database,'optional'),member()));
});

test('member update cannot mutate creation, use stale timestamps, bypass full validation or delete', async () => {
  const database=db('owner');
  await assertFails(updateDoc(memberRef(database),{createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(memberRef(database),{name:'Alterada',updatedAt:initialTime}));
  await assertFails(updateDoc(memberRef(database),{name:'Alterada'}));
  await assertFails(updateDoc(memberRef(database),{status:'deleted',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(memberRef(database),{email:'inválido',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(memberRef(database),{birthDate:'2023-02-29',updatedAt:serverTimestamp()}));
  await assertFails(deleteDoc(memberRef(database)));
});
