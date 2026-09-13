import { describe, expect, test } from 'bun:test';
import { sha256Trunc } from '@aztec/foundation/crypto/sha256';
import { Fr } from '@aztec/foundation/curves/bn254';
import {
  type ArchivedExit,
  archiveLine,
  forwardArgsFromArchive,
  parseArchivedExit,
  readArchive,
  rootOf,
} from './witness.ts';

const entry: ArchivedExit = {
  version: '3685977955',
  index: 4,
  kind: 2,
  amount: '5000000000000000000',
  aux: `0x${'11'.repeat(32)}`,
  recipientOrRedeemKey: '0x000000000000000000000000000000000000beef',
  txHash: `0x${'22'.repeat(32)}`,
  epoch: '3',
  numCheckpointsInEpoch: 2,
  leafIndex: '0',
  path: [`0x${'33'.repeat(32)}`],
};

describe('the witness archive', () => {
  test('a line round-trips into the forward arguments the portal takes', () => {
    const [back] = readArchive(archiveLine(entry));
    expect(back).toEqual(entry);
    const args = forwardArgsFromArchive(entry, { sig: '0xab', expiry: 99n });
    expect(args).toEqual({
      kind: 2,
      amount: 5000000000000000000n,
      aux: entry.aux,
      recipientOrRedeemKey: entry.recipientOrRedeemKey,
      epoch: 3n,
      numCheckpointsInEpoch: 2n,
      leafIndex: 0n,
      path: entry.path,
      sig: '0xab',
      expiry: 99n,
    });
    expect(forwardArgsFromArchive(entry).sig).toBe('0x');
  });

  test('a corrupt line names itself instead of vanishing', () => {
    expect(() => readArchive(`${archiveLine(entry)}{not json\n`)).toThrow(/line 2 is not JSON/);
    expect(() => readArchive(archiveLine({ ...entry, kind: 9 as 2 }))).toThrow(/line 1: kind 9/);
    expect(() => parseArchivedExit({ ...entry, leafIndex: '2' }, 'x')).toThrow(
      /leaf index 2 is outside a path of 1/,
    );
    expect(() => parseArchivedExit({ ...entry, aux: '0x11' }, 'x')).toThrow(/aux is not 32 bytes/);
    expect(() => parseArchivedExit({ ...entry, amount: '-1' }, 'x')).toThrow(/amount is not a decimal/);
    expect(() => parseArchivedExit({ ...entry, path: ['0x'] }, 'x')).toThrow(/path\[0\]/);
    expect(parseArchivedExit(JSON.parse(archiveLine(entry)), 'x')).toEqual(entry);
  });

  test('the fold reaches the root the Outbox computes: a two-level tree by hand', () => {
    const [l0, l1, l2, l3] = [1, 2, 3, 4].map((n) => new Fr(n)) as [Fr, Fr, Fr, Fr];
    const pair = (a: Buffer, b: Buffer) => sha256Trunc(Buffer.concat([a, b]));
    const l01 = pair(l0.toBuffer(), l1.toBuffer());
    const l23 = pair(l2.toBuffer(), l3.toBuffer());
    const hex = (b: Buffer): `0x${string}` => `0x${b.toString('hex')}`;
    const root = hex(pair(l01, l23));
    // Leaf 2 (index 0b10): its sibling is leaf 3, then the left pair.
    expect(rootOf(l2, [hex(l3.toBuffer()), hex(l01)], 2n)).toBe(root);
    // Leaf 1 (index 0b01): sibling leaf 0 on the left, then the right pair.
    expect(rootOf(l1, [hex(l0.toBuffer()), hex(l23)], 1n)).toBe(root);
    expect(rootOf(l1, [hex(l0.toBuffer()), hex(l23)], 0n)).not.toBe(root);
  });
});
