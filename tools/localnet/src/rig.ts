// `bun run rig -- <case>…|all`: the harness cases by name (`flip`, `bridge`, `deposit`, `migration`,
// `skip-version`, `never-settled`) on the upgrade rig, each a file under tools/harness/tests; `all`
// or no name runs them all. Long: every case boots an isolated network.
import { resolve } from 'node:path';
import { repoRoot } from './toolchain.ts';

const cases = process.argv.slice(2).filter((a) => a !== '--' && a !== 'all');
const files = cases.length
  ? cases.map((c) => resolve(repoRoot, `tools/harness/tests/${c}.bun.test.ts`))
  : [resolve(repoRoot, 'tools/harness/tests')];
const child = Bun.spawn(['bun', 'test', '--timeout', '1800000', ...files], {
  cwd: repoRoot,
  env: { ...process.env, YACANA_RIG: '1' },
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(await child.exited);
