// `bun run test:visual [--update-snapshots]`: the fixture-only server, the screenshot spec inside
// the pinned Playwright image (Chromium and the system's text stack are the baselines' other
// half), teardown. CI runs the job inside that image already and says so.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const IMAGE = 'mcr.microsoft.com/playwright:v1.62.1-noble';
const pkg = resolve(import.meta.dir, '..');
const repo = resolve(pkg, '../..');

const setup = (command: 'serve' | 'teardown') =>
  spawnSync('bun', ['e2e/visual-setup.ts', command], { cwd: pkg, stdio: 'inherit', env: process.env });

const playwright = [
  'node_modules/@playwright/test/cli.js',
  'test',
  '-c',
  'packages/web-stats/playwright.visual.config.ts',
  ...process.argv.slice(2),
];
/**
 * Rootless Docker maps the host user onto the container's root; a numeric --user would land on a
 * subordinate uid with no access to the mounted repo. Rootful Docker needs the host user instead,
 * or the baselines come back owned by root.
 */
const asHostUser = (): string[] => {
  const info = spawnSync('docker', ['info', '-f', '{{json .SecurityOptions}}'], { encoding: 'utf8' });
  if ((info.stdout ?? '').includes('rootless')) return [];
  return ['--user', `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`];
};

const command =
  process.env.PLAYWRIGHT_VISUAL_IN_IMAGE === '1'
    ? ['node', ...playwright]
    : [
        'docker',
        'run',
        '--rm',
        '--network',
        'host',
        '--ipc',
        'host',
        ...asHostUser(),
        '-e',
        'HOME=/tmp',
        '-e',
        'CI',
        '-v',
        `${repo}:/work`,
        '-w',
        '/work',
        IMAGE,
        'node',
        ...playwright,
      ];

if (setup('serve').status !== 0) process.exit(1);
const status = spawnSync(command[0] as string, command.slice(1), { cwd: repo, stdio: 'inherit' }).status ?? 1;
setup('teardown');
process.exit(status);
