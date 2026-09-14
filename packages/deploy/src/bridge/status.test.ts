import { describe, expect, test } from 'bun:test';
import { statusLines, type VersionStatus } from './status.ts';

const registered: VersionStatus = {
  version: 7n,
  registered: true,
  miner: `0x${'ab'.repeat(32)}`,
  registryIndex: 5n,
  flipAt: 0n,
  paused: false,
  headroom: 0n,
  deadline: (1n << 256n) - 1n,
  retireSent: false,
  depositsClosed: false,
  exited: 0n,
  inbound: 0n,
  cap: 0n,
  pausedUntil: 0n,
  pausedSeconds: 0n,
  launchAt: 1n,
  afterNextAt: 0n,
};

describe('the operator status', () => {
  test("says when the portal's miner for the version is not the record's", () => {
    expect(statusLines(registered, `0x${'AB'.repeat(32)}`).join('\n')).not.toMatch(/mismatch/);
    expect(statusLines(registered, `0x${'cd'.repeat(32)}`)[1]).toMatch(
      /miner mismatch: the portal registered 0xabab/,
    );
    const unregistered = { ...registered, registered: false };
    expect(statusLines(unregistered, `0x${'cd'.repeat(32)}`).join('\n')).not.toMatch(/mismatch/);
  });
});
