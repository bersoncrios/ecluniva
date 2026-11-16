import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use o emulador local.');
const [host,port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
if (!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Somente emulador local.');
let env;
const owner = () => env.authenticatedContext('owner').firestore();
const ref = (db,id='2026_1') => doc(db,`societies/own/minutes/${id}`);
function minute(shift=0) {
 const now=new Date(); const local=new Date(now.getTime()-3*3600000); local.setUTCDate(local.getUTCDate()+shift);
 const date=local.toISOString().slice(0,10); const year=Number(date.slice(0,4));
 const start=Date.parse(date+'T03:00:00Z');
 return {number:1,year,type:'Ordinária',date,timeZone:'America/Araguaina',startTime:'19:00',endTime:'20:00',churchName:'Igreja Teste',societyName:'UPH Teste',templeAddress:'Rua da Paz, 1, Centro, Palmas TO',logoDataUrl:'',convocation:'Convocada regularmente.',scripture:'Salmo 23',preacher:'Pedro',openingPrayer:'João',devotionalTime:'19:00',deliberations:'Foi aprovada a proposta.',newMembers:'',hymn:'Hino oficial',closingPrayer:'João',presidentId:'',secretaryId:'',attendance:[],status:'scheduled',revision:0,dayStart:Timestamp.fromMillis(start),dayEnd:Timestamp.fromMillis(start+86400000),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),concludedAt:null,finalText:''};
}
async function seed(value,id) { await env.withSecurityRulesDisabled(c=>setDoc(ref(c.firestore(),id),value)); }
async function reserve(db,value) {
 const id=`${value.year}_${value.number}`;
 const batch=writeBatch(db);
 batch.set(doc(db,`societies/own/minuteCounters/${value.year}`),{year:value.year,value:value.number,minuteId:id,updatedAt:serverTimestamp()});
 batch.set(ref(db,id),value);
 return batch.commit();
}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-minutes',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'societies/own'),{ownerId:'owner'}));});
test('atomic reservation accepts chosen numbers and rejects duplicates and standalone writes',async()=>{
 const db=owner(),value=minute(1),id=`${value.year}_1`;
 await assertFails(setDoc(ref(db,id),value));
 await assertSucceeds(reserve(db,value));
 await assertFails(reserve(db,value));
 await assertSucceeds(reserve(db,{...value,number:25}));
 await assertFails(reserve(db,{...value,number:25}));
 await assertFails(reserve(db,{...value,number:0}));
 await assertSucceeds(reserve(db,{...value,number:2}));
 await assertFails(updateDoc(doc(db,`societies/own/minuteCounters/${value.year}`),{value:5,updatedAt:serverTimestamp()}));
});
test('only owner reads/writes minutes and counter',async()=>{
 const value=minute(1),id=`${value.year}_1`;await reserve(owner(),value);
 for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('other').firestore()]) {
  await assertFails(getDoc(ref(db,id)));await assertFails(updateDoc(ref(db,id),{revision:1,deliberations:'Alterada',updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(db,`societies/own/minuteCounters/${value.year}`)));
 }
});
test('future presence is blocked server-side while preparation remains editable',async()=>{
 const db=owner(),value=minute(1),id=`${value.year}_1`;await reserve(db,value);
 await assertSucceeds(updateDoc(ref(db,id),{deliberations:'Pauta prevista.',revision:1,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{attendance:[{memberId:'a',name:'Ana',role:''}],status:'in_progress',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{dayStart:Timestamp.fromMillis(Date.now()-1000),revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{date:minute().date,revision:2,updatedAt:serverTimestamp()}));
});
test('today presence allowed, revision required, conclusion permanently freezes all data',async()=>{
 const db=owner(),value=minute(),id=`${value.year}_1`;await reserve(db,value);
 const attendance=[{memberId:'a',name:'Ana',role:'Presidente'},{memberId:'b',name:'Bia',role:'Secretário'}];
 await assertSucceeds(updateDoc(ref(db,id),{attendance,status:'in_progress',revision:1,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{deliberations:'Revisão obsoleta',revision:1,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(ref(db,id),{presidentId:'a',secretaryId:'b',status:'concluded',revision:2,concludedAt:serverTimestamp(),finalText:'Texto oficial congelado.',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{status:'in_progress',revision:3,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(db,id),{attendance:[],revision:3,updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(ref(db,id)));
 assert.equal((await getDoc(ref(db,id))).data().attendance.length,2);
});
test('after civil day attendance cannot change, saved prose can be concluded',async()=>{
 const db=owner(),value=minute(-1),id=`${value.year}_1`;
 value.status='in_progress';value.attendance=[{memberId:'a',name:'Ana',role:'Presidente'},{memberId:'b',name:'Bia',role:'Secretário'}];
 await seed(value,id);
 await assertFails(updateDoc(ref(db,id),{attendance:[],revision:1,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(ref(db,id),{presidentId:'a',secretaryId:'b',status:'concluded',revision:1,concludedAt:serverTimestamp(),finalText:'Texto final.',updatedAt:serverTimestamp()}));
});
test('timezone/day-start mismatch cannot unlock attendance early',async()=>{
 const db=owner(),value=minute(1);
 await assertFails(reserve(db,{...value,timeZone:'America/Manaus'}));
 await assertFails(reserve(db,{...value,timeZone:'UTC'}));
 await assertFails(reserve(db,{...value,dayEnd:Timestamp.fromMillis(Date.now()+1000)}));
});

test('conclusion rejects impossible chronology even through direct SDK writes',async()=>{
 const db=owner(),value=minute(),id=`${value.year}_1`;await reserve(db,value);
 const attendance=[{memberId:'a',name:'Ana',role:'Presidente'},{memberId:'b',name:'Bia',role:'Secretário'}];
 const conclusion={attendance,presidentId:'a',secretaryId:'b',status:'concluded',revision:1,concludedAt:serverTimestamp(),finalText:'Texto final.',updatedAt:serverTimestamp()};
 await assertFails(updateDoc(ref(db,id),{...conclusion,startTime:'20:00',devotionalTime:'20:00',endTime:'19:00'}));
 await assertFails(updateDoc(ref(db,id),{...conclusion,startTime:'19:00',devotionalTime:'18:00',endTime:'20:00'}));
 await assertFails(updateDoc(ref(db,id),{...conclusion,startTime:'19:00',devotionalTime:'21:00',endTime:'20:00'}));
 await assertSucceeds(updateDoc(ref(db,id),{...conclusion,startTime:'19:00',devotionalTime:'19:30',endTime:'20:00'}));
});
