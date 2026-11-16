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
  assert.deepEqual(snapshot[0],{memberId:'a',name:'Ana',role:'Presidente',office:''});
  const text=minuteText({...emptyMinute(),attendance:snapshot,presidentId:'a',secretaryId:'b'});
  assert.ok(text.includes('2 sócios'));assert.ok(text.includes('Ana (Presidente)'));assert.ok(!text.includes('\n'));
  const canonical=minuteText({...emptyMinute(),societyName:'UPH Palmas Norte',churchName:'Igreja Presbiteriana Palmas Norte',endTime:'11:30',closingPrayer:'Sandro Junior',secretaryId:'secretary',attendance:[{memberId:'secretary',name:'Guilherme Taveira Berson',role:'Secretário'}]});
  assert.ok(canonical.endsWith('Não havendo mais nada para ser tratado, encerrou-se a presente às 11h30min com uma oração pelo Irmão Sandro Junior. E eu Guilherme Taveira Berson, Secretário da União Presbiteriana de Homens da Igreja Presbiteriana Palmas Norte, a tudo presente, lavrei e após lida e aprovada, assino a presente ata.'));

});
test('conclusion requires devotional, closing and present distinct session officers',()=>{
  const minute={...emptyMinute(),churchName:'Igreja',societyName:'UPH',meetingLocation:'Templo da igreja',templeAddress:'Rua Um, 1'};
  assert.deepEqual(validateMinute(minute),{});
  const errors=validateMinute(minute,true);
  for(const field of ['attendance','presidentId','secretaryId','scripture','endTime'])assert.ok(errors[field],field);
  assert.ok(validateMinute({...minute,date:'2026-02-30'}).date);
  assert.ok(validateMinute({...minute,year:2025}).year);
  assert.ok(validateMinute({...minute,timeZone:'invalid'}).timeZone);
  const attendance=[{memberId:'a',name:'Ana',role:'Presidente'},{memberId:'b',name:'Bruno',role:'Secretário'}];
  const complete={...minute,attendance,presidentId:'a',secretaryId:'b',startTime:'19:00',devotionalTime:'19:05',endTime:'20:00',convocation:'segunda',scripture:'Salmo 23',preacher:'Ana',openingPrayer:'Bruno',deliberations:'Foi aprovada a proposta.',hymn:'',closingPrayer:'Ana',logoDataUrl:''};
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

test('cabeçalho usa o número escolhido sem sufixo de ano',()=>{
  const text=minuteText({...emptyMinute('2026-11-16'),number:25});
  assert.ok(text.startsWith('ATA Nº 025. Aos '));
  assert.ok(!text.includes('025/2026'));
});

test('local da reunião é separado do endereço e aceita residência',()=>{
  const minute={...emptyMinute(),meetingLocation:'Casa do irmão João',templeAddress:'Rua da Paz, 25'};
  assert.ok(minuteText(minute).includes('na casa do irmão João, no endereço Rua da Paz, 25.'));
  assert.ok(minuteText({...minute,meetingLocation:'na casa do irmão João'}).includes('na casa do irmão João, no endereço'));
  assert.ok(minuteText({...minute,meetingLocation:'Templo da igreja'}).includes('no templo da igreja, no endereço'));
  assert.equal(validateMinute(minute).meetingLocation,undefined);
  assert.ok(validateMinute({...minute,meetingLocation:''}).meetingLocation);
  assert.ok(validateMinute({...minute,meetingLocation:'a'.repeat(161)}).meetingLocation);
  assert.ok(minuteText({...minute,meetingLocation:undefined,status:'concluded'}).includes('no templo situado à Rua da Paz, 25.'));
});

test('ofícios acompanham nomes na presidência, redação, orações e exposição, sem duplicar títulos',()=>{
  const members=[{...emptyMember(),id:'a',name:'João Silva',office:'Diacono'},{...emptyMember(),id:'b',name:'José Lima',office:'Presbítero'}];
  const attendance=snapshotAttendance(members,[],['a','b'],2026);
  const minute={...emptyMinute(),attendance,presidentId:'a',secretaryId:'b',openingPrayer:'joao silva',preacher:'José Lima',closingPrayer:'Irmão João Silva'};
  const text=minuteText(minute);
  for(const part of ['presidência de Diácono João Silva','oração inicial por Diácono João Silva','exposição por Presbítero José Lima','oração pelo Diácono João Silva','E eu Presbítero José Lima'])assert.ok(text.includes(part),part);
  assert.ok(!text.includes('Irmão Diácono'));
  assert.ok(!minuteText({...minute,closingPrayer:'Diácono João Silva'}).includes('Diácono Diácono'));
  members[0].office='Presbítero';members[1].name='Outro nome';
  assert.equal(minuteText(minute),text);
  assert.ok(minuteText({...minute,attendance:attendance.map(({office,...person})=>person)}).includes('presidência de João Silva'));
});
test('hino só aparece quando o número é preenchido e pode ficar em branco',()=>{
  const minute=emptyMinute();
  for(const hymn of ['', '   ']) {
    assert.ok(!minuteText({...minute,hymn}).includes('hino'));
    assert.equal(validateMinute({...minute,hymn},true).hymn,undefined);
  }
  assert.ok(minuteText({...minute,hymn:'123'}).includes('Foi entoado o hino nº 123.'));
  assert.ok(validateMinute({...minute,hymn:'Hino de teste'}).hymn);
  assert.ok(validateMinute({...minute,hymn:'0'}).hymn);
});

test('deletion needs exact minute phrase and a meaningful bounded reason; deleted meetings have no attendance',async()=>{
 const {minuteDeletionPhrase,validMinuteDeletion}=await import('../.test-dist/minutes.js');
 for(const [number,phrase] of [[1,'EXCLUIR ATA 001'],[12,'EXCLUIR ATA 012'],[123,'EXCLUIR ATA 123'],[1234,'EXCLUIR ATA 1234']]){
  assert.equal(minuteDeletionPhrase(number),phrase);assert.equal(validMinuteDeletion(number,phrase,'Agendamento duplicado.'),true);
  assert.equal(validMinuteDeletion(number,phrase.toLowerCase(),'Agendamento duplicado.'),false);
 }
 assert.equal(validMinuteDeletion(1,'EXCLUIR ATA 002','Agendamento duplicado.'),false);
 assert.equal(validMinuteDeletion(1,'EXCLUIR ATA 001','   curto   '),false);
 assert.equal(validMinuteDeletion(1,'EXCLUIR ATA 001','x'.repeat(501)),false);
 assert.equal(attendanceAvailable({...emptyMinute('2026-11-15'),deletedAt:{}},new Date('2026-11-15T15:00:00Z')),false);
});
