import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PROVERLESS_MARKER } from '../../site/src/config.ts';

const pkg = resolve(import.meta.dir, '..');

/** The miner built with `env`, its scripts' text concatenated. */
function scriptsOf(env: Record<string, string>): string {
  const out = mkdtempSync(join(tmpdir(), 'yacana-proverless-'));
  try {
    execFileSync('bunx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: pkg,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, ...env, YACANA_ASSEMBLE: '1' },
    });
    const dir = join(out, 'assets');
    return readdirSync(dir)
      .filter((f) => /\.m?js$/.test(f))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// Two real builds: the marker must be inseparable from the flag, not a constant that happens to be
// in or out of the bundle. Each build is a few seconds.
describe('the proverless marker is in the flagged bundle and in no production one', () => {
  test('a flagged e2e build carries it', () => {
    expect(
      scriptsOf({ YACANA_SITE_MODE: 'e2e', VITE_E2E_PROVERLESS: '1', VITE_RP_ID: 'localhost' }),
    ).toContain(PROVERLESS_MARKER);
  }, 120_000);

  test('an e2e build without the flag, and a production build, do not', () => {
    expect(
      scriptsOf({ YACANA_SITE_MODE: 'e2e', VITE_E2E_PROVERLESS: '', VITE_RP_ID: 'localhost' }),
    ).not.toContain(PROVERLESS_MARKER);
    expect(scriptsOf({ YACANA_SITE_MODE: 'production', VITE_E2E_PROVERLESS: '1' })).not.toContain(
      PROVERLESS_MARKER,
    );
  }, 240_000);
});
