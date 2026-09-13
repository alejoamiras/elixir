import { describe, expect, test } from 'bun:test';
import { type ArchivedExit, archiveLine, forwardArgsFromArchive, readArchive } from './witness.ts';

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
  });
});
