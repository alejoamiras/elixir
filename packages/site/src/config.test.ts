import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type DeploymentRecord,
  type ExampleClaim,
  loadSiteConfig,
  parseEnvFile,
  siteModeFrom,
  viteDefine,
} from './config.ts';

const siteEnv = parseEnvFile(readFileSync(resolve(import.meta.dir, '../site.env'), 'utf8'));
const deployment = JSON.parse(
  readFileSync(resolve(import.meta.dir, '../../../deployments/testnet.json'), 'utf8'),
) as DeploymentRecord;
const base = { siteEnv, deployment, sourceCommit: 'abc', bbVersion: '5.2.0' };

describe('site config', () => {
  test('production takes site.env and the record and ignores the process environment', () => {
    const c = loadSiteConfig({
      ...base,
      mode: 'production',
      env: {
        VITE_AZTEC_NODE_URL: 'http://localhost:1',
        VITE_E2E_QUERY_OVERRIDES: '1',
        VITE_PRESTO_E2E_PORT: '59833',
        VITE_E2E_PROVERLESS: '1',
      },
    });
    expect(c.nodeUrl).toBe(siteEnv.VITE_AZTEC_NODE_URL);
    expect(c.proverless).toBe(false);
    // A hostile e2e environment cannot hand production a plaintext Presto port.
    expect(c.prestoE2ePort).toBe('');
    expect(viteDefine(c)['import.meta.env.VITE_PRESTO_E2E_PORT']).toBe('""');
    expect(c.rpId).toBe('yacana.network');
    expect(c.previewHostSuffix).toBe('-yacana.alejo-amiras.workers.dev');
    expect(viteDefine(c)['import.meta.env.VITE_PREVIEW_HOST_SUFFIX']).toBe(
      '"-yacana.alejo-amiras.workers.dev"',
    );
    expect(c.miner).toBe(deployment.miner);
    expect(c.minerClassId).toBe(deployment.minerClassId);
    expect(c.queryOverrides).toBe(false);
    expect(c.launchMode).toBe(false);
    expect(c.explorerUrl).toBe('https://testnet.aztecscan.xyz');
    expect(viteDefine(c)['import.meta.env.VITE_E2E_QUERY_OVERRIDES']).toBe('""');
    expect(viteDefine(c)['import.meta.env.VITE_E2E_PROVERLESS']).toBe('""');
    expect(viteDefine(c)['import.meta.env.VITE_EXPLORER_URL']).toBe('"https://testnet.aztecscan.xyz"');
  });

  test('e2e lets the environment override every value, including the override flag', () => {
    const c = loadSiteConfig({
      ...base,
      mode: 'e2e',
      env: {
        VITE_AZTEC_NODE_URL: 'http://localhost:8080',
        VITE_ROLLUP_ADDRESS: '0x00000000000000000000000000000000000000aa',
        VITE_RP_ID: 'localhost',
        VITE_YACANA_MINER: '0x01',
        VITE_E2E_QUERY_OVERRIDES: '1',
        VITE_LAUNCH_MODE: '1',
        VITE_EXPLORER_URL: 'off',
        VITE_PRESTO_E2E_PORT: '24996',
        VITE_E2E_PROVERLESS: '1',
      },
    });
    // The proverless flag needs the exact mode `e2e`: a dev build with it set still proves.
    expect(loadSiteConfig({ ...base, mode: 'dev', env: { VITE_E2E_PROVERLESS: '1' } }).proverless).toBe(
      false,
    );
    expect(c.launchMode).toBe(true);
    expect(c.prestoE2ePort).toBe('24996');
    expect(viteDefine(c)['import.meta.env.VITE_PRESTO_E2E_PORT']).toBe('"24996"');
    expect(c.proverless).toBe(true);
    expect(viteDefine(c)['import.meta.env.VITE_E2E_PROVERLESS']).toBe('"1"');
    expect(c.explorerUrl).toBe('off');
    expect(c.nodeUrl).toBe('http://localhost:8080');
    expect(c.rollupAddress).toBe('0x00000000000000000000000000000000000000aa');
    expect(c.record.rollupAddress).toBe('0x00000000000000000000000000000000000000aa');
    expect(c.rpId).toBe('localhost');
    expect(c.miner).toBe('0x01');
    expect(c.token).toBe(deployment.token);
    expect(c.queryOverrides).toBe(true);
  });

  test("the example claim ships only when it is this deployment's and well formed", () => {
    const claim = JSON.parse(
      readFileSync(resolve(import.meta.dir, '../../../deployments/testnet.example-claim.json'), 'utf8'),
    ) as ExampleClaim;
    const c = loadSiteConfig({ ...base, mode: 'production', exampleClaim: claim });
    expect(JSON.parse(viteDefine(c)['import.meta.env.VITE_EXAMPLE_CLAIM'] as string)).toBe(
      JSON.stringify(claim),
    );
    expect(
      viteDefine(loadSiteConfig({ ...base, mode: 'production' }))['import.meta.env.VITE_EXAMPLE_CLAIM'],
    ).toBe('""');
    const foreign = { ...claim, miner: `0x${'2'.padStart(64, '0')}` };
    expect(() => loadSiteConfig({ ...base, mode: 'production', exampleClaim: foreign })).toThrow(
      /another deployment/,
    );
    for (const bad of [
      { claims: [1, 3] },
      { claims: [-1, 0] },
      { claims: [4, 5] },
      { claims: [0.5, 1.5] },
      { claims: ['1', '2'] },
      { block: -1 },
      { block: 7.5 },
      { txHash: '0x12' },
    ] as Partial<ExampleClaim>[])
      expect(() =>
        loadSiteConfig({ ...base, mode: 'production', exampleClaim: { ...claim, ...bad } }),
      ).toThrow(/malformed/);
    // An e2e build's identity overrides move the bar: the testnet claim is foreign to a throwaway deployment.
    expect(() =>
      loadSiteConfig({
        ...base,
        mode: 'e2e',
        exampleClaim: claim,
        env: { VITE_YACANA_MINER: `0x${'3'.padStart(64, '0')}` },
      }),
    ).toThrow(/another deployment/);
  });

  test('production refuses a placeholder RP ID, a local or plaintext node, and the e2e flag', () => {
    const attempt = (siteEnvPatch: Record<string, string>) => () =>
      loadSiteConfig({ ...base, mode: 'production', siteEnv: { ...siteEnv, ...siteEnvPatch } });
    expect(attempt({ VITE_RP_ID: 'localhost' })).toThrow(/not a production hostname/);
    expect(attempt({ VITE_RP_ID: 'yacana' })).toThrow(/not a production hostname/);
    expect(attempt({ VITE_AZTEC_NODE_URL: 'http://localhost:8080' })).toThrow(/not https/);
    expect(attempt({ VITE_AZTEC_NODE_URL: 'https://10.0.0.1' })).toThrow(/is local/);
    expect(attempt({ VITE_EXPLORER_URL: 'http://explorer.example' })).toThrow(/explorer .* not https/);
    expect(attempt({ VITE_EXPLORER_URL: 'off' })).not.toThrow();
  });

  test('the preview suffix: production takes the committed shape or none; other modes never have one', () => {
    const production = (VITE_PREVIEW_HOST_SUFFIX: string) =>
      loadSiteConfig({
        ...base,
        mode: 'production',
        siteEnv: { ...siteEnv, VITE_PREVIEW_HOST_SUFFIX },
        env: { VITE_PREVIEW_HOST_SUFFIX: '-yacana.attacker.workers.dev' },
      });
    expect(production('').previewHostSuffix).toBe('');
    expect(production('-yacana.alejo-amiras.workers.dev').previewHostSuffix).toBe(
      '-yacana.alejo-amiras.workers.dev',
    );
    for (const bad of [
      'yacana.alejo-amiras.workers.dev',
      '-yacana.alejo-amiras.pages.dev',
      '.workers.dev',
      '-a.b.c.workers.dev',
    ])
      expect(() => production(bad)).toThrow(/preview host suffix/);
    for (const mode of ['e2e', 'dev'] as const) {
      const c = loadSiteConfig({ ...base, mode, env: { VITE_PREVIEW_HOST_SUFFIX: '-yacana.x.workers.dev' } });
      expect(c.previewHostSuffix).toBe('');
      expect(viteDefine(c)['import.meta.env.VITE_PREVIEW_HOST_SUFFIX']).toBe('""');
    }
  });

  test('the mode is one of three words or an error, never a fourth mode by typo', () => {
    expect(siteModeFrom(undefined, 'production')).toBe('production');
    expect(siteModeFrom('', 'dev')).toBe('dev');
    expect(siteModeFrom('e2e', 'production')).toBe('e2e');
    for (const bad of ['Production', 'prod', 'e2e ', 'test'])
      expect(() => siteModeFrom(bad, 'production')).toThrow(/YACANA_SITE_MODE=/);
  });

  test('parseEnvFile ignores comments and rejects a line without a key', () => {
    expect(parseEnvFile('# c\nA=1\n\nB = x=y\n')).toEqual({ A: '1', B: 'x=y' });
    expect(() => parseEnvFile('=1')).toThrow(/malformed/);
  });
});
