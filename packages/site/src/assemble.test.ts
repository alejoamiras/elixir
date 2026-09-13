import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  type AssemblySteps,
  assemble,
  buildRecord,
  OLD_OUT,
  PRODUCTION_OUT,
  productionOutFor,
  REDIRECTS,
  witnessFiles,
} from './assemble.ts';
import type { SiteConfig } from './config.ts';

/** Every app's build writes one script where Vite would; the asset copies do nothing. */
const stubbed = (script: string): AssemblySteps => ({
  buildApp: (_name, _base, outDir) => {
    mkdirSync(join(outDir, 'assets'), { recursive: true });
    writeFileSync(join(outDir, 'assets/index-abc.js'), script);
  },
  fetchCrs: async () => {},
  copyArtifacts: async () => {},
  copySlots: async () => 'slots: stubbed',
});

const outs: string[] = [];
const scratch = () => {
  const o = mkdtempSync(join(tmpdir(), 'yacana-assemble-'));
  outs.push(o);
  return o;
};
afterEach(() => {
  for (const o of outs.splice(0)) rmSync(o, { recursive: true, force: true });
});

describe('assembly inspects what it emitted', () => {
  const production = { YACANA_SITE_MODE: 'production', GITHUB_SHA: 'abc' };

  test('a clean production assembly completes, in its role’s directory only', async () => {
    const steps = stubbed('fetch("https://node.example/rpc")');
    // The role directories are real deliverables: they are asserted on the pairing, never written by a test.
    await expect(assemble(scratch(), production, steps)).rejects.toThrow(/a production apex build lands in/);
    await expect(assemble(scratch(), { ...production, YACANA_APP_ROLE: 'old' }, steps)).rejects.toThrow(
      /a production old build lands in .*dist-old/,
    );
    expect(productionOutFor('apex')).toBe(PRODUCTION_OUT);
    expect(productionOutFor('old')).toBe(OLD_OUT);
    expect(OLD_OUT).not.toBe(PRODUCTION_OUT);
  });

  test('a production assembly whose emitted script names a loopback origin fails', async () => {
    const steps = stubbed('const node = "http://127.0.0.1:24567/rpc"');
    await expect(assemble(PRODUCTION_OUT, production, steps)).rejects.toThrow(
      /names a plaintext loopback origin/,
    );
  });

  test('an e2e assembly into its own directory is held to no production contract', async () => {
    const steps = stubbed('const node = "http://127.0.0.1:24567/rpc"');
    await expect(
      assemble(scratch(), { YACANA_SITE_MODE: 'e2e', GITHUB_SHA: 'abc' }, steps),
    ).resolves.toMatchObject({ mode: 'e2e' });
  });
});

describe('assembly', () => {
  test('the witness archives are served by rollup version, only for profiles with a record', () => {
    const repoDir = scratch();
    mkdirSync(join(repoDir, 'deployments/witnesses'), { recursive: true });
    writeFileSync(join(repoDir, 'deployments/testnet.json'), JSON.stringify({ rollupVersion: '1821665230' }));
    writeFileSync(join(repoDir, 'deployments/witnesses/testnet.jsonl'), '');
    writeFileSync(join(repoDir, 'deployments/witnesses/orphan.jsonl'), '');
    writeFileSync(join(repoDir, 'deployments/witnesses/notes.txt'), '');
    expect(witnessFiles(repoDir).map((w) => w.to)).toEqual(['witnesses/1821665230.jsonl']);
    expect(witnessFiles(join(repoDir, 'nowhere'))).toEqual([]);
  });

  test('the rewrites are exact sources to directory targets: no splat, no .html', () => {
    expect(REDIRECTS).toEqual([
      '/mine/wallet /mine/ 200',
      '/mine/settings /mine/ 200',
      '/stats/verify /stats/ 200',
      '/stats/bridge /stats/ 200',
      '/verify /stats/ 200',
    ]);
    for (const rule of REDIRECTS) expect(rule).toMatch(/^\/[a-z/]+ \/(mine|stats)\/ 200$/);
  });

  test('a mode that is not one of the three is refused before anything is built', async () => {
    await expect(assemble('/tmp/never-written', { YACANA_SITE_MODE: 'Production' })).rejects.toThrow(
      /YACANA_SITE_MODE="Production"/,
    );
  });

  test('an e2e build can land neither in a production directory nor on Cloudflare', async () => {
    await expect(assemble(PRODUCTION_OUT, { YACANA_SITE_MODE: 'e2e' })).rejects.toThrow(
      /production builds only/,
    );
    await expect(assemble(OLD_OUT, { YACANA_SITE_MODE: 'e2e', YACANA_APP_ROLE: 'old' })).rejects.toThrow(
      /production builds only/,
    );
    await expect(
      assemble(relative(process.cwd(), PRODUCTION_OUT), { YACANA_SITE_MODE: 'e2e' }),
    ).rejects.toThrow(/production builds only/);
    await expect(assemble('/tmp/never-written', { YACANA_SITE_MODE: 'e2e', CF_PAGES: '1' })).rejects.toThrow(
      /production builds only/,
    );
  });

  test('build.json says what was built and nothing more: the role and the deployment beside the mode', () => {
    const c = {
      mode: 'production',
      sourceCommit: 'abc',
      rpId: 'yacana.network',
      nodeUrl: 'https://node.example',
      role: 'old',
      rollupVersion: '5',
      miner: '0xabc',
    } as SiteConfig;
    expect(buildRecord(c)).toEqual({
      mode: 'production',
      commit: 'abc',
      nodeOrigin: 'https://node.example',
      rpId: 'yacana.network',
      role: 'old',
      rollupVersion: '5',
      miner: '0xabc',
    });
  });
});
