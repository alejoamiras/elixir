import { describe, expect, test } from 'bun:test';
import { explorer, explorerBase } from './explorer.ts';

const ADDR = `0x${'2091605c'.padEnd(64, 'e')}`;
const HASH = `0x${'0cc85e67'.padEnd(64, '5')}`;

describe('explorer links', () => {
  test('the base is the origin only; off or unset means no links', () => {
    expect(explorerBase('https://testnet.aztecscan.xyz/some/path?x=1')).toBe('https://testnet.aztecscan.xyz');
    expect(explorerBase('off')).toBeUndefined();
    expect(explorerBase(undefined)).toBeUndefined();
    expect(explorerBase('')).toBeUndefined();
  });

  test('every kind, on the verified aztecscan paths', () => {
    const x = explorer('https://testnet.aztecscan.xyz');
    expect(x.instance(ADDR)).toBe(`https://testnet.aztecscan.xyz/contracts/instances/${ADDR}`);
    expect(x.classVersion(ADDR)).toBe(`https://testnet.aztecscan.xyz/contracts/classes/${ADDR}/versions/1`);
    expect(x.classVersion(ADDR, 3)).toBe(
      `https://testnet.aztecscan.xyz/contracts/classes/${ADDR}/versions/3`,
    );
    expect(x.address(ADDR)).toBe(`https://testnet.aztecscan.xyz/address/${ADDR}`);
    expect(x.block(73162)).toBe('https://testnet.aztecscan.xyz/blocks/73162');
    expect(x.block(73162n)).toBe('https://testnet.aztecscan.xyz/blocks/73162');
    expect(x.tx(HASH)).toBe(`https://testnet.aztecscan.xyz/tx-effects/${HASH}`);
  });

  test('a value a lying node could send never becomes a path', () => {
    const x = explorer('https://testnet.aztecscan.xyz');
    expect(x.instance('0x12/../../admin')).toBeUndefined();
    expect(x.tx(`0x${'g'.repeat(64)}`)).toBeUndefined();
    expect(x.address(ADDR.slice(0, 60))).toBeUndefined();
    expect(x.block(0)).toBeUndefined();
    expect(x.block(-4)).toBeUndefined();
    expect(x.block(2 ** 53)).toBeUndefined();
    expect(x.block(Number.NaN)).toBeUndefined();
    expect(x.classVersion(ADDR, 0)).toBeUndefined();
    expect(x.instance(ADDR.toUpperCase())).toBe(`https://testnet.aztecscan.xyz/contracts/instances/${ADDR}`);
  });

  test('no base, no links', () => {
    const x = explorer(undefined);
    expect(x.instance(ADDR)).toBeUndefined();
    expect(x.block(1)).toBeUndefined();
  });
});
