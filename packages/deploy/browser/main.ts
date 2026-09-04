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
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { openTmpStore } from '@aztec/kv-store/deprecated/indexeddb';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { Noir } from '@aztec/noir-noir_js';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import {
  computeDigest,
  DOM_DEPLOY,
  DOM_SECRET,
  isWinner,
  proofToFields,
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
  // IndexedDB stores: the default SQLite-OPFS store spawns a worker whose URL the dev server's
  // dependency pre-bundling breaks; the web miner will ship the OPFS assets explicitly instead.
  const wallet = await EmbeddedWallet.create(nodeUrl, {
    ephemeral: true,
    pxe: { proverEnabled: true, store: await openTmpStore(true) },
    walletDb: { store: await openTmpStore(true) },
  });
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
  // The wallet needs each contract's instance (salt, deployer, init hash), not just its address.
  const aztecNode = createAztecNodeClient(nodeUrl);
  for (const [address, artifact] of [
    [minerAddress, minerArtifact],
    [tokenAddress, tokenArtifact],
  ] as const) {
    const instance = await aztecNode.getContract(address);
    if (!instance) throw new Error(`contract ${address} is not published on the node`);
    await wallet.registerContract(instance, artifact);
  }
  const miner = Contract.at(minerAddress, minerArtifact, wallet);
  const token = Contract.at(tokenAddress, tokenArtifact, wallet);
  results.walletSetupMs = performance.now() - t0;
  log(`wallet ready (${results.walletSetupMs} ms), account ${from}`);

  const chainId = BigInt(await aztecNode.getChainId());
  const params = (
    (await miner.methods.epoch_params(0).simulate({ from })) as { result: { target: bigint; seed: bigint } }
  ).result;
  const domain = await poseidon2Hash([
    new Fr(DOM_DEPLOY),
    new Fr(chainId),
    minerAddress.toField(),
    new Fr(VERSION),
  ]); // elixir_spike's 4-input domain
  const workArtifact = await (await fetch('/artifacts/elixir_work.json')).json();
  const noir = new Noir(workArtifact);
  t0 = performance.now();
  const bb = await Barretenberg.new({ threads });
  const prover = new UltraHonkBackend(workArtifact.bytecode, bb);
  results.bbInitMs = performance.now() - t0;

  const secret = Fr.random();
  const commit = await poseidon2Hash([new Fr(DOM_SECRET), secret]); // elixir_spike predates recipient binding
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
  const sent = await miner.methods
    .claim(0, win.nonce, win.out, secret, win.fields, from)
    .send({ from, fee, wait: { timeout: 1800 } });
  // At runtime the mined result is { receipt, offchainEffects, offchainMessages }.
  const receipt = ((sent as unknown as { receipt?: unknown }).receipt ?? sent) as { blockNumber?: number };
  const claimMs = performance.now() - t0;
  results.claimMs = claimMs;
  results.claimBlock = receipt.blockNumber;
  log(`claim mined in block ${receipt.blockNumber} (${(claimMs / 1000).toFixed(1)} s)`);
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
