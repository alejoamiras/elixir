// The page's own wallet: an embedded PXE with the prover on, a persistent PXE store keyed by the
// rollup, and an in-memory WalletDB so no spend secret ever reaches disk. Accounts come from the
// vault (a passkey or the twelve words) and are registered again on every open.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createLogger } from '@aztec/foundation/log';
import { AztecIndexedDBStore } from '@aztec/kv-store/deprecated/indexeddb';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { claimGasLimits } from '../../miner-core/src/claim.ts';
import type { AccountFields } from '../../miner-core/src/keys/derive.ts';
import type { Fee, Node } from './chain';
import { MemoryKvStore } from './wallet/memory-store';

export interface OpenedWallet {
  wallet: EmbeddedWallet;
  fee: Fee;
  /** The PXE's IndexedDB name: one namespace per rollup, shared by every key on this device. */
  pxeDb: string;
}

/** Stores are per rollup, not per L1 chain: two rollups on Sepolia must never share PXE state. */
export const pxeNamespace = async (node: Node, chainId: bigint): Promise<string> => {
  const info = await node.getNodeInfo();
  return `yacana-pxe-${chainId}-${info.rollupVersion}-${info.l1ContractAddresses.rollupAddress.toString()}`;
};

export async function openWallet(nodeUrl: string, node: Node, chainId: bigint): Promise<OpenedWallet> {
  const pxeDb = await pxeNamespace(node, chainId);
  const pxeStore = await AztecIndexedDBStore.open(createLogger('web-miner'), pxeDb, false);
  const wallet = await EmbeddedWallet.create(nodeUrl, {
    pxe: { proverEnabled: true, store: pxeStore },
    walletDb: { store: new MemoryKvStore() },
  });
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
  const fee: Fee = {
    paymentMethod: new SponsoredFeePaymentMethod(fpc.address),
    gasSettings: { gasLimits: await claimGasLimits(node) },
  };
  return { wallet, fee, pxeDb };
}

/** Idempotent: the wallet checks the PXE for the instance before registering it again. */
export const registerAccount = async (w: OpenedWallet, fields: AccountFields): Promise<AztecAddress> =>
  (await w.wallet.createSchnorrInitializerlessAccount(fields.secret, fields.salt, fields.signingKey)).address;
