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
import type { Tx } from '@aztec/stdlib/tx';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { claimGasLimits } from '../../miner-core/src/claim.ts';
import type { AccountFields } from '../../miner-core/src/keys/derive.ts';
import type { Fee, Node } from './chain';
import { MemoryKvStore } from './wallet/memory-store';

/** A transaction as it left for the node; the expiry (unix s) is the one the sequencer enforces. */
export interface SentTx {
  txHash: string;
  expiresAt: number;
}

export interface OpenedWallet {
  wallet: EmbeddedWallet;
  fee: Fee;
  /** The PXE's IndexedDB name: one namespace per rollup, shared by every key on this device. */
  pxeDb: string;
  /** The last transaction the wallet handed to the node. */
  lastSent: () => SentTx | undefined;
}

/** Stores are per rollup, not per L1 chain: two rollups on Sepolia must never share PXE state. */
export const pxeNamespace = async (node: Node, chainId: bigint): Promise<string> => {
  const info = await node.getNodeInfo();
  return `yacana-pxe-${chainId}-${info.rollupVersion}-${info.l1ContractAddresses.rollupAddress.toString()}`;
};

/** The wallet's node with `sendTx` observed: nothing else exposes a sent transaction's expiry. */
const observeSends = (node: Node, onSend: (tx: Tx) => void): Node =>
  new Proxy(node, {
    get(target, prop) {
      if (prop === 'sendTx')
        return (tx: Tx) => {
          onSend(tx);
          return target.sendTx(tx);
        };
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });

/** Nothing half-open survives a failure: a retry must find the namespace unheld. */
export async function openWallet(node: Node, chainId: bigint): Promise<OpenedWallet> {
  const pxeDb = await pxeNamespace(node, chainId);
  const pxeStore = await AztecIndexedDBStore.open(createLogger('web-miner'), pxeDb, false);
  let sent: SentTx | undefined;
  const observed = observeSends(node, (tx) => {
    sent = { txHash: tx.getTxHash().toString(), expiresAt: Number(tx.data.expirationTimestamp) };
  });
  let wallet: EmbeddedWallet | undefined;
  try {
    wallet = await EmbeddedWallet.create(observed, {
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
    return { wallet, fee, pxeDb, lastSent: () => sent };
  } catch (e) {
    if (wallet) await wallet.stop().catch(() => {});
    else await pxeStore.close().catch(() => {});
    throw e;
  }
}

/** Idempotent: the wallet checks the PXE for the instance before registering it again. */
export const registerAccount = async (w: OpenedWallet, fields: AccountFields): Promise<AztecAddress> =>
  (await w.wallet.createSchnorrInitializerlessAccount(fields.secret, fields.salt, fields.signingKey)).address;

const DELETE_GRACE_MS = 10_000;

/**
 * A delete another connection is blocking. The request stays queued in the browser until that
 * connection closes, and any open of the same name queues behind it, so nothing can be reopened
 * on this page: the only way out is closing the other tab and reloading.
 */
export class ChainViewHeldError extends Error {
  constructor() {
    super('another tab holds this key’s chain view open; close it and reload this page');
    this.name = 'ChainViewHeldError';
  }
}

/** Waits for the old connection to let go; another tab holding the namespace open blocks it for good. */
const deleteDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    let blocked: ReturnType<typeof setTimeout> | undefined;
    req.onsuccess = () => {
      clearTimeout(blocked);
      resolve();
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      blocked = setTimeout(() => reject(new ChainViewHeldError()), DELETE_GRACE_MS);
    };
  });

/**
 * Lost-race recovery: drops the PXE namespace (this device's whole chain view) and rebuilds it from
 * the chain for one account. A reverted claim is not in the chain's logs, so the fresh sync never
 * learns of the delivery index the old view was stuck on; the notes come back the way a new device
 * recovers them.
 */
export async function resetAccountView(
  previous: OpenedWallet,
  node: Node,
  chainId: bigint,
  fields: AccountFields,
): Promise<OpenedWallet> {
  await previous.wallet.stop();
  await deleteDatabase(previous.pxeDb);
  const opened = await openWallet(node, chainId);
  try {
    await registerAccount(opened, fields);
  } catch (e) {
    await opened.wallet.stop().catch(() => {});
    throw e;
  }
  return opened;
}
