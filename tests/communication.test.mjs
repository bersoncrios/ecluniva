import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBirthday,communicationEvents,inviteEmail,validInviteEmail,publicationId,birthdayMessage,validIdentity,DEFAULT_IDENTITY } from '../.test-dist/communication.js';
import { cardSize } from '../.test-dist/birthday-card.js';
test('shared birthdays contain only name, month, day and active status',()=>{
 const summary=sharedBirthday({name:'João',birthDate:'1970-11-16',status:'active',phone:'private',notes:'private'});
 assert.deepEqual(summary,{name:'João',month:11,day:16,active:true});
 assert.equal(sharedBirthday({name:'João',birthDate:null,status:'active'}).active,false);
 assert.equal(sharedBirthday({name:'João',birthDate:'1970-11-16',status:'inactive'}).active,false);
});
test('communication calendar spans year boundaries and adapts Feb 29 without birth years',()=>{
 const people=[{id:'a',name:'Ana',month:12,day:31,active:true},{id:'b',name:'Bruno',month:1,day:1,active:true},{id:'c',name:'Carlos',month:2,day:29,active:true},{id:'d',name:'Inativo',month:12,day:31,active:false}];
 assert.deepEqual(communicationEvents(people,'2026-12-31').upcoming.map(event=>event.date),['2026-12-31','2027-01-01']);
 const adapted=communicationEvents(people,'2027-02-28').month[0];assert.equal(adapted.date,'2027-02-28');assert.equal(adapted.adapted,true);
 assert.equal(communicationEvents(people,'2028-02-01').month[0].date,'2028-02-29');
 assert.throws(()=>communicationEvents(people,'invalid'));
});
test('invites, publication IDs and message variables are normalized without expanding arbitrary syntax',()=>{
 assert.equal(inviteEmail(' Media@Example.com '),'media@example.com');
 assert.equal(validInviteEmail('media@example.com'),true);assert.equal(validInviteEmail('invalid'),false);assert.equal(validInviteEmail('a/b@example.com'),false);
 assert.equal(publicationId('member','2026-11-16'),'member_2026-11-16');
 assert.equal(birthdayMessage('Parabéns, {nome}! {sociedade} · {data} {outro}','João','UPH Teste','2026-11-16'),'Parabéns, João! UPH Teste · 16/11 {outro}');
});
test('card formats and brand data have bounded, safe values',()=>{
 assert.deepEqual(cardSize('square'),{width:1080,height:1080});assert.deepEqual(cardSize('portrait'),{width:1080,height:1350});assert.deepEqual(cardSize('story'),{width:1080,height:1920});
 assert.equal(validIdentity(DEFAULT_IDENTITY),true);assert.equal(validIdentity({...DEFAULT_IDENTITY,primaryColor:'red'}),false);assert.equal(validIdentity({...DEFAULT_IDENTITY,logoDataUrl:'https://example.com/logo.svg'}),false);assert.equal(validIdentity({...DEFAULT_IDENTITY,messageTemplate:'x'.repeat(1001)}),false);
});
