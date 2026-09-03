// In-browser half of the spike: an embedded wallet with the prover on, the sponsored FPC, W proved
// in-page by bb.js, and the claim proved in-page (Chonk in WASM). The driver script deploys the
// contracts and passes their addresses in the query string; results land in window.__spike.
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { Noir } from '@aztec/noir-noir_js';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import {
  computeDigest,
  deployDomain,
  isWinner,
  proofToFields,
  secretCommitment,
} from '../../miner-core/src/proof.ts';

declare global {
  interface Window {
    __spike?: Record<string, unknown>;
  }
}

const logEl = document.getElementById('log') as HTMLPreElement;
const log = (s: string) => {
  logEl.textContent += `\n${s}`;
  console.log(s);
};
const q = new URLSearchParams(location.search);
const nodeUrl = q.get('node') ?? '';
const minerAddress = AztecAddress.fromStringUnsafe(q.get('miner') ?? '');
const tokenAddress = AztecAddress.fromStringUnsafe(q.get('token') ?? '');
const threads = Number(q.get('threads') ?? Math.max(1, navigator.hardwareConcurrency - 1));
const VERSION = 1n;
const results: Record<string, unknown> = {
  crossOriginIsolated,
  threads,
  hardwareConcurrency: navigator.hardwareConcurrency,
};

try {
  if (!crossOriginIsolated)
    throw new Error('page is not crossOriginIsolated: no SharedArrayBuffer for bb.js threads');
  let t0 = performance.now();
  const wallet = await EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
  const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
  const accountSecret = Fr.random();
  const account = await wallet.createSchnorrInitializerlessAccount(
    accountSecret,
    Fr.random(),
    deriveMasterMessageSigningSecretKey(accountSecret),
  );
  const from = account.address;
  const minerArtifact = loadContractArtifact(
    await (await fetch('/artifacts/elixir_spike-ElixirSpike.json')).json(),
  );
  const tokenArtifact = loadContractArtifact(
    await (await fetch('/artifacts/token_contract-Token.json')).json(),
  );
  const miner = Contract.at(minerAddress, minerArtifact, wallet);
  const token = Contract.at(tokenAddress, tokenArtifact, wallet);
  await wallet.registerContract(await miner.instance, minerArtifact).catch(() => {});
  results.walletSetupMs = performance.now() - t0;
  log(`wallet ready (${results.walletSetupMs} ms), account ${from}`);

  const chainId = BigInt(await createAztecNodeClient(nodeUrl).getChainId());
  const params = (
    (await miner.methods.epoch_params(0).simulate({ from })) as { result: { target: bigint; seed: bigint } }
  ).result;
  const domain = await deployDomain(chainId, minerAddress.toField(), VERSION);
  const workArtifact = await (await fetch('/artifacts/elixir_work.json')).json();
  const noir = new Noir(workArtifact);
  t0 = performance.now();
  const bb = await Barretenberg.new({ threads });
  const prover = new UltraHonkBackend(workArtifact.bytecode, bb);
  results.bbInitMs = performance.now() - t0;

  const secret = Fr.random();
  const commit = await secretCommitment(secret);
  const proveMs: number[] = [];
  let win: { nonce: bigint; out: Fr; fields: Fr[] } | undefined;
  for (let nonce = 1n; !win; nonce++) {
    const { witness, returnValue } = await noir.execute({
      domain: domain.toString(),
      seed: new Fr(params.seed).toString(),
      epoch: '0',
      miner_commit: commit.toString(),
      nonce: nonce.toString(),
    });
    const t1 = performance.now();
    const { proof } = await prover.generateProof(witness, { verifierTarget: 'noir-recursive-no-zk' });
    proveMs.push(performance.now() - t1);
    const fields = proofToFields(proof);
    if (isWinner(await computeDigest(fields), params.target))
      win = { nonce, out: Fr.fromString(String(returnValue)), fields };
    log(`nonce ${nonce}: W proof ${proveMs.at(-1)?.toFixed(0)} ms${win ? ' — wins' : ''}`);
  }
  results.workProveMs = proveMs;
  await bb.destroy();

  t0 = performance.now();
  const receipt = await miner.methods
    .claim(0, win.nonce, win.out, secret, win.fields, from)
    .send({ from, fee, wait: { timeout: 1800 } });
  results.claimMs = performance.now() - t0;
  results.claimBlock = receipt.blockNumber;
  log(`claim mined in block ${receipt.blockNumber} (${(results.claimMs / 1000).toFixed(1)} s)`);
  const balance = ((await token.methods.balance_of_private(from).simulate({ from })) as { result: bigint })
    .result;
  results.balance = balance.toString();
  log(`private balance ${balance}`);
  await wallet.stop();
  results.ok = true;
} catch (e) {
  results.ok = false;
  results.error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  log(`ERROR ${results.error}`);
}
window.__spike = results;
