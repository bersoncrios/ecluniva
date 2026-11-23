import {after,before,beforeEach,test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';

if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use o emulador local.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');let env,ownerDb,publicDb;
const page=db=>doc(db,'publicPages/own');const post=db=>doc(db,'publicPages/own/posts/event-1');
const pageData=()=>({societyId:'own',slug:'uph-esperanca',title:'UPH Esperança',description:'Servindo a comunidade.',phone:'',email:'',instagram:'',whatsapp:'',address:'',published:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const postData=()=>({type:'event',title:'Reunião mensal',body:'Todos são bem-vindos.',date:'2026-12-01',time:'19h',location:'Igreja',status:'published',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-public',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});ownerDb=env.authenticatedContext('owner',{email:'owner@example.test',email_verified:true}).firestore();publicDb=env.unauthenticatedContext().firestore();});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'societies/own'),{ownerId:'owner',name:'Esperança',churchName:'Igreja',type:'UPH',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});});
test('essential society can publish page and public visitor reads only published content',async()=>{await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'users/owner/billing/own'),{status:'authorized',plan:'essential'}));await assertSucceeds(setDoc(page(ownerDb),pageData()));await assertSucceeds(setDoc(post(ownerDb),postData()));await assertSucceeds(getDoc(page(publicDb)));await assertSucceeds(getDoc(post(publicDb)));});
test('free society cannot create a public page',async()=>{await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'users/owner/billing/own'),{status:'authorized',plan:'free'}));await assertFails(setDoc(page(ownerDb),pageData()));});
