import { describe, expect, test } from 'bun:test';
import {
  addressUnderClass,
  currentAccountClassId,
  fingerprintOf,
  PREVIOUS_ACCOUNT_CLASS_ID,
} from '../src/keys/classes.ts';
import { addressOf } from '../src/keys/store.ts';

const master = new Uint8Array(32).map((_, i) => i);

describe('account classes', () => {
  test("the recipe under the build's class is the SDK's own address", async () => {
    const id = await currentAccountClassId();
    expect(await addressUnderClass(master, 0, id)).toBe(await addressOf(master, 0));
    // Another class, another address for the same master.
    expect(await addressUnderClass(master, 0, `0x${'01'.repeat(32)}`)).not.toBe(await addressOf(master, 0));
  });

  test('the previous class is pinned to the one the last build shipped; an SDK bump must move it on purpose', async () => {
    // When this fails after an SDK bump, set PREVIOUS_ACCOUNT_CLASS_ID to the value below and keep
    // the new id as the current one: records without a fingerprint verify against the old class.
    expect(PREVIOUS_ACCOUNT_CLASS_ID).toBe(await currentAccountClassId());
  });

  test('the fingerprint names the master, not a class, and differs per master', async () => {
    const fp = await fingerprintOf(master);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintOf(master)).toBe(fp);
    expect(await fingerprintOf(new Uint8Array(32).fill(5))).not.toBe(fp);
    expect(fp).not.toBe(await addressOf(master, 0));
  });
});
