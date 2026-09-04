// The page's own wallet: an embedded PXE with the prover on, persistent IndexedDB stores keyed by
// chain id, one Schnorr account created on the first visit, fees through the sponsored FPC.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createLogger } from '@aztec/foundation/log';
import { AztecIndexedDBStore } from '@aztec/kv-store/deprecated/indexeddb';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { claimGasLimits } from '../../miner-core/src/claim.ts';
import type { Fee, Node } from './chain';

export interface OpenedWallet {
  wallet: EmbeddedWallet;
  account: AztecAddress;
  fee: Fee;
  /** True when the account was created during this boot (first visit on this chain). */
  created: boolean;
}

export async function openWallet(nodeUrl: string, node: Node, chainId: bigint): Promise<OpenedWallet> {
  const log = createLogger('web-miner');
  const [pxeStore, walletStore] = await Promise.all([
    AztecIndexedDBStore.open(log, `elixir-pxe-${chainId}`, false),
    AztecIndexedDBStore.open(log, `elixir-wallet-${chainId}`, false),
  ]);
  const wallet = await EmbeddedWallet.create(nodeUrl, {
    pxe: { proverEnabled: true, store: pxeStore },
    walletDb: { store: walletStore },
  });
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
  const fee: Fee = {
    paymentMethod: new SponsoredFeePaymentMethod(fpc.address),
    gasSettings: { gasLimits: await claimGasLimits(node) },
  };
  const existing = (await wallet.getAccounts())[0]?.item;
  if (existing) return { wallet, account: existing, fee, created: false };
  const secret = Fr.random();
  const account = await wallet.createSchnorrInitializerlessAccount(
    secret,
    Fr.ZERO,
    deriveMasterMessageSigningSecretKey(secret),
  );
  return { wallet, account: account.address, fee, created: true };
}
