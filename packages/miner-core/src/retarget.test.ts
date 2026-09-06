import { describe, expect, test } from 'bun:test';
import { cappedElapsed, type EpochRules, nextTarget, U128_MAX } from './retarget.ts';

// The mainnet rules: the plan's issuance and load statements are made for these.
const MAINNET: EpochRules = { N: 24, EXPECTED_EPOCH_SECONDS: 3600n, T_MAX: 14400n };
const TESTNET: EpochRules = { N: 4, EXPECTED_EPOCH_SECONDS: 300n, T_MAX: 1200n };
const TWO_128 = 1n << 128n;

describe('nextTarget mirrors the Noir retarget', () => {
  // Same vectors as the #[test]s in packages/contracts/yacana_miner/src/retarget.nr (testnet rules).
  test('parity vectors', () => {
    const t = 1n << 122n;
    expect(nextTarget(t, 300n, TESTNET)).toBe(t);
    expect(nextTarget(t, 150n, TESTNET)).toBe(t / 2n);
    expect(nextTarget(t, 1n, TESTNET)).toBe(t / 4n);
    expect(nextTarget(t, 1200n, TESTNET)).toBe(t * 4n);
    expect(nextTarget(U128_MAX - 5n, 1200n, TESTNET)).toBe(U128_MAX);
    expect(nextTarget(1n << 127n, 1200n, TESTNET)).toBe(U128_MAX);
    expect(nextTarget(1n, 1n, TESTNET)).toBe(1n);
    const odd = (1n << 118n) + 12345n;
    expect(nextTarget(odd, 307n, TESTNET)).toBe((odd * 307n) / 300n);
    expect(() => nextTarget(t, 1201n, TESTNET)).toThrow(/T_MAX/);
    expect(cappedElapsed(99_999n, TESTNET)).toBe(1200n);
  });
});

// Epoch-level simulator: a fleet of H proofs/s wins each proof with probability target/2^128, so
// N claims take N / (H·p) seconds in expectation; a count close uses that duration capped at
// T_MAX and an epoch that would outlast T_MAX closes by roll at exactly ×4. Deterministic (mean
// behaviour), which is what the convergence claims in the plan are about.
interface Sim {
  target: bigint;
  epochs: { duration: number; claims: number; minted: bigint; roll: boolean }[];
}
const REWARD = 4n;
function simulate(
  rules: EpochRules,
  target0: bigint,
  hashrate: (epoch: number) => number,
  epochs: number,
): Sim {
  const sim: Sim = { target: target0, epochs: [] };
  for (let e = 0; e < epochs; e++) {
    const p = Number(sim.target) / Number(TWO_128);
    const H = hashrate(e);
    const expected = H > 0 ? rules.N / (H * p) : Number.POSITIVE_INFINITY;
    const tMax = Number(rules.T_MAX);
    if (expected >= tMax) {
      const claims = H > 0 ? Math.min(rules.N - 1, Math.floor(H * p * tMax)) : 0;
      sim.epochs.push({ duration: tMax, claims, minted: BigInt(claims) * REWARD, roll: true });
      sim.target = nextTarget(sim.target, rules.T_MAX, rules);
    } else {
      sim.epochs.push({ duration: expected, claims: rules.N, minted: BigInt(rules.N) * REWARD, roll: false });
      sim.target = nextTarget(sim.target, BigInt(Math.max(1, Math.round(expected))), rules);
    }
  }
  return sim;
}
const converged = (d: number, rules: EpochRules) =>
  Math.abs(d - Number(rules.EXPECTED_EPOCH_SECONDS)) <= 0.25 * Number(rules.EXPECTED_EPOCH_SECONDS);
// Hashrate that closes an epoch exactly on schedule at the initial target.
const baseline = (rules: EpochRules, target: bigint) =>
  rules.N / ((Number(target) / Number(TWO_128)) * Number(rules.EXPECTED_EPOCH_SECONDS));

describe('retarget dynamics (mean-field simulator)', () => {
  const target0 = 1n << 122n;
  const H0 = baseline(MAINNET, target0);

  test.each([
    [10, 2],
    [100, 4],
    [1000, 5],
  ])('a %ix hashrate shock converges within %i epochs', (k, epochs) => {
    const sim = simulate(MAINNET, target0, () => H0 * k, epochs + 1);
    expect(converged(sim.epochs[epochs]?.duration ?? 0, MAINNET)).toBe(true);
    // Issuance per closed epoch is capped by construction, however fast the epochs come.
    for (const ep of sim.epochs) expect(ep.minted).toBeLessThanOrEqual(BigInt(MAINNET.N) * REWARD);
  });

  test('a ÷100 collapse recovers through escape-hatch closes within 5 epochs', () => {
    // Needs headroom below the 2^128 ceiling: from 2^122, three ×4 rolls saturate the target at
    // "every proof wins" and a fleet at H0/100 still cannot produce N claims per hour.
    const t = 1n << 118n;
    const sim = simulate(MAINNET, t, () => baseline(MAINNET, t) / 100, 6);
    expect(sim.epochs.slice(0, 3).every((e) => e.roll)).toBe(true); // three ×4 rolls = ×64
    expect(sim.epochs[3]?.roll).toBe(false);
    expect(converged(sim.epochs[4]?.duration ?? 0, MAINNET)).toBe(true);
    expect(converged(sim.epochs[5]?.duration ?? 0, MAINNET)).toBe(true);
  });

  test('from the configured 2^122 a ÷100 collapse saturates the target: liveness, not cadence', () => {
    const sim = simulate(MAINNET, target0, () => H0 / 100, 6);
    expect(sim.target).toBe(U128_MAX); // every proof wins from epoch 3 on
    // The floor on epoch duration is N / H: 24 claims at H0/100 take ≈ 5625 s, never the 3600 s cadence.
    const floor = MAINNET.N / (H0 / 100);
    for (const e of sim.epochs.slice(3)) expect(Math.round(e.duration)).toBe(Math.round(floor));
    expect(sim.epochs.slice(3).some((e) => converged(e.duration, MAINNET))).toBe(false);
  });

  test('withholding the closing claim to stretch an epoch lowers the withholder’s YACA per hour', () => {
    // Honest: epochs close on schedule; the withholder owns share f of hashrate and earns f·N·R per hour.
    const f = 0.6;
    const honestPerHour = f * MAINNET.N * Number(REWARD);
    // Strategy: hold the Nth claim until T_MAX (needs > 75 % of the hashrate to be the only one
    // able to close; with f = 0.6 the others close on their own, so model the best case anyway):
    // epoch e stretches to T_MAX earning f·N·R over 4 h, epoch e+1 is ×4 easier so closes in ~1/4 h
    // earning f·N·R, then ÷4 back. Over the 4.25 h cycle: 2·f·N·R.
    const stretchedPerHour = (2 * f * MAINNET.N * Number(REWARD)) / (4 + 0.25);
    expect(stretchedPerHour).toBeLessThan(honestPerHour);
  });

  test('genesis premine and roll-seed pre-mining are bounded by one epoch’s issuance', () => {
    // Deployer alone at genesis: whatever the head start, epoch 0 mints at most N·R.
    const sim = simulate(MAINNET, target0, () => H0 * 1000, 1);
    expect(sim.epochs[0]?.minted).toBe(BigInt(MAINNET.N) * REWARD);
    // Escape-hatch seeds are public from opened_at + T_MAX: a sequencer-miner may delay the roll by
    // up to K slots and mine every candidate seed meanwhile, then include the roll whose seed it
    // did best against. Its edge is the claims it already holds when that epoch opens.
    const slotSeconds = 36;
    const p = Number(target0 * 4n) / Number(TWO_128); // the rolled epoch is ×4 easier
    const advantage = (K: number, share: number) => {
      // Work spread over K candidates, all of it on the head start; the best candidate ends up
      // with at least the mean plus the fluctuation of a Poisson maximum, bounded by the total.
      const total = share * H0 * slotSeconds * K * p;
      return Math.min(total, total / K + Math.sqrt(total / K) * Math.sqrt(2 * Math.log(K)));
    };
    const worst = Math.max(...[1, 2, 5, 10].map((K) => advantage(K, 1)));
    console.log(
      `roll-slot choice: best pre-mined claims over K ≤ 10 slots ≈ ${worst.toFixed(2)} (N = ${MAINNET.N})`,
    );
    expect(worst).toBeLessThanOrEqual(MAINNET.N);
    // With the whole network's hashrate (share = 1) it is still one epoch's issuance at most.
    expect(BigInt(Math.ceil(advantage(10, 1))) * REWARD).toBeLessThanOrEqual(BigInt(MAINNET.N) * REWARD);
  });

  test('a burst of 200 winners against N = 24 leaves exactly 24 accepted and consistent state', () => {
    // The contract's record_claim as a state machine: count < N accepts, else reverts as stale.
    const state = { open: 0, claims: 0, accepted: 0, stale: 0 };
    for (let i = 0; i < 200; i++) {
      if (state.open !== 0 || state.claims >= MAINNET.N) {
        state.stale++;
        continue;
      }
      state.claims++;
      state.accepted++;
      if (state.claims === MAINNET.N) state.open = 1;
    }
    expect(state).toEqual({ open: 1, claims: 24, accepted: 24, stale: 176 });
  });

  test('testnet profile: 24 epochs at a steady hashrate stay near the 5-minute cadence', () => {
    const t0 = 1n << 124n;
    const sim = simulate(TESTNET, t0, () => baseline(TESTNET, t0) * 1.3, 24);
    expect(sim.epochs.slice(4).every((e) => converged(e.duration, TESTNET))).toBe(true);
  });
});
