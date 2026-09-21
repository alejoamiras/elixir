import { describe, expect, test } from 'bun:test';
import { carriedBridge } from './bridge-block.ts';

const block = (portal: string) => ({
  chainId: '31337',
  portal,
  yaca: '0x2',
  registry: '0x3',
  operators: '0x4',
  l1RpcUrl: 'http://127.0.0.1:1',
});

describe('the bridge block a miner deploy carries', () => {
  test('the first candidate that has one, whatever case its portal is written in', () => {
    const got = carriedBridge('0xABCD', [
      { from: 'a', bridge: undefined },
      { from: 'b', bridge: block('0xabcd') },
      { from: 'c', bridge: block('0x9999') },
    ]);
    expect(got?.portal).toBe('0xabcd');
  });

  test('a candidate naming another portal refuses the deploy before it spends anything', () => {
    expect(() => carriedBridge('0xabcd', [{ from: 'deployments/v5.json', bridge: block('0x9999') }])).toThrow(
      /deployments\/v5\.json names portal 0x9999; this miner trusts 0xabcd/,
    );
  });

  test('no candidate, no block', () => {
    expect(carriedBridge('0xabcd', [{ from: 'a', bridge: undefined }])).toBeUndefined();
    expect(carriedBridge('0xabcd', [])).toBeUndefined();
  });
});
