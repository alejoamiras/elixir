// Everything that touches a node: the deployment's contracts on a wallet, epoch reads, the claim
// and roll transactions.
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, NO_WAIT } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { type createAztecNodeClient, waitForTx } from '@aztec/aztec.js/node';
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { Gas } from '@aztec/stdlib/gas';
import { type TxEffect, TxStatus } from '@aztec/stdlib/tx';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import { buildClaim } from '../../miner-core/src/claim.ts';
import { readOpenEpoch, readRules } from '../../miner-core/src/epoch.ts';
import type { EpochInfo } from './lib/reducer';
import type { SentTx } from './wallet';

export type Node = ReturnType<typeof createAztecNodeClient>;

export interface Fee {
  paymentMethod: { getAsset(): unknown } & object;
  gasSettings: { gasLimits: Gas };
}

export interface Deployment {
  node: Node;
  miner: Contract;
  token: Contract;
  /** The last transaction the wallet behind `miner` handed to the node. */
  lastSent: () => SentTx | undefined;
}

export const loadArtifact = async (name: string): Promise<ContractArtifact> =>
  loadContractArtifact(await (await fetch(`/artifacts/${name}.json`)).json());

/** Registers the miner and token instances (fetched from the node) with the wallet. */
export async function attachDeployment(
  wallet: EmbeddedWallet,
  node: Node,
  addresses: { miner: string; token: string },
  minerArtifact: ContractArtifact,
  lastSent: () => SentTx | undefined = () => undefined,
): Promise<Deployment> {
  const tokenArtifact = await loadArtifact('token_contract-Token');
  const contracts = [] as Contract[];
  for (const [address, art] of [
    [addresses.miner, minerArtifact],
    [addresses.token, tokenArtifact],
  ] as const) {
    const at = AztecAddress.fromStringUnsafe(address);
    const instance = await node.getContract(at);
    if (!instance) throw new Error(`no contract at ${address} on this node`);
    await wallet.registerContract(instance, art);
    contracts.push(Contract.at(at, art, wallet));
  }
  const [miner, token] = contracts as [Contract, Contract];
  return { node, miner, token, lastSent };
}

export const readEpoch = async (d: Deployment, from: AztecAddress): Promise<EpochInfo> => {
  const v = await readOpenEpoch(d.miner, from);
  return {
    epoch: v.epoch,
    seed: v.params.seed,
    target: v.params.target,
    openedAt: v.params.openedAt,
    claims: v.claims,
  };
};

export const readEpochRules = (d: Deployment, from: AztecAddress) => readRules(d.miner, from);

export interface ClaimArgs {
  epoch: bigint;
  nonce: bigint;
  out: string;
  secret: string;
  proofFields: string[];
  recipient: AztecAddress;
}

export interface ClaimSent {
  txHash: string;
  /** Unix seconds; the sequencer drops the claim past this. Unknown if the send was not observed. */
  expiresAt: number | undefined;
  /** Resolves once the claim is in a proposed block, with that transaction's effects. */
  wait(): Promise<{ block: number; effect: TxEffect }>;
}

const CLAIM_WAIT_S = 900;

/** Proves the claim in-page and hands it to the node; inclusion is a separate wait. */
export async function sendClaim(
  d: Deployment,
  from: AztecAddress,
  fee: Fee,
  c: ClaimArgs,
): Promise<ClaimSent> {
  const interaction = buildClaim(d.miner, {
    epoch: c.epoch,
    nonce: c.nonce,
    out: Fr.fromString(c.out),
    secret: Fr.fromString(c.secret),
    proofFields: c.proofFields.map((f) => Fr.fromString(f)),
    recipient: c.recipient,
  });
  const { txHash } = await interaction.send({ from, fee: fee as never, wait: NO_WAIT });
  const sent = d.lastSent();
  return {
    txHash: txHash.toString(),
    expiresAt: sent?.txHash === txHash.toString() ? sent.expiresAt : undefined,
    wait: async () => {
      await waitForTx(d.node, txHash, {
        timeout: CLAIM_WAIT_S,
        initialDelay: 1,
        waitForStatus: TxStatus.PROPOSED,
      });
      const receipt = await d.node.getTxReceipt(txHash, { includeTxEffect: true });
      if (!receipt.txEffect) throw new Error(`no effects for ${txHash.toString()}`);
      return { block: Number(receipt.blockNumber ?? 0), effect: receipt.txEffect };
    },
  };
}
export const sendRoll = async (d: Deployment, from: AztecAddress, fee: Fee): Promise<void> => {
  await d.miner.methods.roll().send({ from, fee: fee as never, wait: { timeout: 900 } });
};

export const readBalance = async (d: Deployment, from: AztecAddress): Promise<bigint> =>
  ((await d.token.methods.balance_of_private(from).simulate({ from })) as { result: bigint }).result;

export const readPublicBalance = async (
  d: Deployment,
  from: AztecAddress,
  owner: AztecAddress,
): Promise<bigint> =>
  ((await d.token.methods.balance_of_public(owner).simulate({ from })) as { result: bigint }).result;

export interface Withdrawal {
  to: AztecAddress;
  amount: bigint;
  /** private: notes to the recipient, nothing public. public: recipient and amount on chain. */
  mode: 'private' | 'public';
}

/** The token's transfer from private balance; nonce 0 (a self-call needs no authwit). */
export async function sendWithdraw(
  d: Deployment,
  from: AztecAddress,
  fee: Fee,
  w: Withdrawal,
): Promise<number> {
  const call =
    w.mode === 'private'
      ? d.token.methods.transfer_private_to_private(from, w.to, w.amount, 0)
      : d.token.methods.transfer_private_to_public(from, w.to, w.amount, 0);
  const sent = await call.send({ from, fee: fee as never, wait: { timeout: 900 } });
  return Number((sent as { receipt?: { blockNumber?: number } }).receipt?.blockNumber ?? 0);
}

/**
 * Whether anything knows `to` as a contract: a private transfer to an address nobody has deployed
 * mints notes nobody can read. Knowing the instance is not knowing that its owner syncs.
 */
export async function recipientKnown(wallet: EmbeddedWallet, node: Node, to: AztecAddress): Promise<boolean> {
  const meta = await wallet.getContractMetadata(to).catch(() => undefined);
  if (meta?.instance) return true;
  return (await node.getContract(to)) !== undefined;
}
