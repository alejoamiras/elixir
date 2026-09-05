// The committed deployment record is what every surface trusts at boot; its shape and its
// parameters must match the profile the contracts were compiled from.
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import config from '../../../yacana.params.json';
import { PROFILE } from '../../miner-core/src/generated/params.ts';

const repo = resolve(import.meta.dir, '../../..');
type Json = Record<string, unknown>;
const record = (await Bun.file(resolve(repo, `deployments/${PROFILE}.json`)).json()) as Json;
const profile = config.profiles[PROFILE as keyof typeof config.profiles] as Json;

const HEX32 = /^0x[0-9a-f]{64}$/;
const DECIMAL = /^\d+$/;
// Numbers and hex strings in the profile become decimal strings in the record.
const canonical = (v: unknown): unknown =>
  typeof v === 'number' || (typeof v === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(v))
    ? BigInt(v).toString()
    : v;

describe(`deployments/${PROFILE}.json`, () => {
  test('has the record shape', () => {
    expect(record.profile).toBe(PROFILE);
    for (const k of ['deployer', 'miner', 'token', 'minerClassId', 'tokenClassId', 'minerSalt', 'tokenSalt'])
      expect(record[k]).toMatch(HEX32);
    for (const k of ['chainId', 'rollupVersion', 'launchAt']) expect(record[k]).toMatch(DECIMAL);
    const nodeUrl = record.nodeUrl as string;
    expect(new URL(nodeUrl).origin).toBe(nodeUrl);
    expect(new URL(nodeUrl).protocol).toBe('https:');
    const deployedAt = record.deployedAt as string;
    expect(new Date(deployedAt).toISOString()).toBe(deployedAt);
    expect(record.miner).not.toBe(record.token);
  });

  test('params match the compiled profile', () => {
    const params = record.params as Json;
    expect(Object.keys(params).sort()).toEqual(Object.keys(profile).sort());
    for (const [k, v] of Object.entries(profile))
      expect([k, canonical(params[k])]).toEqual([k, canonical(v)]);
  });
});
