// Feasibility spike, item 3: a real claim transaction end to end on an isolated local network.
//   boot node → embedded wallet (prover on) → sponsored FPC → bootstrap dry run (precomputed miner
//   address, token with minter = miner, bind_token once, non-deployer bind reverts) → mine W with
//   bb.js → wrong `out` and tampered proofs (one per transcript phase, each still a winning ticket)
//   fail to prove → claim (inline verifier) → balance = REWARD → replay rejected → claim_split.
// Run with BB_VERBOSE=1 LOG_LEVEL=verbose to capture bb's "Num rows in the ECCVM" lines.
//   bun packages/deploy/scripts/spike-claim.ts [--skip-tamper] [--skip-split]
import { cpus, hostname } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { BackendType, Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { Noir } from '@aztec/noir-noir_js';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { startIsolatedNode } from '../../../scripts/run/isolated-node.ts';
import {
  computeDigest,
  deployDomain,
  isWinner,
  proofToFields,
  secretCommitment,
} from '../../miner-core/src/proof.ts';
import layout from '../../work-circuit/src/generated/proof-layout.json';

const args = process.argv.slice(2);
const skipTamper = args.includes('--skip-tamper');
const skipSplit = args.includes('--skip-split');
const repo = resolve(import.meta.dir, '../../..');
const REWARD = 4_000_000_000_000_000_000n;
const VERSION = 1n;
const TARGET = 1n << 127n; // half of all tickets win: the target check is exercised without a long grind

const t = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const rss = () => `${(process.memoryUsage().rss / 2 ** 30).toFixed(2)} GiB rss`;
const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x));
const results: Record<string, unknown> = {
  machine: `${hostname()} · ${cpus()[0]?.model} × ${cpus().length}`,
};

const node = await startIsolatedNode();
console.log(`node ${node.nodeUrl}`);
const wallet = await EmbeddedWallet.create(node.nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
try {
  // Sponsored FPC + fresh initializerless accounts: no deploy tx, fees paid by the FPC.
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
  const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
  const newAccount = async () => {
    const secret = Fr.random();
    return wallet.createSchnorrInitializerlessAccount(
      secret,
      Fr.random(),
      deriveMasterMessageSigningSecretKey(secret),
    );
  };
  const deployer = (await newAccount()).address;
  const stranger = (await newAccount()).address;
  // simulate() wraps the decoded return value: { result, offchainEffects, offchainMessages }.
  const view = async <T>(call: { simulate: (o: { from: AztecAddress }) => Promise<unknown> }): Promise<T> =>
    ((await call.simulate({ from: deployer })) as { result: T }).result;

  // Bootstrap: the miner's address depends only on class, salt, deployer and its own args.
  const minerArtifact = loadContractArtifact(
    await Bun.file(resolve(repo, 'packages/contracts/target/elixir_spike-ElixirSpike.json')).json(),
  );
  const minerDeploy = Contract.deploy(wallet, minerArtifact, [TARGET, Fr.random()], 'constructor', {
    deployer,
    salt: Fr.random(),
  });
  const predicted = (await minerDeploy.getInstance()).address;
  let t0 = performance.now();
  const { contract: token } = await TokenContract.deployWithOpts(
    { method: 'constructor_with_minter', wallet, instantiation: { deployer, salt: Fr.random() } },
    'Elixir',
    'ELX',
    18,
    predicted,
    AztecAddress.ZERO,
  ).send({ from: deployer, fee, wait: { timeout: 300 } });
  console.log(`token ${token.address} (${t(performance.now() - t0)})`);
  t0 = performance.now();
  const { contract: miner } = await minerDeploy.send({ from: deployer, fee, wait: { timeout: 300 } });
  console.log(`miner ${miner.address} predicted ${predicted} (${t(performance.now() - t0)})`);
  if (!miner.address.equals(predicted))
    throw new Error('precomputed miner address differs from the deployed one');
  results.bootstrap = { predictedEqualsDeployed: true };

  const outcome = (p: Promise<unknown>) =>
    p.then(
      () => 'accepted',
      (e: Error) => `rejected: ${e.message.split('\n')[0]}`,
    );
  const bindByStranger = await outcome(
    miner.methods.bind_token(token.address).send({ from: stranger, fee, wait: { timeout: 120 } }),
  );
  console.log(`bind_token by non-deployer: ${bindByStranger}`);
  await miner.methods.bind_token(token.address).send({ from: deployer, fee, wait: { timeout: 120 } });
  const bindTwice = await outcome(
    miner.methods.bind_token(token.address).send({ from: deployer, fee, wait: { timeout: 120 } }),
  );
  console.log(`second bind_token: ${bindTwice}`);
  results.bind = { byStranger: bindByStranger, twice: bindTwice };
  if (!bindByStranger.startsWith('rejected') || !bindTwice.startsWith('rejected'))
    throw new Error('bind_token guard failed');

  // Mine: W proved with bb.js, ticket = Poseidon2 over the proof.
  const chainId = BigInt(await createAztecNodeClient(node.nodeUrl).getChainId());
  const params = await view<{ target: bigint; seed: bigint; opened_at: bigint }>(
    miner.methods.epoch_params(0),
  );
  console.log(`epoch_params(0) = ${json(params)}`);
  const domain = await deployDomain(chainId, miner.address.toField(), VERSION);
  const workArtifact = await Bun.file(resolve(repo, 'packages/work-circuit/target/elixir_work.json')).json();
  const noir = new Noir(workArtifact);
  const bb = await Barretenberg.new({
    threads: Math.max(1, cpus().length - 1),
    backend: BackendType.WasmWorker,
  });
  const prover = new UltraHonkBackend(workArtifact.bytecode, bb);
  interface Win {
    secret: Fr;
    nonce: bigint;
    out: Fr;
    fields: Fr[];
    digest: Fr;
  }
  const mine = async (): Promise<Win> => {
    const secret = Fr.random();
    const commit = await secretCommitment(secret);
    for (let nonce = 1n; ; nonce++) {
      const inputs = {
        domain: domain.toString(),
        seed: new Fr(params.seed).toString(),
        epoch: '0',
        miner_commit: commit.toString(),
        nonce: nonce.toString(),
      };
      const { witness, returnValue } = await noir.execute(inputs);
      const t1 = performance.now();
      const { proof } = await prover.generateProof(witness, { verifierTarget: 'noir-recursive-no-zk' });
      const fields = proofToFields(proof);
      const digest = await computeDigest(fields);
      if (isWinner(digest, params.target)) {
        console.log(
          `nonce ${nonce} wins (W proof ${t(performance.now() - t1)}); digest ${digest.toString().slice(0, 18)}…`,
        );
        return { secret, nonce, out: Fr.fromString(String(returnValue)), fields, digest };
      }
    }
  };
  const win = await mine();

  const claim = (method: 'claim' | 'claim_split', w: Win, label: string, fields = w.fields, out = w.out) => {
    const t1 = performance.now();
    return miner.methods[method](0, w.nonce, out, w.secret, fields, deployer)
      .send({ from: deployer, fee, wait: { timeout: 900 } })
      .then(
        (r) => {
          // At runtime the mined result is { receipt, offchainEffects, offchainMessages }.
          const rc = ((r as unknown as { receipt?: unknown }).receipt ?? r) as {
            transactionFee?: bigint;
            blockNumber?: number;
          };
          return {
            ok: true as const,
            ms: performance.now() - t1,
            fee: rc.transactionFee,
            block: rc.blockNumber,
          };
        },
        (e: Error) => ({
          ok: false as const,
          ms: performance.now() - t1,
          error: e.message.split('\n')[0] ?? '',
        }),
      )
      .then((r) => {
        console.log(`${label}: ${json({ ...r, ms: undefined, time: t(r.ms) })} ${rss()}`);
        return r;
      });
  };

  if (!skipTamper) {
    // Before the valid claim (same nullifier): wrong `out`, then one tamper per transcript phase.
    // Each tampered proof is chosen so its digest still wins, so the only thing left to fail is
    // the proof itself, at proving time — never the target check.
    const tamper: Record<string, unknown> = {};
    tamper.wrongOut = await claim('claim', win, 'wrong out', win.fields, win.out.add(Fr.ONE));
    const zero = win.fields.map(() => Fr.ZERO);
    tamper.zeroProofSimulation = await outcome(
      miner.methods.claim(0, win.nonce, win.out, win.secret, zero, deployer).simulate({ from: deployer }),
    );
    console.log(`all-zero proof, simulate only: ${tamper.zeroProofSimulation}`);
    for (const [phase, span] of Object.entries(layout.phases)) {
      let fields = win.fields;
      let slot = span.from;
      let bit = 0;
      for (;;) {
        fields = win.fields.map((f, i) => (i === slot ? f.add(new Fr(1n << BigInt(bit))) : f));
        if (isWinner(await computeDigest(fields), params.target)) break;
        if (++bit === 8) {
          bit = 0;
          slot++;
        }
      }
      tamper[phase] = await claim('claim', win, `tampered ${phase}[${slot}] bit ${bit}`, fields);
    }
    results.tamper = tamper;
    const accepted = Object.entries(tamper).filter(([, r]) => (r as { ok?: boolean }).ok);
    if (accepted.length) throw new Error(`tampered claims accepted: ${accepted.map(([k]) => k).join(', ')}`);
  }

  const inline = await claim('claim', win, 'claim (inline)');
  if (!inline.ok) throw new Error(`valid claim rejected: ${inline.error}`);
  const balance = await view<bigint>(token.methods.balance_of_private(deployer));
  const claims = await view<bigint>(miner.methods.claims_in(0));
  console.log(`private balance ${balance} (REWARD ${REWARD}); claims_in(0) = ${claims}`);
  if (balance !== REWARD || claims !== 1n) throw new Error('claim effects missing');
  results.claimInline = { ...inline, balance: balance.toString(), claims: Number(claims) };

  const replay = await claim('claim', win, 'replay of the same claim');
  results.replay = replay;
  if (replay.ok) throw new Error('replayed claim was accepted');

  if (!skipSplit) {
    const win2 = await mine();
    results.claimSplit = await claim('claim_split', win2, 'claim_split');
    results.claimsAfterSplit = Number(await view<bigint>(miner.methods.claims_in(0)));
  }
  await bb.destroy();
} finally {
  await wallet.stop().catch(() => {});
  await node.teardown();
}
await Bun.write(resolve(repo, 'packages/deploy/target/spike-claim.json'), json(results));
console.log('done');
