import { describe, expect, test } from 'vitest';
import type { NodeProbe } from '../../../site/src/browser/node.ts';
import { type CheckState, canUse, checkReducer, describeProbe } from './node-check.ts';

const probe: NodeProbe = {
  chainId: 31337n,
  rollupVersion: 5n,
  rollupAddress: '0xab',
  block: 73164,
  blockAgeS: 3,
  latencyMs: 96.4,
};
const A = 'https://a.example/rpc';
const B = 'https://b.example/rpc';

describe('the Node tile check machine', () => {
  test('a check owns its answer; another URL’s answer is stale', () => {
    let s: CheckState = checkReducer({ kind: 'idle' }, { type: 'check', url: A });
    expect(s).toEqual({ kind: 'checking', url: A });
    expect(checkReducer(s, { type: 'ok', url: B, probe })).toBe(s);
    s = checkReducer(s, { type: 'ok', url: A, probe });
    expect(s).toEqual({ kind: 'ok', url: A, probe });
    expect(checkReducer(s, { type: 'failed', url: A, message: 'late' })).toBe(s);
  });

  test('editing resets everything but a switch in progress', () => {
    const ok = checkReducer({ kind: 'checking', url: A }, { type: 'ok', url: A, probe });
    expect(checkReducer(ok, { type: 'edit' })).toEqual({ kind: 'idle' });
    const switching = checkReducer(ok, { type: 'switch', url: A });
    expect(switching).toEqual({ kind: 'switching', url: A });
    expect(checkReducer(switching, { type: 'edit' })).toBe(switching);
    expect(checkReducer(switching, { type: 'switched', url: A })).toEqual({ kind: 'switched', url: A });
    expect(checkReducer(switching, { type: 'switch-failed', url: A, message: 'quota' })).toEqual({
      kind: 'switch-failed',
      url: A,
      message: 'quota',
    });
  });

  test('Use is offered only for the checked URL as typed, and never for the node in use', () => {
    const ok: CheckState = { kind: 'ok', url: A, probe };
    expect(canUse(ok, ` ${A} `, B)).toBe(true);
    expect(canUse(ok, B, B)).toBe(false);
    expect(canUse(ok, A, A)).toBe(false);
    expect(canUse({ kind: 'checking', url: A }, A, B)).toBe(false);
    expect(canUse({ kind: 'failed', url: A, message: 'x' }, A, B)).toBe(false);
  });

  test('the probe reads as the tile shows it', () => {
    expect(describeProbe(probe)).toEqual([
      '✓ chain 31337 · rollup 5',
      '✓ the miner and the token are there',
      'block 73,164 · 3 s old',
      '96 ms',
    ]);
  });
});
