import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presenceMatches, normalizedPresenceName, presenceToken} from '../.test-dist/attendance.js';
const member=(id,name,status='active')=>({id,name,status});
test('presence matches exact full names ignoring accents, spaces and case',()=>{
  assert.equal(normalizedPresenceName('  JOÃO   da Silva '),'joao da silva');
  assert.deepEqual(presenceMatches('JOAO DA SILVA',[member('a','João da Silva'),member('b','João Silva')]),['a']);
  assert.deepEqual(presenceMatches('João',[member('a','João')]),[]);
  assert.deepEqual(presenceMatches('João Silva',[member('a','João da Silva')]),[]);
});
test('homonyms remain ambiguous and inactive members never match',()=>{
  assert.deepEqual(presenceMatches('João Silva',[member('a','João Silva'),member('b','Joao Silva'),member('c','João Silva','inactive')]),['a','b']);
  assert.deepEqual(presenceMatches('João Silva',[member('a','João Silva','inactive')]),[]);
});
test('links and receipts use independent cryptographically random capabilities',()=>{
  const values=Array.from({length:100},()=>presenceToken());
  assert.ok(values.every(value=>/^[a-f0-9]{48}$/.test(value)));
  assert.equal(new Set(values).size,100);
});
