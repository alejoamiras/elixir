// Headless miner for the testnet soak: mines the deployment in deployments/<profile>.json with
// the native bb backend, claims every win, rolls after T_MAX, and varies its own hashrate on a
// schedule so the retarget sees real load changes. Stops after --hours or --epochs closed epochs.
//   AZTEC_NODE_URL=… bun packages/deploy/scripts/soak.ts [--hours 2] [--epochs 24] [--threads N]
//                    [--schedule full,half,pause,full] [--label miner-a] [--report soak.jsonl]
import { appendFileSync, mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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
import { loadMinerArtifact, loadWorkArtifact } from '../../miner-core/src/artifacts.ts';
import { buildClaim, claimGasLimits } from '../../miner-core/src/claim.ts';
import { readOpenEpoch, readRules } from '../../miner-core/src/epoch.ts';
import { PARAMS, PROFILE } from '../../miner-core/src/generated/params.ts';
import { mineEpoch } from '../../miner-core/src/miner.ts';
import { deployDomain } from '../../miner-core/src/proof.ts';
import { newEpochSecret } from '../../miner-core/src/secret.ts';
import { BbJsWorkProver } from '../../miner-core/src/work.ts';

const repo = resolve(import.meta.dir, '../../..');
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};
const hours = Number(opt('hours', '2'));
const maxEpochs = Number(opt('epochs', '24'));
const maxThreads = Number(opt('threads', String(Math.max(1, cpus().length - 1))));
const schedule = opt('schedule', 'full,half,pause,full').split(',');
const label = opt('label', 'soak');
const report = resolve(opt('report', `packages/deploy/target/soak-${label}.jsonl`));
const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is required');
mkdirSync(dirname(report), { recursive: true });

const deployment = (await Bun.file(resolve(repo, `deployments/${PROFILE}.json`)).json()) as {
  miner: string;
  token: string;
};
const node = createAztecNodeClient(nodeUrl);
const wallet = await EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
  salt: new Fr(SPONSORED_FPC_SALT),
});
await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
const fee = {
  paymentMethod: new SponsoredFeePaymentMethod(fpc.address),
  gasSettings: { gasLimits: await claimGasLimits(node) },
};
const secret = Fr.random();
const from = (
  await wallet.createSchnorrInitializerlessAccount(
    secret,
    Fr.ZERO,
    deriveMasterMessageSigningSecretKey(secret),
  )
).address;
const minerArtifact = await loadMinerArtifact();
for (const [address, art] of [
  [AztecAddress.fromStringUnsafe(deployment.miner), minerArtifact],
  [AztecAddress.fromStringUnsafe(deployment.token), TokenContract.artifact],
] as const) {
  const instance = await node.getContract(address);
  if (!instance) throw new Error(`${address} is not on the node`);
  await wallet.registerContract(instance, art);
}
const miner = Contract.at(AztecAddress.fromStringUnsafe(deployment.miner), minerArtifact, wallet);
const token = Contract.at(AztecAddress.fromStringUnsafe(deployment.token), TokenContract.artifact, wallet);
const rules = await readRules(miner, from);
const chainId = BigInt(await node.getChainId());
const domain = await deployDomain(chainId, miner.address.toField(), PARAMS.VERSION);

const line = async (o: Record<string, unknown>) => {
  const row = { t: new Date().toISOString(), label, ...o };
  console.log(JSON.stringify(row));
  appendFileSync(report, `${JSON.stringify(row)}\n`);
};

// One prover per hashrate step; "pause" mines nothing for the step's duration.
const stepSeconds = Math.max(300, Math.floor((hours * 3600) / schedule.length));
const threadsFor = (step: string) => (step === 'half' ? Math.max(1, Math.floor(maxThreads / 2)) : maxThreads);

const started = Date.now();
const deadline = started + hours * 3600_000;
const startEpoch = (await readOpenEpoch(miner, from)).epoch;
let closed = 0n;
let claims = 0;
let stale = 0;
let proofs = 0;
await line({
  event: 'start',
  hours,
  maxEpochs,
  maxThreads,
  schedule,
  stepSeconds,
  epoch: startEpoch.toString(),
});

for (let s = 0; Date.now() < deadline && closed < BigInt(maxEpochs); s = (s + 1) % schedule.length) {
  const step = schedule[s] ?? 'full';
  const stepEnd = Math.min(deadline, Date.now() + stepSeconds * 1000);
  await line({
    event: 'step',
    step,
    threads: step === 'pause' ? 0 : threadsFor(step),
    until: new Date(stepEnd).toISOString(),
  });
  if (step === 'pause') {
    while (Date.now() < stepEnd) {
      await maybeRoll();
      await delay(30_000);
    }
    continue;
  }
  const api = await Barretenberg.new({
    threads: threadsFor(step),
    backend: BackendType.NativeUnixSocket,
  }).catch(() => Barretenberg.new({ threads: threadsFor(step), backend: BackendType.WasmWorker }));
  const prover = new BbJsWorkProver(await loadWorkArtifact(), api);
  try {
    while (Date.now() < stepEnd && closed < BigInt(maxEpochs)) {
      await maybeRoll();
      const view = await readOpenEpoch(miner, from);
      const epochSecret = newEpochSecret();
      let switched = false;
      const winner = await mineEpoch(
        prover,
        {
          domain,
          seed: new Fr(view.params.seed),
          epoch: view.epoch,
          secret: epochSecret,
          target: view.params.target,
        },
        {
          onAttempt: (_n, _d, proveMs) => {
            proofs++;
            if (proofs % 20 === 0)
              void line({
                event: 'attempt',
                epoch: view.epoch.toString(),
                proveMs: Math.round(proveMs),
                proofs,
              });
            return Date.now() < stepEnd;
          },
        },
      );
      if (!winner) continue;
      const before = await readOpenEpoch(miner, from);
      if (before.epoch !== view.epoch) {
        switched = true;
        stale++;
        await line({
          event: 'stale-before-send',
          epoch: view.epoch.toString(),
          now: before.epoch.toString(),
        });
        continue;
      }
      const t0 = Date.now();
      try {
        const sent = await buildClaim(miner, {
          epoch: view.epoch,
          nonce: winner.nonce,
          out: winner.out,
          secret: epochSecret,
          proofFields: winner.proofFields,
          recipient: from,
        }).send({ from, fee, wait: { timeout: 900, dontThrowOnRevert: true } });
        const receipt = (
          sent as { receipt?: { executionResult?: string; blockNumber?: number; transactionFee?: bigint } }
        ).receipt;
        const ok = receipt?.executionResult === 'success';
        if (ok) claims++;
        else stale++;
        await line({
          event: ok ? 'claim' : 'reverted',
          epoch: view.epoch.toString(),
          block: receipt?.blockNumber,
          fee: receipt?.transactionFee?.toString(),
          ms: Date.now() - t0,
          attempts: winner.attempts,
        });
      } catch (e) {
        stale++;
        await line({
          event: 'refused',
          epoch: view.epoch.toString(),
          error: String(e).split('\n')[0],
          ms: Date.now() - t0,
        });
      }
      const after = await readOpenEpoch(miner, from);
      if (after.epoch > view.epoch || switched) closed = after.epoch - startEpoch;
    }
  } finally {
    await api.destroy().catch(() => {});
  }
}

const balance = ((await token.methods.balance_of_private(from).simulate({ from })) as { result: bigint })
  .result;
await line({
  event: 'end',
  hoursElapsed: ((Date.now() - started) / 3600_000).toFixed(2),
  closedEpochs: closed.toString(),
  claims,
  stale,
  proofs,
  balance: balance.toString(),
});
await wallet.stop();

async function maybeRoll() {
  const view = await readOpenEpoch(miner, from);
  const age = BigInt(Math.floor(Date.now() / 1000)) - view.params.openedAt;
  if (age < rules.T_MAX) return;
  await line({ event: 'roll', epoch: view.epoch.toString(), age: age.toString() });
  try {
    await miner.methods.roll().send({ from, fee, wait: { timeout: 900 } });
  } catch (e) {
    await line({ event: 'roll-failed', error: String(e).split('\n')[0] });
  }
}
