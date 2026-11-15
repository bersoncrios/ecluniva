import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (match) result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return result;
}
export function configFor(mode, values) {
  if (!['hml', 'prod', 'emulator'].includes(mode)) throw new Error('Ambiente inválido. Use hml, prod ou emulator.');
  const fields = { apiKey:'API_KEY', authDomain:'AUTH_DOMAIN', projectId:'PROJECT_ID', storageBucket:'STORAGE_BUCKET', messagingSenderId:'MESSAGING_SENDER_ID', appId:'APP_ID', measurementId:'MEASUREMENT_ID' };
  const firebase = Object.fromEntries(Object.entries(fields).map(([key, env]) => [key, values['FIREBASE_' + env] || '']));
  if (mode === 'emulator') Object.assign(firebase, {apiKey:'demo-societas-key',authDomain:'demo-societas.firebaseapp.com',projectId:'demo-societas',storageBucket:'demo-societas.appspot.com',messagingSenderId:'123456789',appId:'1:123456789:web:demo',measurementId:''});
  for (const [key, value] of Object.entries(firebase)) {
    if (key !== 'measurementId' && (!value || value.includes('replace-me'))) throw new Error(`Configuração Firebase ausente: ${key}`);
  }
  if (mode === 'emulator') {
    firebase.projectId = 'demo-societas';
    firebase.authDomain = 'demo-societas.firebaseapp.com';
  }
  if (mode === 'hml' && firebase.projectId !== 'societas-hml') throw new Error('HML deve usar societas-hml.');
  if (mode === 'prod' && firebase.projectId !== 'societas-prd') throw new Error('PROD deve usar societas-prd.');
  return { production: mode === 'prod', mode, useEmulators: mode === 'emulator', firebase };
}
export function generate(mode) {
  let local = {};
  try { if (mode !== 'emulator') local = parseEnv(readFileSync(`.env.${mode}`, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = configFor(mode, { ...local, ...process.env });
  mkdirSync('src/environments', { recursive:true });
  const contents = '// Gerado por scripts/angular-env.mjs; não versionar.\nexport const environment = ' + JSON.stringify(config, null, 2) + ' as const;\n';
  writeFileSync('src/environments/environment.ts', contents);
  if (mode === 'prod') writeFileSync('src/environments/environment.prod.ts', contents);
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [command = 'build', mode = 'hml', ...args] = process.argv.slice(2);
    if (!['build','serve','generate'].includes(command)) throw new Error('Comando inválido.');
    generate(mode);
    if (command !== 'generate') {
      const result = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', command, ...(command === 'build' ? ['--configuration', 'production'] : []), ...args], { stdio:'inherit', env:{...process.env, NG_BUILD_MAX_WORKERS: process.env.NG_BUILD_MAX_WORKERS || '1'} });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
