// bun: the address validity check runs Grumpkin through bb.js, which jsdom cannot host.
import { describe, expect, test } from 'bun:test';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { review } from '../src/features/withdraw-form.ts';

describe('withdraw review', () => {
  test('the snapshot carries the parsed recipient, integer amount and mode; every refusal names its reason', async () => {
    const self = (await AztecAddress.random()).toString();
    const to = await AztecAddress.random();
    const ok = await review(
      { to: ` ${to.toString()} `, amount: '1.25', mode: 'private' },
      self,
      2n * 10n ** 18n,
      18,
    );
    expect(ok.to.equals(to)).toBe(true);
    expect(ok.amount).toBe(125n * 10n ** 16n);
    expect(ok.mode).toBe('private');
    expect(ok.display).toBe('1.25');
    const attempt = (d: Partial<{ to: string; amount: string }>) =>
      review({ to: to.toString(), amount: '1', mode: 'public', ...d }, self, 10n ** 18n, 18);
    await expect(attempt({ to: 'nope' })).rejects.toThrow(/not an Aztec address/);
    await expect(attempt({ to: AztecAddress.ZERO.toString() })).rejects.toThrow(/zero address/);
    await expect(attempt({ to: self })).rejects.toThrow(/this key/);
    // In the field but not a Grumpkin x-coordinate (about half of all small integers).
    let x = 1n;
    while (await AztecAddress.fromBigIntUnsafe(x).isValid()) x++;
    await expect(attempt({ to: AztecAddress.fromBigIntUnsafe(x).toString() })).rejects.toThrow(/valid/);
    await expect(attempt({ amount: '1.5' })).rejects.toThrow(/more than the private balance/);
  });
});
