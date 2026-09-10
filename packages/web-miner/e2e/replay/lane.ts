// `bun run test:replay [playwright args…]`: prebuild, then the replay lane; no node is started.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const pkg = resolve(import.meta.dir, '../..');
const run = (cmd: string[]) =>
  spawnSync(cmd[0] as string, cmd.slice(1), { cwd: pkg, stdio: 'inherit' }).status ?? 1;

const prebuild = run(['bun', 'scripts/prebuild.ts']);
if (prebuild !== 0) process.exit(prebuild);
process.exit(
  run([
    'bunx',
    'playwright',
    'test',
    '-c',
    'playwright.replay.config.ts',
    ...process.argv.slice(2).filter((a) => a !== '--'),
  ]),
);
