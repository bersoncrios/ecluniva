import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,updateDoc,collection,query,where,writeBatch,serverTimestamp} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Use o emulador local.');const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');if(!['localhost','127.0.0.1','::1'].includes(host))throw new Error('Somente local.');
let env,ownerDb,mediaDb;
const owner=()=>ownerDb;
const media=()=>mediaDb;
const memberRef=(db,id='member')=>doc(db,`societies/own/members/${id}`);
const summaryRef=(db,id='member')=>doc(db,`societies/own/communicationBirthdays/${id}`);
const inviteRef=db=>doc(db,'communicationInvites/own__media@example.test');
const teamRef=(db,user='media')=>doc(db,`societies/own/communicationTeam/${user}`);
const payload=()=>({name:'João Silva',birthDate:'1970-11-16',receivedDate:null,office:'Diácono',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''},phone:'63999999999',email:'private@example.test',notes:'Informação privada',status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const summary=(name='João Silva',month=11,day=16,active=true)=>({name,month,day,active});
const invitation=()=>({societyId:'own',ownerId:'owner',email:'media@example.test',societyName:'UPH Teste',churchName:'Igreja Teste',societyType:'UPH',status:'pending',acceptedBy:'',acceptedAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
async function enable(){await setDoc(doc(owner(),'societies/own/communicationSettings/access'),{enabled:true,updatedAt:serverTimestamp()});}
async function invite(){await enable();await setDoc(inviteRef(owner()),invitation());}
async function accept(db=media(),uid='media'){
 const batch=writeBatch(db);batch.update(inviteRef(db),{status:'accepted',acceptedBy:uid,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});batch.set(teamRef(db,uid),{userId:uid,email:'media@example.test',inviteId:'own__media@example.test',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return batch.commit();
}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-societas-communication',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});ownerDb=env.authenticatedContext('owner',{email:'owner@example.test',email_verified:true}).firestore();mediaDb=env.authenticatedContext('media',{email:'media@example.test',email_verified:true}).firestore();});
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'societies/own'),{ownerId:'owner',name:'UPH Teste',churchName:'Igreja Teste',type:'UPH',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await setDoc(memberRef(db),payload());});});
test('owner shares minimal birthdays and private records remain blocked for an accepted collaborator',async()=>{
 await setDoc(summaryRef(owner()),summary());await invite();await assertSucceeds(accept());
 await assertSucceeds(getDoc(summaryRef(media())));
 const records=await assertSucceeds(getDocs(query(collection(media(),'societies/own/communicationBirthdays'),where('active','==',true))));
 assert.deepEqual(Object.keys(records.docs[0].data()).sort(),['active','day','month','name']);
 for(const path of ['societies/own/members/member','societies/own/minutes/test','societies/own/notices/test','societies/own/boardAssignments/test'])await assertFails(getDoc(doc(media(),path)));
 await assertFails(getDocs(collection(media(),'societies/own/members')));
 await assertSucceeds(getDoc(doc(media(),'societies/own')));
 await assertFails(getDocs(query(collection(media(),'societies'),where('ownerId','==','owner'))));
});
test('only the invited verified email can accept and direct self-promotion is denied',async()=>{
 await invite();
 await assertSucceeds(getDocs(query(collection(media(),'communicationInvites'),where('email','==','media@example.test'))));
 for(const [uid,claims] of [['wrong',{email:'other@example.test',email_verified:true}],['unverified',{email:'media@example.test',email_verified:false}]]){
  const db=env.authenticatedContext(uid,claims).firestore();await assertFails(getDoc(inviteRef(db)));await assertFails(accept(db,uid));
 }
 await assertFails(updateDoc(inviteRef(owner()),{status:'accepted',acceptedBy:'media',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(inviteRef(media()),{status:'accepted',acceptedBy:'media',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await assertFails(setDoc(teamRef(media()),{userId:'media',email:'media@example.test',inviteId:'own__media@example.test',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await assertSucceeds(accept());
 await assertFails(setDoc(doc(media(),'communicationInvites/own__other@example.test'),{...invitation(),email:'other@example.test'}));
});
test('projection cannot expose extra fields or forge a name/date and is synced on private edits',async()=>{
 await setDoc(summaryRef(owner()),summary());
 for(const changes of [{birthYear:1970},{phone:'private'},{name:'Outra pessoa'},{day:17}])await assertFails(setDoc(summaryRef(owner()),{...summary(),...changes}));
 await assertFails(updateDoc(memberRef(owner()),{birthDate:'1970-12-20',updatedAt:serverTimestamp()}));
 const batch=writeBatch(owner());batch.update(memberRef(owner()),{birthDate:'1970-12-20',updatedAt:serverTimestamp()});batch.set(summaryRef(owner()),summary('João Silva',12,20));await assertSucceeds(batch.commit());
 await assertSucceeds(updateDoc(memberRef(owner()),{phone:'63988888888',updatedAt:serverTimestamp()}));
});
test('legacy backfill works in small batches and enabled societies require summaries for new members',async()=>{
 const db=owner();await enable();await assertFails(setDoc(memberRef(db,'new'),payload()));
 const batch=writeBatch(db);batch.set(memberRef(db,'new'),payload());batch.set(summaryRef(db,'new'),summary());await assertSucceeds(batch.commit());
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(let i=0;i<18;i++)await setDoc(memberRef(db,'legacy'+i),payload());});
 for(let start=0;start<18;start+=8){const batch=writeBatch(db);for(let i=start;i<Math.min(start+8,18);i++)batch.set(summaryRef(db,'legacy'+i),summary());await assertSucceeds(batch.commit());}
});
test('inactivation removes the birthday from collaborator queries and revocation removes access immediately',async()=>{
 await setDoc(summaryRef(owner()),summary());await invite();await accept();
 const batch=writeBatch(owner());batch.update(memberRef(owner()),{status:'inactive',updatedAt:serverTimestamp()});batch.set(summaryRef(owner()),summary('João Silva',11,16,false));await assertSucceeds(batch.commit());
 assert.equal((await getDocs(query(collection(media(),'societies/own/communicationBirthdays'),where('active','==',true)))).size,0);
 await assertFails(getDoc(summaryRef(media())));
 await updateDoc(inviteRef(owner()),{status:'revoked',updatedAt:serverTimestamp()});
 await assertFails(getDocs(query(collection(media(),'societies/own/communicationBirthdays'),where('active','==',true))));
 await assertFails(getDoc(doc(media(),'societies/own/communicationSettings/identity')));
 await assertFails(updateDoc(teamRef(media()),{active:true,updatedAt:serverTimestamp()}));
});
test('collaborators manage publication status with occurrence checks and revisions, but not identity or members',async()=>{
 await setDoc(summaryRef(owner()),summary());await invite();await accept();
 const db=media(),ref=doc(db,'societies/own/birthdayPublications/member_2026-11-16');
 const publication={memberId:'member',date:'2026-11-16',status:'prepared',revision:0,updatedBy:'media',updatedAt:serverTimestamp()};
 await assertSucceeds(setDoc(ref,publication));await assertSucceeds(updateDoc(ref,{status:'published',revision:1,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{status:'pending',revision:1,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'societies/own/birthdayPublications/member_2026-11-17'),{...publication,date:'2026-11-17'}));
 await assertFails(updateDoc(memberRef(db),{name:'Alterada',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(db,'societies/own/communicationSettings/identity'),{primaryColor:'#145443',accentColor:'#d5b46b',logoDataUrl:'',messageTemplate:'Parabéns, {nome}!',updatedBy:'media',updatedAt:serverTimestamp()}));
});
test('brand identity is owner-managed and Feb 29 publications follow leap-year rules',async()=>{
 const identity={primaryColor:'#145443',accentColor:'#d5b46b',logoDataUrl:'',messageTemplate:'Parabéns, {nome}!',updatedBy:'owner',updatedAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(owner(),'societies/own/communicationSettings/identity'),identity));
 await assertFails(setDoc(doc(owner(),'societies/own/communicationSettings/identity'),{...identity,notes:'private'}));
 const batch=writeBatch(owner());batch.update(memberRef(owner()),{birthDate:'2000-02-29',updatedAt:serverTimestamp()});batch.set(summaryRef(owner()),summary('João Silva',2,29));await batch.commit();await invite();await accept();
 for(const [date,allowed] of [['2027-02-28',true],['2028-02-29',true],['2028-02-28',false]]){
  const action=setDoc(doc(media(),`societies/own/birthdayPublications/member_${date}`),{memberId:'member',date,status:'prepared',revision:0,updatedBy:'media',updatedAt:serverTimestamp()});await (allowed?assertSucceeds(action):assertFails(action));
 }
});

test('an accepted invitation never grants access to another society',async()=>{
 await setDoc(summaryRef(owner()),summary());await invite();await accept();
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'societies/other'),{ownerId:'another',name:'Outra',churchName:'Outra Igreja',type:'UPH'});await setDoc(doc(db,'societies/other/communicationBirthdays/secret'),summary('Pessoa de outra sociedade'));});
 await assertFails(getDoc(doc(media(),'societies/other/communicationBirthdays/secret')));
 await assertFails(setDoc(doc(media(),'societies/other/communicationTeam/media'),{userId:'media',email:'media@example.test',inviteId:'own__media@example.test',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
});
