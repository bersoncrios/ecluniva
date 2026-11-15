import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc','-p','tsconfig.domain.json'], {stdio:'inherit'});
if (compile.status !== 0) process.exit(compile.status ?? 1);
mkdirSync('.test-dist', {recursive:true});
writeFileSync('.test-dist/package.json', '{"type":"module"}');
const tests = spawnSync(process.execPath, ['--test','tests/*.test.mjs'], {stdio:'inherit'});
process.exitCode = tests.status ?? 1;
