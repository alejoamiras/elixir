import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type DeploymentRecord, loadSiteConfig, parseEnvFile, viteDefine } from './config.ts';

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
      env: { VITE_AZTEC_NODE_URL: 'http://localhost:1', VITE_E2E_QUERY_OVERRIDES: '1' },
    });
    expect(c.nodeUrl).toBe(siteEnv.VITE_AZTEC_NODE_URL);
    expect(c.rpId).toBe('yacana.network');
    expect(c.miner).toBe(deployment.miner);
    expect(c.minerClassId).toBe(deployment.minerClassId);
    expect(c.queryOverrides).toBe(false);
    expect(viteDefine(c)['import.meta.env.VITE_E2E_QUERY_OVERRIDES']).toBe('""');
  });

  test('e2e lets the environment override every value, including the override flag', () => {
    const c = loadSiteConfig({
      ...base,
      mode: 'e2e',
      env: {
        VITE_AZTEC_NODE_URL: 'http://localhost:8080',
        VITE_ALLOWED_NODE_ORIGINS: 'http://localhost:8080,http://127.0.0.1:1',
        VITE_RP_ID: 'localhost',
        VITE_YACANA_MINER: '0x01',
        VITE_E2E_QUERY_OVERRIDES: '1',
      },
    });
    expect(c.allowedNodeOrigins).toEqual(['http://localhost:8080', 'http://127.0.0.1:1']);
    expect(c.rpId).toBe('localhost');
    expect(c.miner).toBe('0x01');
    expect(c.token).toBe(deployment.token);
    expect(c.queryOverrides).toBe(true);
  });

  test('production refuses a placeholder RP ID, a local or plaintext node, and the e2e flag', () => {
    const attempt = (siteEnvPatch: Record<string, string>) => () =>
      loadSiteConfig({ ...base, mode: 'production', siteEnv: { ...siteEnv, ...siteEnvPatch } });
    expect(attempt({ VITE_RP_ID: 'localhost' })).toThrow(/not a production hostname/);
    expect(attempt({ VITE_RP_ID: 'yacana' })).toThrow(/not a production hostname/);
    expect(
      attempt({
        VITE_AZTEC_NODE_URL: 'http://localhost:8080',
        VITE_ALLOWED_NODE_ORIGINS: 'http://localhost:8080',
      }),
    ).toThrow(/not https/);
    expect(
      attempt({ VITE_AZTEC_NODE_URL: 'https://10.0.0.1', VITE_ALLOWED_NODE_ORIGINS: 'https://10.0.0.1' }),
    ).toThrow(/is local/);
    expect(attempt({ VITE_ALLOWED_NODE_ORIGINS: 'https://other.example' })).toThrow(/not among/);
  });

  test('parseEnvFile ignores comments and rejects a line without a key', () => {
    expect(parseEnvFile('# c\nA=1\n\nB = x=y\n')).toEqual({ A: '1', B: 'x=y' });
    expect(() => parseEnvFile('=1')).toThrow(/malformed/);
  });
});
