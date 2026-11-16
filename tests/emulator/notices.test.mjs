import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use o emulador local.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');if(!['localhost','127.0.0.1','::1'].includes(host))throw new Error('Somente emulador local.');
let env;
const db=()=>env.authenticatedContext('owner').firestore();
const ref=(database,id='test')=>doc(database,`societies/own/notices/${id}`);
const sample=()=>({meetingType:'plenary',churchName:'Igreja Teste',societyName:'UPH Teste',issueCity:'Palmas, TO',issueDate:'2026-10-10',meetingDate:'2026-10-18',timeDescription:'Após a EBD',meetingPurpose:'reunião plenária',meetingLocation:'no templo da igreja',address:'Rua Um, 25',legalBasis:'',agenda:'',presidentName:'José Silva',secretaryName:'João Lima',presidentRole:'Presidente da UPH',secretaryRole:'1º Secretário da UPH',revision:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-notices',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'societies/own'),{ownerId:'owner'}));});
test('owner creates each notice type, revises and persists historical signatories',async()=>{
 const database=db();
 for(const meetingType of ['plenary','executive','board'])await assertSucceeds(setDoc(ref(database,meetingType),{...sample(),meetingType}));
 await assertSucceeds(updateDoc(ref(database,'executive'),{agenda:'Planejamento\nRelatório financeiro',revision:1,updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(ref(database,'executive'))).data().presidentName,'José Silva');
 await assertFails(updateDoc(ref(database,'executive'),{revision:1,updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(ref(database,'executive')));
});
test('other users and other societies cannot read or write a notice',async()=>{
 await setDoc(ref(db()),sample());
 for(const database of [env.unauthenticatedContext().firestore(),env.authenticatedContext('other').firestore()]){
  await assertFails(getDoc(ref(database)));await assertFails(setDoc(ref(database,'other'),sample()));
  await assertFails(updateDoc(ref(database),{agenda:'Indevida',revision:1,updatedAt:serverTimestamp()}));
 }
 await assertFails(setDoc(doc(db(),'societies/not-owned/notices/test'),sample()));
});
test('notice fields, revision, civil dates and agenda limits are enforced server-side',async()=>{
 const database=db();
 for(const override of [{meetingType:'wrong'},{meetingDate:'2026-02-30'},{issueDate:'2026-10-19'},{presidentName:''},{address:'x'.repeat(501)},{agenda:'Assunto\n'.repeat(51)},{revision:1},{unexpected:true}])await assertFails(setDoc(ref(database),{...sample(),...override}));
 await assertSucceeds(setDoc(ref(database),sample()));
 await assertFails(updateDoc(ref(database),{revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
});
