import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function branchEnvironment(branch) {
  if (['develop','hml'].includes(branch)) return 'hml';
  if (['main','master'].includes(branch)) return 'prod';
  throw new Error('Branch sem ambiente definido. Use develop/hml ou main/master.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const git = spawnSync('git', ['branch','--show-current'], {encoding:'utf8'});
    const mode = branchEnvironment(process.env.VERCEL_GIT_COMMIT_REF || git.stdout?.trim());
    if (mode === 'prod' && process.env.SOCIETAS_PROD_APPROVED !== 'true') throw new Error('Produção bloqueada. Após aprovação do dono, configure SOCIETAS_PROD_APPROVED=true na Vercel.');
    const result = spawnSync(process.execPath, ['scripts/angular-env.mjs','build',mode], {stdio:'inherit'});
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
