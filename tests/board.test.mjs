import test from 'node:test';
import assert from 'node:assert/strict';
import { validBoardYear, boardAssignmentId, validateBoardAssignment, composeBoard, BOARD_ROLES } from '../.test-dist/board.js';
import { emptyMember } from '../.test-dist/domain.js';
const member=(id,name,status='active')=>({...emptyMember(),id,name,status});
const assignment=(year,memberId,role)=>({id:`${year}_${memberId}`,year,memberId,role});

test('board year is a bounded civil integer and assignment ID is deterministic',()=>{
  for(const year of [1900,2026,2100]) assert.equal(validBoardYear(year),true);
  for(const year of [1899,2101,2026.5,NaN,Infinity,'2026',null]) assert.equal(validBoardYear(year),false);
  assert.equal(boardAssignmentId(2026,'ana'),'2026_ana');
  assert.notEqual(boardAssignmentId(2027,'ana'),boardAssignmentId(2026,'ana'));
  for(const [year,id] of [[1899,'ana'],[2026,''],[2026,'a/b'],[2026,'.'],[2026,'..'],[2026,'x'.repeat(129)]]) assert.throws(()=>boardAssignmentId(year,id));
});
test('board validation accepts registered active/inactive members and free roles',()=>{
  const members=[member('ana','Ana'),member('bruno','Bruno','inactive')];
  for(const id of ['ana','bruno']) assert.deepEqual(validateBoardAssignment(2026,id,'  Secretário de atividades  ',members),{});
  assert.deepEqual(validateBoardAssignment(1900,'ana','xx',members),{});
  assert.deepEqual(validateBoardAssignment(2100,'ana','x'.repeat(100),members),{});
  const invalid=validateBoardAssignment(2101,'other',' ',members);
  for(const field of ['year','memberId','role']) assert.ok(invalid[field],field);
  assert.ok(validateBoardAssignment(2026,'ana','x'.repeat(101),members).role);
});
test('board composition orders suggested roles then custom roles and names without mutating input',()=>{
  const members=[member('a','Ana'),member('b','Bruno','inactive'),member('z','Zélia')];
  const source=[assignment(2026,'z','Tesoureiro'),assignment(2026,'b','Presidente'),assignment(2026,'a','Presidente'),assignment(2026,'unknown','Conselheiro'),assignment(2026,'a','Vice-presidente'),assignment(2026,'b','1º Secretário')];
  const before=structuredClone(source);
  const composition=composeBoard(source,members);
  assert.deepEqual(composition.map(entry=>entry.role),['Presidente','Presidente','Vice-presidente','1º Secretário','Tesoureiro','Conselheiro']);
  assert.deepEqual(composition.slice(0,2).map(entry=>entry.member.name),['Ana','Bruno']);
  assert.equal(composition[1].member.status,'inactive');
  assert.equal(composition.at(-1).member,null);
  assert.deepEqual(source,before);
  assert.deepEqual(composeBoard([],members),[]);
  assert.equal(BOARD_ROLES.includes('Presidente'),true);
});
