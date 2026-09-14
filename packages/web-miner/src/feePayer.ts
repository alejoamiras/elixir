// Who pays and with what gas, per operation. Every transaction the page sends is sponsored by the
// same FPC; a claim carries the measured gas limits (the SDK's estimate under-provisions a claim's
// public part), everything else takes the SDK's estimate.
import type { Fee } from './chain';

export type Operation = 'claim' | 'roll' | 'transfer' | 'bridge';

export type FeeFor = Fee | Pick<Fee, 'paymentMethod'>;

export interface FeePayer {
  for(op: Operation): FeeFor;
}

export const feePayer = (claim: Fee): FeePayer => ({
  for: (op) => (op === 'claim' ? claim : { paymentMethod: claim.paymentMethod }),
});
