import { spawn } from 'node:child_process';
import { generate } from './angular-env.mjs';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || process.env.GCLOUD_PROJECT !== 'demo-societas') {
  throw new Error('Execute este script via emulators:exec --project demo-societas.');
}
const run = args => new Promise((resolve,reject) => {
  const child = spawn(process.execPath,args,{stdio:'inherit',env:process.env});
  child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(new Error(`Verificação falhou (${code}).`)));
});
let server;
try {
  await run(['--test','tests/emulator/*.test.mjs']);
  generate('emulator');
  server = spawn(process.execPath,['node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','4200'], {stdio:'inherit',env:{...process.env,NG_BUILD_MAX_WORKERS:'1'}});
  server.on('error',error=>console.error(error.message));
  let ready = false;
  for (let attempt=0;attempt<90;attempt++) {
    if (server.exitCode !== null) throw new Error('Servidor de teste encerrou antes da verificação.');
    try { const response = await fetch('http://127.0.0.1:4200',{signal:AbortSignal.timeout(1000)}); if(response.ok) {ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready) throw new Error('Servidor não ficou disponível para testes.');
  await run(['--test','tests/browser/*.test.mjs']);
} catch(error) { console.error(error.message);process.exitCode=1; }
finally {
  if(server && server.exitCode === null) { server.kill('SIGINT'); await new Promise(resolve=>{server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve();},5000).unref();}); }
  generate('hml');
}
