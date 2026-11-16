import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
const [host,port]=(process.env.FIRESTORE_EMULATOR_HOST||'').split(':');
if(!['127.0.0.1','localhost'].includes(host))throw new Error('Use only the local emulator.');
let env,owner,guest,other;
const token='a'.repeat(48),rid='b'.repeat(48),mid='2026_1';
const publicRef=db=>doc(db,`plenaryAttendance/${token}`);
const privateRef=db=>doc(db,`societies/own/attendanceSessions/${mid}`);
const requestRef=db=>doc(db,`plenaryAttendance/${token}/requests/${rid}`);
const request=()=>({name:'João da Silva',code:'123456',status:'pending',memberId:'',createdAt:serverTimestamp(),processedAt:null});
let minute;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-attendance',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});owner=env.authenticatedContext('owner').firestore();guest=env.unauthenticatedContext().firestore();other=env.authenticatedContext('other').firestore();});
after(async()=>env?.cleanup());
beforeEach(async()=>{
 await env.clearFirestore();
 const date=new Date(Date.now()-3*3600000).toISOString().slice(0,10),start=Date.parse(date+'T03:00:00Z');
 minute={date,timeZone:'America/Araguaina',status:'in_progress',dayStart:Timestamp.fromMillis(start),dayEnd:Timestamp.fromMillis(start+86400000)};
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'societies/own'),{ownerId:'owner'});await setDoc(doc(db,`societies/own/minutes/${mid}`),minute);await setDoc(doc(db,'societies/own/members/a'),{name:'João da Silva',status:'active'});});
});
async function open(db=owner){const batch=writeBatch(db);batch.set(privateRef(db),{token,code:'123456'});batch.set(publicRef(db),{societyId:'own',minuteId:mid,title:'UPH · Plenária 1',date:minute.date,timeZone:minute.timeZone,open:true});return batch.commit();}
test('only owner can atomically open a session and the code is private',async()=>{
 await assertFails(open(other));await assertFails(open(guest));await assertSucceeds(open());
 await assertSucceeds(getDoc(publicRef(guest)));await assertFails(getDocs(collection(guest,'plenaryAttendance')));
 await assertFails(getDoc(privateRef(guest)));await assertFails(getDoc(privateRef(other)));
 await assertFails(getDoc(doc(guest,'societies/own/members/a')));await assertFails(getDoc(doc(guest,`societies/own/minutes/${mid}`)));
 await assertFails(updateDoc(publicRef(other),{open:false}));
});
test('public submits only pending full names with correct code and server timestamp',async()=>{
 await open();
 for(const patch of [{code:'000000'},{name:'João'},{name:'x'.repeat(121)},{status:'confirmed'},{memberId:'a'},{createdAt:Timestamp.fromMillis(1)},{phone:'123'}])await assertFails(setDoc(requestRef(guest),{...request(),...patch}));
 await assertSucceeds(setDoc(requestRef(guest),request()));
 assert.equal((await getDoc(requestRef(guest))).data().status,'pending');
 await assertFails(setDoc(requestRef(guest),request()));await assertFails(updateDoc(requestRef(guest),{status:'confirmed'}));
 await assertFails(getDocs(collection(guest,`plenaryAttendance/${token}/requests`)));await assertFails(getDocs(collection(other,`plenaryAttendance/${token}/requests`)));
 await assertSucceeds(getDocs(collection(owner,`plenaryAttendance/${token}/requests`)));
});
test('owner resolves or rejects; outsiders cannot alter receipts',async()=>{
 await open();await setDoc(requestRef(guest),request());
 await assertFails(updateDoc(requestRef(other),{status:'confirmed',memberId:'a',processedAt:serverTimestamp()}));
 await assertFails(updateDoc(requestRef(owner),{status:'confirmed',memberId:'missing',processedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(requestRef(owner),{status:'confirmed',memberId:'a',processedAt:serverTimestamp()}));
 await assertFails(updateDoc(requestRef(owner),{status:'rejected',memberId:'',processedAt:serverTimestamp()}));
 const second=doc(owner,`plenaryAttendance/${token}/requests/${'c'.repeat(48)}`);await setDoc(second,request());await assertSucceeds(updateDoc(second,{status:'rejected',memberId:'',processedAt:serverTimestamp()}));
});
test('closed, expired, future and concluded meetings reject public submissions',async()=>{
 await open();await updateDoc(publicRef(owner),{open:false});await assertFails(setDoc(requestRef(guest),request()));
 await assertSucceeds(updateDoc(publicRef(owner),{open:true}));
 for(const patch of [{status:'concluded'},{dayEnd:Timestamp.fromMillis(Date.now()-1000)},{dayStart:Timestamp.fromMillis(Date.now()+86400000)}]){
  await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),`societies/own/minutes/${mid}`),{...minute,...patch}));
  await assertFails(setDoc(requestRef(guest),request()));await assertFails(updateDoc(publicRef(owner),{open:true}));
 }
 await assertSucceeds(updateDoc(publicRef(owner),{open:false}));
});
test('owner can prepare a closed future link without opening early',async()=>{
 const future={...minute,dayStart:Timestamp.fromMillis(Date.now()+86400000),dayEnd:Timestamp.fromMillis(Date.now()+172800000)};
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),`societies/own/minutes/${mid}`),future));
 const batch=writeBatch(owner);batch.set(privateRef(owner),{token,code:'123456'});batch.set(publicRef(owner),{societyId:'own',minuteId:mid,title:'UPH · Plenária 1',date:minute.date,timeZone:minute.timeZone,open:false});
 await assertSucceeds(batch.commit());await assertSucceeds(getDoc(publicRef(guest)));
 await assertFails(updateDoc(publicRef(owner),{open:true}));await assertFails(setDoc(requestRef(guest),request()));
});
