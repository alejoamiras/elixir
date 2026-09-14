// The bridge against its pinned cross-language vectors; the Noir crate's generated tests and the
// portal's Foundry suite assert the same values, so a drift on any side fails its own tests.
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { Fr } from '@aztec/foundation/curves/bn254';
import { EthAddress } from '@aztec/foundation/eth-address';
import { computeSecretHash } from '@aztec/stdlib/hash';
import { masterFromPrf } from '@yacana/miner-core/src/keys/derive.ts';
import { claimContent, exitContent, MAX_AMOUNT, retireContent, sendAheadContent } from './content.ts';
import { deriveCrossingSecrets, exitLogTag } from './secrets.ts';

const v = (await Bun.file(resolve(import.meta.dir, '../fixtures/bridge-vectors.json')).json()) as {
  edge: {
    recipient: string;
    amount: string;
    tag: string;
    exitValue: string;
    sendAheadValue: string;
    claimValue: string;
  };
  exit: { recipient: string; amount: string; tag: string; value: string };
  sendAhead: { amount: string; secretHash: string; redeemKey: string; value: string };
  claim: { amount: string; value: string };
  retire: { version: string; value: string };
  retireSecretHash: string;
  exitLogTag: { hashOrTag: string; value: string };
  crossing: {
    masterPrf: string;
    scope: { chainId: string; portal: string; version: string };
    index: number;
    secret: string;
    secretHash: string;
    tag: string;
    redeemKey: string;
    redeemAddress: string;
  };
};
const fr = (h: string) => Fr.fromString(h);
const eth = (h: string) => EthAddress.fromString(h);

describe('bridge vectors', () => {
  test('the four contents, the retire secret hash and the exit log tag', async () => {
    expect(exitContent(eth(v.exit.recipient), BigInt(v.exit.amount), fr(v.exit.tag)).toString()).toBe(
      fr(v.exit.value).toString(),
    );
    const s = v.sendAhead;
    expect(sendAheadContent(BigInt(s.amount), fr(s.secretHash), eth(s.redeemKey)).toString()).toBe(
      fr(s.value).toString(),
    );
    expect(claimContent(BigInt(v.claim.amount)).toString()).toBe(fr(v.claim.value).toString());
    expect(retireContent(BigInt(v.retire.version)).toString()).toBe(fr(v.retire.value).toString());
    expect((await computeSecretHash(new Fr(0n))).toString()).toBe(fr(v.retireSecretHash).toString());
    expect((await exitLogTag(fr(v.exitLogTag.hashOrTag))).toString()).toBe(fr(v.exitLogTag.value).toString());
  });

  test('the edges: max u128, a high-bit tag, a high-bit address', () => {
    const e = v.edge;
    expect(exitContent(eth(e.recipient), BigInt(e.amount), fr(e.tag)).toString()).toBe(
      fr(e.exitValue).toString(),
    );
    expect(sendAheadContent(BigInt(e.amount), fr(e.tag), eth(e.recipient)).toString()).toBe(
      fr(e.sendAheadValue).toString(),
    );
    expect(claimContent(BigInt(e.amount)).toString()).toBe(fr(e.claimValue).toString());
  });

  test('one crossing derives to the pinned secrets, tag and redeem key', async () => {
    const c = v.crossing;
    const master = await masterFromPrf(Uint8Array.from(Buffer.from(c.masterPrf, 'hex')));
    const scope = {
      chainId: BigInt(c.scope.chainId),
      portal: eth(c.scope.portal),
      version: BigInt(c.scope.version),
    };
    const d = await deriveCrossingSecrets(master, scope, c.index);
    expect(d.secret.toString()).toBe(fr(c.secret).toString());
    expect(d.secretHash.toString()).toBe(fr(c.secretHash).toString());
    expect(d.tag.toString()).toBe(fr(c.tag).toString());
    expect(d.redeemKey).toBe(c.redeemKey as `0x${string}`);
    expect(d.redeemAddress.toString()).toBe(eth(c.redeemAddress).toString());
    // Another index, version or portal is another key: nothing links two crossings.
    const other = await deriveCrossingSecrets(master, scope, c.index + 1);
    expect(other.redeemAddress.equals(d.redeemAddress)).toBe(false);
    const elsewhere = await deriveCrossingSecrets(master, { ...scope, version: scope.version + 1n }, c.index);
    expect(elsewhere.secretHash.equals(d.secretHash)).toBe(false);
  });

  test('fails closed: a bad master, a negative index, an amount past u128', async () => {
    const scope = { chainId: 1n, portal: eth(v.crossing.scope.portal), version: 1n };
    await expect(deriveCrossingSecrets(new Uint8Array(16), scope, 0)).rejects.toThrow(/expected 32/);
    await expect(deriveCrossingSecrets(new Uint8Array(32), scope, -1)).rejects.toThrow(/index/);
    expect(() => claimContent(MAX_AMOUNT + 1n)).toThrow(/u128/);
    expect(claimContent(MAX_AMOUNT)).toBeInstanceOf(Fr);
  });
});
