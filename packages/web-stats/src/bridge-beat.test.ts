import { describe, expect, test } from 'vitest';
import type { VersionFlows } from '../../bridge/src/portal-reader.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { exitLimitLine, pauseLine, phasesOf, readBridge, versionLine } from './bridge-beat';

const ONE = 10n ** BigInt(PARAMS.DECIMALS);
const NEVER = (1n << 256n) - 1n;
const NOW = 1_800_000_000;
const policy = {
  perHour: 12n * ONE,
  allowance: 100n * ONE,
  exitFloor: 3600n,
  pauseMax: 30n * 86400n,
  pauseBudget: 60n * 86400n,
};
const live: VersionFlows = {
  version: 5n,
  registered: true,
  miner: `0x${'11'.repeat(32)}`,
  registryIndex: 0n,
  flipAt: 0n,
  paused: false,
  headroom: 128n * ONE,
  deadline: NEVER,
  retireSent: false,
  depositsClosed: false,
  exited: 40n * ONE,
  inbound: 3n * ONE,
  cap: 165n * ONE,
  pausedUntil: 0n,
  pausedSeconds: 0n,
  launchAt: 1_799_000_000n,
};

describe('the bridge read', () => {
  test('every registered version with its flows, the canonical version, the policy and the keys', async () => {
    const calls: string[] = [];
    const reader = {
      registered: async () => [5n, 6n],
      flows: async (v: bigint) => {
        calls.push(`flows ${v}`);
        return { ...live, version: v };
      },
      canonical: async () => ({ version: 6n, index: 1n }),
      policy: async () => policy,
      operators: async () => `0x${'aa'.repeat(20)}` as const,
      forwarders: async () => [`0x${'bb'.repeat(20)}` as const],
    };
    const s = await readBridge(reader, 7);
    expect(s.versions.map((v) => v.version)).toEqual([5n, 6n]);
    expect(s.canonical.version).toBe(6n);
    expect(s.forwarders).toHaveLength(1);
    expect(s.readAt).toBe(7);
    expect(calls.sort()).toEqual(['flows 5', 'flows 6']);
  });
});

describe('the sentences', () => {
  test('the limit grows before the flip and is frozen after it; a pause holds it, the deadline ends it', () => {
    expect(exitLimitLine(live, policy, NOW)).toBe(
      `128 ${PARAMS.TOKEN_SYMBOL} may leave V5 right now · grows 12 ${PARAMS.TOKEN_SYMBOL} an hour; exits beyond it wait for it to grow, until the flip freezes it.`,
    );
    expect(exitLimitLine({ ...live, launchAt: BigInt(NOW + 3600) }, policy, NOW)).toContain(
      'from the launch on 2027-01-15; exits beyond it wait for it.',
    );
    expect(exitLimitLine({ ...live, flipAt: 1_799_500_000n }, policy, NOW)).toContain(
      'stopped growing at the flip; 40',
    );
    expect(exitLimitLine({ ...live, flipAt: 1_799_500_000n }, policy, NOW)).toContain(
      'cannot leave this version',
    );
    expect(exitLimitLine({ ...live, paused: true }, policy, NOW)).toBe(
      `128 ${PARAMS.TOKEN_SYMBOL} may leave V5 once the pause ends · 40 ${PARAMS.TOKEN_SYMBOL} has left.`,
    );
    expect(exitLimitLine({ ...live, deadline: BigInt(NOW - 1) }, policy, NOW)).toBe(
      `exits closed on 2027-01-15 · 40 ${PARAMS.TOKEN_SYMBOL} has left; nothing more leaves V5.`,
    );
  });

  test("the pause is the portal's word, not the clock's; a running one says how much budget it spent", () => {
    expect(pauseLine(live, policy, NOW)).toBe(
      'not paused · the operators may pause exits and deposits for up to 30.0 d a call, 60.0 d in total per version',
    );
    const paused = { ...live, paused: true, pausedUntil: BigInt(NOW + 7200), pausedSeconds: 86400n };
    expect(pauseLine(paused, policy, NOW)).toContain('paused for 2.0 h more · 1.0 d of the budget spent');
    // The device's clock past the portal's end while the portal still says paused: no negative duration.
    expect(pauseLine({ ...paused, pausedUntil: BigInt(NOW - 5) }, policy, NOW)).toContain('paused · 1.0 d');
    expect(pauseLine({ ...live, pausedUntil: BigInt(NOW + 7200) }, policy, NOW)).toContain('not paused');
  });

  test("a version's line: live, flipped, flipped but unrecorded, ahead of the flip, or not registered", () => {
    const at5 = { version: 5n, index: 0n };
    expect(versionLine(live, at5)).toBe('the live version · deposits and exits here');
    expect(versionLine({ ...live, depositsClosed: true }, at5)).toContain('deposits closed');
    const at6 = { version: 6n, index: 1n };
    expect(versionLine({ ...live, flipAt: 1_799_500_000n, deadline: 1_801_000_000n }, at6)).toBe(
      'flipped away from on 2027-01-09 · exits close on 2027-01-26',
    );
    expect(versionLine(live, at6)).toBe('flipped away from · the flip not yet recorded on the portal');
    expect(versionLine({ ...live, version: 7n, registryIndex: 2n }, at6)).toBe(
      'registered ahead of the flip · not live yet',
    );
    expect(versionLine({ ...live, registered: false }, at5)).toBe('not registered on the portal yet');
  });

  test('the phases: announced from the record, the flip and the retire from the portal, the close from the deadline', () => {
    const quiet = phasesOf(live, null, NOW).map((s) => `${s.id}:${s.state}`);
    expect(quiet).toEqual(['announced:pending', 'flip:pending', 'retire:pending', 'closes:pending']);
    const announced = phasesOf(
      live,
      { toIndex: '1', announcedAt: '1799900000', expectedFlipAt: '1800500000' },
      NOW,
    );
    expect(announced[0]).toMatchObject({ state: 'done', label: 'announced 2027-01-14' });
    expect(announced[0]?.detail).toBe('flip expected around 2027-01-21');
    const flipped = phasesOf(
      { ...live, flipAt: 1_799_500_000n, retireSent: true, deadline: 1_801_000_000n },
      null,
      NOW,
    );
    expect(flipped.map((s) => `${s.id}:${s.state}`)).toEqual([
      'announced:done',
      'flip:done',
      'retire:done',
      'closes:active',
    ]);
    // Ethereum saw the message sent; whether the miner consumed it is the other chain's to say.
    expect(flipped[2]).toMatchObject({
      label: 'retire message sent',
      detail: 'mining ends once the miner consumes it',
    });
  });
});
