// The bridge sheets' validation, pure: an Ethereum recipient, an amount against a balance, and the
// reviewed snapshot the send uses.
import { getAddress, isAddress } from 'viem';
import { parseAmount } from '../features/withdraw-form';

export interface EthDraft {
  amount: string;
  to: string;
}

export interface EthSnapshot {
  amount: bigint;
  to: `0x${string}`;
  display: string;
}

/** A checksummed Ethereum address; a lowercase or wrongly cased one is refused when its checksum is wrong. */
export function parseEthAddress(text: string): `0x${string}` {
  const t = text.trim();
  if (!isAddress(t, { strict: false })) throw new Error('not an Ethereum address');
  if (/[A-F]/.test(t.slice(2)) && /[a-f]/.test(t.slice(2)) && !isAddress(t, { strict: true }))
    throw new Error('the address checksum does not match');
  if (/^0x0{40}$/i.test(t)) throw new Error('the zero address cannot receive');
  return getAddress(t);
}

/** Everything checked at review time; the exit uses this object and nothing from the form. */
export function reviewExit(d: EthDraft, balance: bigint, decimals: number): EthSnapshot {
  const to = parseEthAddress(d.to);
  const amount = parseAmount(d.amount, decimals);
  if (amount > balance) throw new Error('more than the private balance');
  return { amount, to, display: d.amount.trim() };
}

/** A send-ahead or a deposit: the amount alone. */
export function reviewAmount(
  text: string,
  balance: bigint,
  decimals: number,
): { amount: bigint; display: string } {
  const amount = parseAmount(text, decimals);
  if (amount > balance) throw new Error('more than the balance');
  return { amount, display: text.trim() };
}
