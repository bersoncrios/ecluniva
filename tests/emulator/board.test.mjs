import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute com FIRESTORE_EMULATOR_HOST local; nenhum projeto remoto será usado.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
if(!['localhost','127.0.0.1'].includes(host)) throw new Error('Somente Firestore Emulator local é permitido.');
let env;
const old=Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const society=ownerId=>({ownerId,churchName:'Igreja Teste',type:'UPH',name:'Diretoria',createdAt:old,updatedAt:old});
const member=(name,status='active')=>({name,status,birthDate:null,receivedDate:null,office:'',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''},phone:'',email:'',notes:'',createdAt:old,updatedAt:old});
const entry=(patch={})=>({year:2026,memberId:'ana',role:'Presidente',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...patch});
const db=uid=>uid ? env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const ref=(database,id='2026_ana',societyId='own')=>doc(database,'societies',societyId,'boardAssignments',id);
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>{if(env) await env.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
    const database=context.firestore();
    await setDoc(doc(database,'societies','own'),society('owner'));
    await setDoc(doc(database,'societies','other'),society('other'));
    await setDoc(doc(database,'societies','own','members','ana'),member('Ana'));
    await setDoc(doc(database,'societies','own','members','bruno'),member('Bruno','inactive'));
    await setDoc(doc(database,'societies','other','members','foreign'),member('Terceiro'));
  });
});
test('owner saves one assignment per member/year and preserves other years and inactive history',async()=>{
  const database=db('owner');
  await assertSucceeds(setDoc(ref(database),entry()));
  const created=(await getDoc(ref(database))).data().createdAt;
  await assertSucceeds(updateDoc(ref(database),{role:'Vice-presidente',updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(ref(database,'2027_ana'),entry({year:2027,role:'Tesoureiro'})));
  await assertSucceeds(setDoc(ref(database,'2026_bruno'),entry({memberId:'bruno',role:'Vice-presidente'})));
  const selected=await assertSucceeds(getDocs(query(collection(database,'societies','own','boardAssignments'),where('year','==',2026))));
  assert.equal(selected.size,2);
  assert.equal((await getDoc(ref(database))).data().createdAt.isEqual(created),true);
  assert.equal((await getDoc(ref(database,'2027_ana'))).data().role,'Tesoureiro');
});
test('anonymous and third party cannot read/list/create/update/delete board assignments',async()=>{
  const owner=db('owner');
  await setDoc(ref(owner),entry());
  for(const uid of [null,'other']) {
    const database=db(uid);
    await assertFails(getDoc(ref(database)));
    await assertFails(getDocs(collection(database,'societies','own','boardAssignments')));
    await assertFails(setDoc(ref(database,'2027_ana'),entry({year:2027})));
    await assertFails(updateDoc(ref(database),{role:'Tesoureiro',updatedAt:serverTimestamp()}));
    await assertFails(deleteDoc(ref(database)));
  }
});
test('board assignment requires matching deterministic ID and member within same society',async()=>{
  const database=db('owner');
  await assertFails(setDoc(ref(database,'random-id'),entry()));
  await assertFails(setDoc(ref(database,'2026_bruno'),entry()));
  await assertFails(setDoc(ref(database,'2026_missing'),entry({memberId:'missing'})));
  await assertFails(setDoc(ref(database,'2026_foreign'),entry({memberId:'foreign'})));
  await assertFails(setDoc(ref(database,'2026_ana','missing-society'),entry()));
});
test('board assignment rejects invalid years, role, schema and forged timestamps',async()=>{
  const database=db('owner');
  for(const year of [1899,2101,2026.5,'2026',null]) await assertFails(setDoc(ref(database,`${year}_ana`),entry({year})));
  for(const patch of [{role:'A'},{role:' '},{role:' Presidente'},{role:'Presidente '},{role:'x'.repeat(101)},{role:123},{memberId:''},{memberId:123},{createdAt:old},{updatedAt:old},{ownerId:'owner'},{extra:true}]) await assertFails(setDoc(ref(database),entry(patch)));
  const missing=entry();delete missing.role;
  await assertFails(setDoc(ref(database),missing));
});
test('board update preserves identity/creation and deletion removes only selected participation',async()=>{
  const database=db('owner');
  await setDoc(ref(database),entry());
  await setDoc(ref(database,'2027_ana'),entry({year:2027}));
  for(const patch of [{year:2027},{memberId:'bruno'},{createdAt:serverTimestamp()},{role:'x'.repeat(101)},{unexpected:'x'}]) await assertFails(updateDoc(ref(database),{...patch,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(database),{role:'Secretário',updatedAt:old}));
  await assertSucceeds(deleteDoc(ref(database)));
  assert.equal((await getDoc(ref(database))).exists(),false);
  assert.equal((await getDoc(ref(database,'2027_ana'))).exists(),true);
  assert.equal((await getDoc(doc(database,'societies','own','members','ana'))).exists(),true);
  await assertFails(deleteDoc(doc(database,'societies','own','members','ana')));
});
