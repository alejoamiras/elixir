// `bun run rig -- <case>…`: the harness cases by name (`flip`, …) on the upgrade rig, each a file under
// packages/harness/tests; no name runs them all. Long: every case boots an isolated network.
import { resolve } from 'node:path';
import { repoRoot } from './toolchain.ts';

const cases = process.argv.slice(2).filter((a) => a !== '--');
const files = cases.length
  ? cases.map((c) => resolve(repoRoot, `packages/harness/tests/${c}.bun.test.ts`))
  : [resolve(repoRoot, 'packages/harness/tests')];
const child = Bun.spawn(['bun', 'test', '--timeout', '1800000', ...files], {
  cwd: repoRoot,
  env: { ...process.env, YACANA_RIG: '1' },
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(await child.exited);
