import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMember} from '../.test-dist/domain.js';
import {civilDate,attendanceAvailable,emptyMinute,snapshotAttendance,suggestedOfficers,minuteText,validateMinute} from '../.test-dist/minutes.js';

test('attendance changes at society midnight, closes next midnight and remains frozen after conclusion',()=>{
  const minute=emptyMinute('2026-11-15');
  assert.equal(civilDate(new Date('2026-11-15T02:59:59Z'),minute.timeZone),'2026-11-14');
  assert.equal(attendanceAvailable(minute,new Date('2026-11-15T02:59:59Z')),false);
  assert.equal(attendanceAvailable(minute,new Date('2026-11-15T03:00:00Z')),true);
  assert.equal(attendanceAvailable(minute,new Date('2026-11-16T02:59:59Z')),true);
  assert.equal(attendanceAvailable(minute,new Date('2026-11-16T03:00:00Z')),false);
  assert.equal(attendanceAvailable({...minute,status:'concluded'},new Date('2026-11-15T15:00:00Z')),false);
  assert.equal(attendanceAvailable({...minute,timeZone:'Asia/Tokyo'},new Date('2026-11-14T15:00:00Z')),true);
});
test('snapshot deduplicates presence, excludes inactive members and uses only the meeting year',()=>{
  const members=[{...emptyMember(),id:'a',name:'Ana'},{...emptyMember(),id:'b',name:'Bruno'},{...emptyMember(),id:'c',name:'Carlos',status:'inactive'}];
  const assignments=[{id:'1',year:2026,memberId:'a',role:'Presidente'},{id:'2',year:2025,memberId:'b',role:'Presidente'},{id:'3',year:2026,memberId:'b',role:'1º Secretário'}];
  const snapshot=snapshotAttendance(members,assignments,['a','a','b','c','unknown'],2026);
  assert.equal(snapshot.length,2);assert.equal(snapshot[1].role,'1º Secretário');
  assert.deepEqual(suggestedOfficers(snapshot),{presidentId:'a',secretaryId:'b'});
  members[0].name='Alterado';assignments[0].role='Outro';
  assert.deepEqual(snapshot[0],{memberId:'a',name:'Ana',role:'Presidente'});
  const text=minuteText({...emptyMinute(),attendance:snapshot,presidentId:'a',secretaryId:'b'});
  assert.ok(text.includes('2 sócios'));assert.ok(text.includes('Ana (Presidente)'));assert.ok(!text.includes('\n'));
  const canonical=minuteText({...emptyMinute(),societyName:'UPH Palmas Norte',churchName:'Igreja Presbiteriana Palmas Norte',endTime:'11:30',closingPrayer:'Sandro Junior',secretaryId:'secretary',attendance:[{memberId:'secretary',name:'Guilherme Taveira Berson',role:'Secretário'}]});
  assert.ok(canonical.endsWith('Não havendo mais nada para ser tratado, encerrou-se a presente às 11h30min com uma oração pelo Irmão Sandro Junior. E eu Guilherme Taveira Berson, Secretário da União Presbiteriana de Homens da Igreja Presbiteriana Palmas Norte, a tudo presente, lavrei e após lida e aprovada, assino a presente ata.'));

});
test('conclusion requires devotional, closing and present distinct session officers',()=>{
  const minute={...emptyMinute(),churchName:'Igreja',societyName:'UPH',templeAddress:'Rua Um, 1'};
  assert.deepEqual(validateMinute(minute),{});
  const errors=validateMinute(minute,true);
  for(const field of ['attendance','presidentId','secretaryId','scripture','endTime'])assert.ok(errors[field],field);
  assert.ok(validateMinute({...minute,date:'2026-02-30'}).date);
  assert.ok(validateMinute({...minute,year:2025}).year);
  assert.ok(validateMinute({...minute,timeZone:'invalid'}).timeZone);
  const attendance=[{memberId:'a',name:'Ana',role:'Presidente'},{memberId:'b',name:'Bruno',role:'Secretário'}];
  const complete={...minute,attendance,presidentId:'a',secretaryId:'b',startTime:'19:00',devotionalTime:'19:05',endTime:'20:00',convocation:'segunda',scripture:'Salmo 23',preacher:'Ana',openingPrayer:'Bruno',deliberations:'Foi aprovada a proposta.',hymn:'Hino da UPH',closingPrayer:'Ana',logoDataUrl:''};
  assert.deepEqual(validateMinute(complete,true),{});
  assert.ok(validateMinute({...complete,endTime:'18:59'},true).endTime);
  assert.ok(validateMinute({...complete,devotionalTime:'20:01'},true).devotionalTime);
  assert.ok(validateMinute({...complete,devotionalTime:'18:59'},true).devotionalTime);
  assert.ok(validateMinute({...complete,secretaryId:'a'},true).secretaryId);
  assert.ok(validateMinute({...complete,attendance:[...attendance,attendance[0]]},true).attendance);
  const largeRoster=Array.from({length:501},(_,index)=>({memberId:String(index),name:'Sócio '+index,role:''}));
  assert.match(validateMinute({...minute,attendance:largeRoster}).attendance,/500/);
  assert.equal(validateMinute({...minute,attendance:largeRoster.slice(0,500)}).attendance,undefined);
});

test('ata registra primeira ou segunda chamada e exige a escolha para lavrar',()=>{
  const minute=emptyMinute();
  for(const call of ['primeira','segunda']) {
    assert.ok(minuteText({...minute,convocation:call}).includes(`Em ${call} chamada, sob a presidência de `));
    assert.equal(validateMinute({...minute,convocation:call},true).convocation,undefined);
  }
  assert.ok(validateMinute(minute,true).convocation);
  assert.ok(validateMinute({...minute,convocation:'Convocada'},true).convocation);
  assert.ok(minuteText({...minute,status:'concluded',convocation:'Convocada regularmente.'}).includes('Convocada regularmente.'));
});
