// The miner secret is a bearer credential for the tickets it commits to, but only within one
// epoch: it is generated fresh when an epoch starts and discarded when the epoch closes, so
// nothing long-lived needs a wallet signature or key derivation.
import { Fr } from '@aztec/foundation/curves/bn254';

export const newEpochSecret = (): Fr => Fr.random();
