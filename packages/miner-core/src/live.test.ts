// Live integration on an isolated local network (bun run e2e:agent -- bun test packages/miner-core):
// deploy, mine at an easy target, claim with real proving, check the private balance, then the
// failure modes only real proving can show (tampered field, cross-deployment replay), the public
// effects a claim leaves behind, and a burst of winners against N.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cpus } from 'node:os';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { type Deployment, deployElixir } from '../../deploy/src/deploy.ts';
import { loadMinerArtifact, loadWorkArtifact } from './artifacts.ts';
import { buildClaim } from './claim.ts';
import { readOpenEpoch, readRules } from './epoch.ts';
import { PARAMS } from './generated/params.ts';
import { mineEpoch, type Winner } from './miner.ts';
import { deployDomain } from './proof.ts';
import { newEpochSecret } from './secret.ts';
import { BbJsWorkProver, type WorkProver } from './work.ts';

const nodeUrl = process.env.AZTEC_NODE_URL ?? '';
const EASY_TARGET = 1n << 127n; // every other proof wins

describe.skipIf(!nodeUrl)('miner-core against a live node', () => {
  let wallet: EmbeddedWallet;
  let from: AztecAddress;
  let fee: { paymentMethod: SponsoredFeePaymentMethod };
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

  // The wallet needs both instances of a deployment (the claim calls the token's mint).
  const registerDeployment = async (d: Deployment): Promise<Contract> => {
    const artifact = await loadMinerArtifact();
    for (const [address, art] of [
      [AztecAddress.fromStringUnsafe(d.miner), artifact],
      [AztecAddress.fromStringUnsafe(d.token), TokenContract.artifact],
    ] as const) {
      const instance = await node.getContract(address);
      if (!instance) throw new Error(`${address} is not on the node`);
      await wallet.registerContract(instance, art);
    }
    return Contract.at(AztecAddress.fromStringUnsafe(d.miner), artifact, wallet);
  };

  beforeAll(async () => {
    wallet = await EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
    const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
    await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
    fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
    const secret = Fr.random();
    from = (
      await wallet.createSchnorrInitializerlessAccount(
        secret,
        Fr.ZERO,
        deriveMasterMessageSigningSecretKey(secret),
      )
    ).address;
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
        data: { nullifiers: unknown[]; noteHashes: unknown[]; publicDataWrites: unknown[] };
      }
    ).data;
    expect(data.nullifiers.length).toBeGreaterThanOrEqual(2); // tx nullifier + the ticket's
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

  test(`a burst of winners against N = ${PARAMS.N}: exactly N accepted, the rest revert as stale`, async () => {
    const burst = await deployElixir(nodeUrl, Fr.random(), Fr.random(), { initialTarget: EASY_TARGET });
    const m = await registerDeployment(burst);
    const rules = await readRules(m, from);
    const winners: { winner: Winner; secret: Fr }[] = [];
    for (let i = 0; i < 2 * rules.N; i++) winners.push(await mine(m));
    const t0 = performance.now();
    // One PXE cannot simulate its own claims concurrently (it trips over nullifiers it has not
    // yet seen inserted), so the winners are submitted one after another; the state machine is
    // what is under test: the epoch closes on the Nth and every later claim is refused.
    const results: Awaited<ReturnType<typeof send>>[] = [];
    for (const { winner, secret } of winners) {
      results.push(
        await send(
          buildClaim(m, {
            epoch: 0n,
            nonce: winner.nonce,
            out: winner.out,
            secret,
            proofFields: winner.proofFields,
            recipient: from,
          }),
        ),
      );
    }
    const accepted = results.filter((r) => r.ok).length;
    const stale = results.filter((r) => !r.ok && /stale|not open/i.test(r.error)).length;
    for (const e of new Set(results.filter((r) => !r.ok).map((r) => r.error)))
      console.log(`burst failure: ${e}`);
    console.log(
      `burst: ${accepted} accepted, ${stale} stale, ${results.length - accepted - stale} other failures, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
    );
    expect(accepted).toBe(rules.N);
    expect(stale).toBe(rules.N);
    const view = await readOpenEpoch(m, from);
    expect(view.epoch).toBe(1n);
  }, 1_800_000);
});
