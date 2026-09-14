// The portal's fixed policy, from the mining profile: a version may issue three times what its
// schedule could have minted per hour, starting with a day's worth; exits close 180 days after a
// flip at the earliest; a pause is at most 30 days a call and 60 in total; a registration's launch
// time may sit a week behind or 90 days ahead of the registration block. Set once at deployment.
import { PARAMS } from '@yacana/miner-core/src/generated/params.ts';

export interface PortalPolicy {
  perHour: bigint;
  allowance: bigint;
  exitFloor: bigint;
  pauseMax: bigint;
  pauseBudget: bigint;
  launchBackdate: bigint;
  launchAhead: bigint;
  leafGas: bigint;
}

const DAY = 86_400n;

export function policyFor(p = PARAMS): PortalPolicy {
  const schedulePerHour = (p.REWARD * BigInt(p.N) * 3600n) / p.EXPECTED_EPOCH_SECONDS;
  return {
    perHour: schedulePerHour * 3n,
    allowance: p.REWARD * BigInt(p.N) * 24n,
    exitFloor: 180n * DAY,
    pauseMax: 30n * DAY,
    pauseBudget: 60n * DAY,
    launchBackdate: 7n * DAY,
    launchAhead: 90n * DAY,
    leafGas: 400_000n,
  };
}
