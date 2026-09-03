// Runs against an isolated local network: bun run e2e:agent -- bun test packages/miner-core
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpus } from 'node:os';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import type { Gas } from '@aztec/stdlib/gas';
import { siloNullifier } from '@aztec/stdlib/hash';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import type { TxReceipt } from '@aztec/stdlib/tx';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { type Deployment, deployElixir } from '../../deploy/src/deploy.ts';
import { loadMinerArtifact, loadWorkArtifact } from './artifacts.ts';
import { buildClaim, claimGasLimits } from './claim.ts';
import { readOpenEpoch, readRules } from './epoch.ts';
import { PARAMS } from './generated/params.ts';
import { mineEpoch, type Winner } from './miner.ts';
import { DOM_NULL, deployDomain } from './proof.ts';
import { newEpochSecret } from './secret.ts';
import { BbJsWorkProver, type WorkProver } from './work.ts';

const nodeUrl = process.env.AZTEC_NODE_URL ?? '';
const EASY_TARGET = 1n << 127n; // every other proof wins

describe.skipIf(!nodeUrl)('miner-core against a live node', () => {
  let wallet: EmbeddedWallet;
  let from: AztecAddress;
  let fee: { paymentMethod: SponsoredFeePaymentMethod; gasSettings: { gasLimits: Gas } };
  let deployment: Deployment;
  let miner: Contract;
  let prover: WorkProver;
  let chainId: bigint;
  const node = createAztecNodeClient(nodeUrl);

  const mine = async (m: Contract, secret = newEpochSecret()): Promise<{ winner: Winner; secret: Fr }> => {
    const view = await readOpenEpoch(m, from);
    const domain = await deployDomain(chainId, m.address.toField(), PARAMS.VERSION);
    const winner = await mineEpoch(prover, {
      domain,
      seed: new Fr(view.params.seed),
      epoch: view.epoch,
      secret,
      target: view.params.target,
    });
    if (!winner) throw new Error('mining stopped without a winner');
    return { winner, secret };
  };
  const send = (interaction: ReturnType<typeof buildClaim>) =>
    interaction.send({ from, fee, wait: { timeout: 900 } }).then(
      (r) => ({ ok: true as const, receipt: (r as unknown as { receipt?: unknown }).receipt ?? r }),
      (e: Error) => ({ ok: false as const, error: e.message.split('\n')[0] ?? '' }),
    );

  const newWallet = () => EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
  const registerFpc = async (w: EmbeddedWallet) => {
    const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
    await w.registerContract(fpc, SponsoredFPCContract.artifact);
    return { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
  };
  const newAccount = async (w: EmbeddedWallet, secret = Fr.random()) =>
    (
      await w.createSchnorrInitializerlessAccount(
        secret,
        Fr.ZERO,
        deriveMasterMessageSigningSecretKey(secret),
      )
    ).address;
  // A wallet needs both instances of a deployment (the claim calls the token's mint).
  const registerDeployment = async (d: Deployment, w = wallet): Promise<Contract> => {
    const artifact = await loadMinerArtifact();
    for (const [address, art] of [
      [AztecAddress.fromStringUnsafe(d.miner), artifact],
      [AztecAddress.fromStringUnsafe(d.token), TokenContract.artifact],
    ] as const) {
      const instance = await node.getContract(address);
      if (!instance) throw new Error(`${address} is not on the node`);
      await w.registerContract(instance, art);
    }
    return Contract.at(AztecAddress.fromStringUnsafe(d.miner), artifact, w);
  };

  beforeAll(async () => {
    wallet = await newWallet();
    fee = { ...(await registerFpc(wallet)), gasSettings: { gasLimits: await claimGasLimits(node) } };
    const secret = Fr.random();
    from = await newAccount(wallet, secret);
    deployment = await deployElixir(nodeUrl, secret, Fr.random(), { initialTarget: EASY_TARGET });
    miner = await registerDeployment(deployment);
    chainId = BigInt(await node.getChainId());
    const api = await Barretenberg.new({
      threads: Math.max(1, cpus().length - 1),
      backend: BackendType.WasmWorker,
    });
    prover = new BbJsWorkProver(await loadWorkArtifact(), api);
  }, 600_000);

  afterAll(async () => {
    await prover?.destroy();
    await wallet?.stop();
  });

  test('a mined ticket claims REWARD into the private balance and its public effects reveal only the digest', async () => {
    const { winner, secret } = await mine(miner);
    const r = await send(
      buildClaim(miner, {
        epoch: 0n,
        nonce: winner.nonce,
        out: winner.out,
        secret,
        proofFields: winner.proofFields,
        recipient: from,
      }),
    );
    expect(r.ok).toBe(true);
    const token = TokenContract.at(AztecAddress.fromStringUnsafe(deployment.token), wallet);
    const balance = ((await token.methods.balance_of_private(from).simulate({ from })) as { result: bigint })
      .result;
    expect(balance).toBe(PARAMS.REWARD);
    expect((await readOpenEpoch(miner, from)).claims).toBe(1);
    // Public effects: the tx's effect on chain, as any observer sees it.
    const receipt = (r as { receipt: { txHash: { toString(): string } } }).receipt;
    const effect = await node.getTxEffect(receipt.txHash as never);
    expect(effect).toBeTruthy();
    const json = JSON.stringify(effect, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(json.includes(from.toString().slice(2))).toBe(false); // recipient not visible
    expect(json.includes(secret.toString().slice(2))).toBe(false); // secret not visible
    const data = (
      effect as unknown as {
        data: { nullifiers: Fr[]; noteHashes: unknown[]; publicDataWrites: { value: Fr }[] };
      }
    ).data;
    // Exactly what a claim publishes: the siloed ticket nullifier, the digest as last_digest,
    // the token's public total supply (first mint on this deployment) and one note hash.
    const ticketNullifier = await siloNullifier(
      miner.address,
      await poseidon2Hash([new Fr(DOM_NULL), winner.digest]),
    );
    expect(data.nullifiers.some((n) => n.equals(ticketNullifier))).toBe(true);
    const written = data.publicDataWrites.map((w) => w.value.toBigInt());
    expect(written).toContain(winner.digest.toBigInt());
    expect(written).toContain(PARAMS.REWARD);
    expect(data.noteHashes.length).toBeGreaterThanOrEqual(1); // the minted note (+ the fee path's own)
  }, 900_000);

  test('a tampered proof field fails at proving and a replay of the winning proof is rejected', async () => {
    const { winner, secret } = await mine(miner);
    const tampered = winner.proofFields.map((f, i) => (i === 240 ? f.add(Fr.ONE) : f));
    const bad = await send(
      buildClaim(miner, {
        epoch: 0n,
        nonce: winner.nonce,
        out: winner.out,
        secret,
        proofFields: tampered,
        recipient: from,
      }),
    );
    expect(bad.ok).toBe(false);
    const good = await send(
      buildClaim(miner, {
        epoch: 0n,
        nonce: winner.nonce,
        out: winner.out,
        secret,
        proofFields: winner.proofFields,
        recipient: from,
      }),
    );
    expect(good.ok).toBe(true);
    const replay = await send(
      buildClaim(miner, {
        epoch: 0n,
        nonce: winner.nonce,
        out: winner.out,
        secret,
        proofFields: winner.proofFields,
        recipient: from,
      }),
    );
    expect(replay.ok).toBe(false);
  }, 900_000);

  test('a proof mined for one deployment does not claim on another', async () => {
    const other = await deployElixir(nodeUrl, Fr.random(), Fr.random(), { initialTarget: EASY_TARGET });
    const otherMiner = await registerDeployment(other);
    const { winner, secret } = await mine(miner); // domain of the FIRST deployment
    const r = await send(
      buildClaim(otherMiner, {
        epoch: 0n,
        nonce: winner.nonce,
        out: winner.out,
        secret,
        proofFields: winner.proofFields,
        recipient: from,
      }),
    );
    expect(r.ok).toBe(false);
    // The rejection must come from the recursive verifier (domain mismatch), not from setup.
    expect(r.ok ? '' : r.error).toMatch(/verif|proof/i);
  }, 900_000);

  // A claim that reverted in public still pays its fee; one refused at simulation costs nothing.
  const submit = async (
    c: { miner: Contract; account: AztecAddress },
    w: { winner: Winner; secret: Fr },
  ): Promise<{ ok: boolean; reverted: boolean; error: string; fee: bigint; ms: number }> => {
    const t0 = performance.now();
    const claim = buildClaim(c.miner, {
      epoch: 0n,
      nonce: w.winner.nonce,
      out: w.winner.out,
      secret: w.secret,
      proofFields: w.winner.proofFields,
      recipient: c.account,
    });
    try {
      const r = await claim.send({ from: c.account, fee, wait: { timeout: 900, dontThrowOnRevert: true } });
      const receipt = (r as { receipt?: TxReceipt }).receipt ?? (r as unknown as TxReceipt);
      const ok = receipt.executionResult === 'success';
      const where = `block ${receipt.blockNumber} #${receipt.txIndexInBlock}`;
      console.log(
        `claim ${receipt.txHash}: ${receipt.executionResult} in ${where}, fee ${receipt.transactionFee}`,
      );
      return {
        ok,
        reverted: !ok,
        error: ok ? '' : (receipt.error ?? `reverted in ${where}`),
        fee: receipt.transactionFee ?? 0n,
        ms: performance.now() - t0,
      };
    } catch (e) {
      return {
        ok: false,
        reverted: false,
        error: (e as Error).message.split('\n')[0] ?? '',
        fee: 0n,
        ms: performance.now() - t0,
      };
    }
  };

  test(`a burst of winners against N = ${PARAMS.N}: exactly N accepted, the rest revert as stale`, async () => {
    const burst = await deployElixir(nodeUrl, Fr.random(), Fr.random(), { initialTarget: EASY_TARGET });
    const m = await registerDeployment(burst);
    const rules = await readRules(m, from);
    const winners: { winner: Winner; secret: Fr }[] = [];
    for (let i = 0; i < 2 * rules.N; i++) winners.push(await mine(m));
    // One wallet per winner: a PXE cannot simulate its own claims concurrently, and separate
    // wallets are what real miners are. All 2N claims race for the same epoch.
    const claimants = await Promise.all(
      winners.map(async () => {
        const w = await newWallet();
        await registerFpc(w);
        return { wallet: w, account: await newAccount(w), miner: await registerDeployment(burst, w) };
      }),
    );
    const t0 = performance.now();
    let results: Awaited<ReturnType<typeof submit>>[];
    try {
      results = await Promise.all(
        winners.map((w, i) => submit(claimants[i] as (typeof claimants)[number], w)),
      );
    } finally {
      await Promise.all(claimants.map((c) => c.wallet.stop().catch(() => {})));
    }
    const accepted = results.filter((r) => r.ok);
    // A claim sequenced after the close reverts in public and pays (mined receipts carry no
    // reason); one whose simulation already saw the close is refused before sending, for free.
    const stale = results.filter((r) => !r.ok && (r.reverted || /stale|not open/i.test(r.error)));
    const inPublic = stale.filter((r) => r.reverted).length;
    for (const e of new Set(results.filter((r) => !r.ok).map((r) => r.error)))
      console.log(`burst failure: ${e}`);
    const fees = results.map((r) => r.fee);
    console.log(
      `burst: ${accepted.length} accepted, ${stale.length} stale (${inPublic} reverted in public, ${stale.length - inPublic} refused at simulation), ${results.length - accepted.length - stale.length} other, ` +
        `${((performance.now() - t0) / 1000).toFixed(0)} s wall, latency ${(Math.min(...results.map((r) => r.ms)) / 1000) | 0}–${(Math.max(...results.map((r) => r.ms)) / 1000) | 0} s, ` +
        `fees accepted ${accepted.map((r) => r.fee).join('/')} stale ${stale.map((r) => r.fee).join('/')} (sum ${fees.reduce((a, b) => a + b, 0n)})`,
    );
    const view = await readOpenEpoch(m, from);
    const closed = Number(((await m.methods.claims_in(0n).simulate({ from })) as { result: bigint }).result);
    console.log(
      `after the burst: open epoch ${view.epoch}, claims in epoch 0: ${closed}, in the open one: ${view.claims}`,
    );
    expect(accepted.length).toBe(rules.N);
    expect(stale.length).toBe(rules.N);
    expect(closed).toBe(rules.N);
    expect(view.epoch).toBe(1n);
  }, 1_800_000);
});
