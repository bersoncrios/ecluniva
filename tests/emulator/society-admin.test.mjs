import {after,before,beforeEach,test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,serverTimestamp,writeBatch} from 'firebase/firestore';

if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use o emulador local.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
let env,ownerDb,memberDb;
const inviteRef=db=>doc(db,'societyAdminInvites/own__member@example.test');
const adminRef=db=>doc(db,'societies/own/admins/member');
const invitation=()=>({societyId:'own',ownerId:'owner',email:'member@example.test',societyName:'Esperança',churchName:'Igreja',societyType:'UPH',status:'pending',acceptedBy:'',acceptedAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-admin',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});ownerDb=env.authenticatedContext('owner',{email:'owner@example.test',email_verified:true}).firestore();memberDb=env.authenticatedContext('member',{email:'member@example.test',email_verified:true}).firestore();});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'societies/own'),{ownerId:'owner',name:'Esperança',churchName:'Igreja',type:'UPH',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});});

test('owner creates admin invite and invited member accepts it, but cannot change admins',async()=>{
 await assertSucceeds(setDoc(inviteRef(ownerDb),invitation()));
 const batch=writeBatch(memberDb);batch.update(inviteRef(memberDb),{status:'accepted',acceptedBy:'member',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});batch.set(adminRef(memberDb),{userId:'member',email:'member@example.test',inviteId:'own__member@example.test',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());
 await assertSucceeds(getDoc(doc(memberDb,'societies/own')));
 await assertFails(updateDoc(adminRef(memberDb),{active:false,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(inviteRef(memberDb),{status:'revoked',updatedAt:serverTimestamp()}));
});
