import { describe, expect, test } from 'bun:test';
import { loadLayouts } from '../../miner-core/src/slots.ts';
import { type EffectView, type ExampleClaim, exampleClaimFromEffect } from './example-claim.ts';

const fixture = (await Bun.file(
  new URL('../fixtures/example-claim-effect.json', import.meta.url),
).json()) as {
  identity: ExampleClaim;
  effect: EffectView;
};
const recorded = (await Bun.file(
  new URL('../../../deployments/testnet.example-claim.json', import.meta.url),
).json()) as ExampleClaim;
const layout = (await loadLayouts()).miner;
const { miner, chainId, rollupVersion, txHash } = recorded;
const identity = { miner, chainId, rollupVersion };

describe('the example claim from a transaction effect', () => {
  test('the committed testnet effect yields the committed record: the leaf writes and the siloed ticket', async () => {
    expect(fixture.identity).toEqual(recorded);
    const claim = await exampleClaimFromEffect(fixture.effect, identity, layout, txHash, 40);
    expect(claim).toEqual(recorded);
    expect(claim.claims[1] - claim.claims[0]).toBe(1);
    expect(fixture.effect.nullifiers).toContain(claim.nullifier);
  });

  test('an effect without the writes, or without the ticket for its digest, is refused', async () => {
    const noWrites = { ...fixture.effect, publicDataWrites: fixture.effect.publicDataWrites.slice(0, 1) };
    await expect(exampleClaimFromEffect(noWrites, identity, layout, txHash, 40)).rejects.toThrow(
      /no claims\[e\]/,
    );
    const noTicket = {
      ...fixture.effect,
      nullifiers: fixture.effect.nullifiers.filter((n) => n !== recorded.nullifier),
    };
    await expect(exampleClaimFromEffect(noTicket, identity, layout, txHash, 40)).rejects.toThrow(
      /no ticket nullifier/,
    );
    // Another deployment's address derives other leaves: the same effect is not its claim.
    const other = { ...identity, miner: `0x${'1'.padStart(64, '0')}` };
    await expect(exampleClaimFromEffect(fixture.effect, other, layout, txHash, 40)).rejects.toThrow(
      /no claims/,
    );
  });
});
