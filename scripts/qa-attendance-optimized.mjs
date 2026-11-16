// Run through emulators:exec. Validate the shipped module format, not Vite's
// development interop: CommonJS modules can expose only `default` after build.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generate } from './angular-env.mjs';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || process.env.GCLOUD_PROJECT !== 'demo-societas') {
  throw new Error('Execute via emulators:exec --project demo-societas.');
}
const run = (args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, {stdio:'inherit', env});
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Verificação falhou (${code}).`)));
});
const directory = await mkdtemp(path.join(tmpdir(), 'quadrei-presence-optimized-'));
let server;
try {
  generate('emulator');
  await run(['node_modules/@angular/cli/bin/ng.js','build','--configuration','production','--output-path',directory], {...process.env, NG_BUILD_MAX_WORKERS:'1'});
  const root = path.join(directory, 'browser');
  const types = {'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'};
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) {response.writeHead(403).end();return;}
      const body = await readFile(file);
      response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
      response.end(body);
    } catch {response.writeHead(404).end();}
  });
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  await run(['--test','tests/browser/attendance.test.mjs'], {...process.env, QUADREI_BASE_URL:`http://127.0.0.1:${server.address().port}`});
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  generate('hml');
  await rm(directory, {recursive:true, force:true});
}
