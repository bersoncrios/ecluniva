import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv, configFor } from '../scripts/angular-env.mjs';
import { branchEnvironment } from '../scripts/vercel-build.mjs';

const values = project => ({FIREBASE_API_KEY:'fake-api-key',FIREBASE_AUTH_DOMAIN:`${project}.firebaseapp.com`,FIREBASE_PROJECT_ID:project,FIREBASE_STORAGE_BUCKET:`${project}.firebasestorage.app`,FIREBASE_MESSAGING_SENDER_ID:'123',FIREBASE_APP_ID:'1:123:web:test'});

test('env parser supports whitespace, quoted values, CRLF and ignores comments', () => {
  assert.deepEqual(parseEnv('# note\r\n FIREBASE_PROJECT_ID = "societas-hml" \r\nFIREBASE_API_KEY=abc\r\nINVALID LINE\r\nFIREBASE_APP_ID=\'test\'\n'),{FIREBASE_PROJECT_ID:'societas-hml',FIREBASE_API_KEY:'abc',FIREBASE_APP_ID:'test'});
});
test('HML/PROD configuration validates required values and exact project isolation', () => {
  assert.equal(configFor('hml',values('societas-hml')).production,false);
  assert.equal(configFor('hml',values('societas-hml')).useEmulators,false);
  assert.equal(configFor('prod',values('societas-prd')).production,true);
  assert.throws(() => configFor('hml',values('societas-prd')),/HML/);
  assert.throws(() => configFor('prod',values('societas-hml')),/PROD/);
  assert.throws(() => configFor('staging',values('societas-hml')),/inválido/);
  for (const key of Object.keys(values('societas-hml'))) {
    const input=values('societas-hml'); delete input[key];
    assert.throws(() => configFor('hml',input),/ausente/,key);
  }
  assert.throws(() => configFor('hml',{...values('societas-hml'),FIREBASE_API_KEY:'replace-me'}),/ausente/);
  const emulator=configFor('emulator',values('societas-hml'));
  assert.equal(emulator.firebase.projectId,'demo-societas');
  assert.equal(emulator.useEmulators,true);
});
test('branches map explicitly and unknown branches fail closed', () => {
  for(const branch of ['develop','hml']) assert.equal(branchEnvironment(branch),'hml');
  for(const branch of ['main','master']) assert.equal(branchEnvironment(branch),'prod');
  for(const branch of ['feature/test','',undefined,'MAIN']) assert.throws(() => branchEnvironment(branch),/Branch/);
});
test('Vercel production refuses execution without explicit approval flag', () => {
  const result=spawnSync(process.execPath,['scripts/vercel-build.mjs'],{cwd:process.cwd(),env:{...process.env,VERCEL_GIT_COMMIT_REF:'main',SOCIETAS_PROD_APPROVED:'false'},encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/Produção bloqueada/);
});
test('Git ignore excludes actual environments while example contains placeholders only', () => {
  const ignored=readFileSync('.gitignore','utf8');
  assert.match(ignored,/^\.env\.\*$/m);
  assert.match(ignored,/^!\.env\.example$/m);
  const example=readFileSync('.env.example','utf8');
  assert.equal(Object.values(parseEnv(example)).every(value => value.includes('replace-me')),true);
  assert.doesNotMatch(example,/AIza/);
});
