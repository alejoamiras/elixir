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
  test('the limit grows an hour at a time before the flip and is frozen after it; exits beyond it wait', () => {
    expect(exitLimitLine(live, policy)).toBe(
      `128 ${PARAMS.TOKEN_SYMBOL} may leave V5 right now · grows 12 ${PARAMS.TOKEN_SYMBOL} an hour; exits beyond it wait, they are not refused.`,
    );
    expect(exitLimitLine({ ...live, flipAt: 1_799_500_000n }, policy)).toContain(
      'stopped growing at the flip; 40',
    );
  });

  test('the pause names its limits, and how much of the budget a running pause has spent', () => {
    expect(pauseLine(live, policy, NOW)).toBe(
      'not paused · the operators may pause exits and deposits for up to 30.0 d at a time, 60.0 d in total per version',
    );
    const paused = { ...live, pausedUntil: BigInt(NOW + 7200), pausedSeconds: 86400n };
    expect(pauseLine(paused, policy, NOW)).toContain('paused for 2.0 h more · 1.0 d of the budget spent');
  });

  test("a version's line: live, flipped with a closing day, or not yet registered", () => {
    expect(versionLine(live, 5n)).toBe('the live version · mining, deposits and exits here');
    expect(versionLine({ ...live, depositsClosed: true }, 5n)).toContain('deposits closed');
    expect(versionLine({ ...live, flipAt: 1_799_500_000n, deadline: 1_801_000_000n }, 6n)).toBe(
      'flipped away from on 2027-01-09 · exits close on 2027-01-26',
    );
    expect(versionLine({ ...live, registered: false }, 5n)).toBe('not registered on the portal yet');
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
    ).map((s) => `${s.id}:${s.state}`);
    expect(flipped).toEqual(['announced:done', 'flip:done', 'retire:done', 'closes:active']);
  });
});
