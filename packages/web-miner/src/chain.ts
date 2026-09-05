// Everything that touches a node: the deployment's contracts on a wallet, epoch reads with an
// optional second-node cross-check, the claim and roll transactions.
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { Gas } from '@aztec/stdlib/gas';
import { deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import { buildClaim } from '../../miner-core/src/claim.ts';
import { readOpenEpoch, readRules } from '../../miner-core/src/epoch.ts';
import type { EpochInfo } from './lib/reducer';

export type Node = ReturnType<typeof createAztecNodeClient>;

export interface Fee {
  paymentMethod: { getAsset(): unknown } & object;
  gasSettings: { gasLimits: Gas };
}

export interface Deployment {
  node: Node;
  miner: Contract;
  token: Contract;
}

const artifact = async (name: string) =>
  loadContractArtifact(await (await fetch(`/artifacts/${name}.json`)).json());

/** Registers the miner and token instances (fetched from the node) with the wallet. */
export async function attachDeployment(
  wallet: EmbeddedWallet,
  node: Node,
  addresses: { miner: string; token: string },
): Promise<Deployment> {
  const [minerArtifact, tokenArtifact] = await Promise.all([
    artifact('yacana_miner-YacanaMiner'),
    artifact('token_contract-Token'),
  ]);
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
  return { node, miner, token };
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

/**
 * A lying RPC cannot be detected by schema validation; a second node can contradict it. Reads the
 * open epoch and the target straight from public storage on the other node and compares.
 */
export async function crossCheck(d: Deployment, crossCheckUrl: string, epoch: EpochInfo): Promise<void> {
  const other = createAztecNodeClient(crossCheckUrl);
  const layout = d.miner.artifact.storageLayout;
  const openSlot = layout.open_epoch?.slot;
  const epochsSlot = layout.epochs?.slot;
  if (!openSlot || !epochsSlot) throw new Error('storage layout lacks open_epoch / epochs');
  const read = async (slot: Fr) =>
    (await other.getPublicStorageAt('latest', d.miner.address, slot)).toBigInt();
  const open = await read(openSlot);
  // EpochParams is stored packed as [target, seed, opened_at] followed by its hash.
  const base = (await deriveStorageSlotInMap(epochsSlot, { toField: () => new Fr(epoch.epoch) })).toBigInt();
  const [target, seed, openedAt] = await Promise.all([0n, 1n, 2n].map((i) => read(new Fr(base + i))));
  const disagreements = (
    [
      ['open_epoch', open, epoch.epoch],
      ['target', target, epoch.target],
      ['seed', seed, epoch.seed],
      ['opened_at', openedAt, epoch.openedAt],
    ] as const
  ).filter(([, theirs, ours]) => theirs !== ours);
  if (disagreements.length)
    throw new Error(
      `nodes disagree on ${disagreements.map(([name, theirs, ours]) => `${name} (primary ${ours}, cross-check ${theirs})`).join(', ')}`,
    );
}

export interface ClaimArgs {
  epoch: bigint;
  nonce: bigint;
  out: string;
  secret: string;
  proofFields: string[];
  recipient: AztecAddress;
}

/** Proves and sends the claim; resolves with the block number once the tx is in a proposed block. */
export async function sendClaim(d: Deployment, from: AztecAddress, fee: Fee, c: ClaimArgs): Promise<number> {
  const interaction = buildClaim(d.miner, {
    epoch: c.epoch,
    nonce: c.nonce,
    out: Fr.fromString(c.out),
    secret: Fr.fromString(c.secret),
    proofFields: c.proofFields.map((f) => Fr.fromString(f)),
    recipient: c.recipient,
  });
  const sent = await interaction.send({ from, fee: fee as never, wait: { timeout: 900 } });
  const receipt =
    (sent as { receipt?: { blockNumber?: number } }).receipt ?? (sent as { blockNumber?: number });
  return Number(receipt.blockNumber ?? 0);
}

export const sendRoll = async (d: Deployment, from: AztecAddress, fee: Fee): Promise<void> => {
  await d.miner.methods.roll().send({ from, fee: fee as never, wait: { timeout: 900 } });
};

export const readBalance = async (d: Deployment, from: AztecAddress): Promise<bigint> =>
  ((await d.token.methods.balance_of_private(from).simulate({ from })) as { result: bigint }).result;
