// The Ethereum side from the page: wagmi's injected connector with EIP-6963 discovery (every
// installed wallet by name and icon, no WalletConnect) over the hoisted viem, the four writes a
// holder makes (approve + deposit, forward, redeem, note a transition), and the portal's reads over
// the RPC in use, which need no wallet at all. Gas comes from the injected wallet; the redeem key's
// signatures are made in `flows.ts`, never by the wallet.
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { RegistryAbi } from '@aztec/l1-artifacts/RegistryAbi';
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import {
  type Chain,
  type ContractFunctionArgs,
  defineChain,
  type Hex,
  type PublicClient,
  parseEventLogs,
} from 'viem';
import { createConfig, http, injected } from 'wagmi';
import {
  getAccount,
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions';
import { scanLogs } from '../../../bridge/src/logs.ts';
import { type ForwardArgs, yacaAbi, yacanaPortalAbi } from '../../../bridge/src/portal.ts';

export interface EthSettings {
  chainId: number;
  rpcUrl: string;
  /** The explorer's origin, or undefined for none. */
  explorerUrl?: string;
}

const NAMES: Record<number, string> = { 1: 'Ethereum', 11155111: 'Sepolia', 31337: 'Local Ethereum' };

export const bridgeChain = (s: EthSettings): Chain =>
  defineChain({
    id: s.chainId,
    name: NAMES[s.chainId] ?? `chain ${s.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [s.rpcUrl] } },
    ...(s.explorerUrl ? { blockExplorers: { default: { name: 'Explorer', url: s.explorerUrl } } } : {}),
  });

/** One chain, the page's RPC for reads, every injected wallet the browser announces as a connector. */
export const wagmiConfigFor = (s: EthSettings) => {
  const chain = bridgeChain(s);
  return createConfig({
    chains: [chain],
    connectors: [injected()],
    transports: { [chain.id]: http(s.rpcUrl, { retryCount: 0 }) },
    multiInjectedProviderDiscovery: true,
  });
};
export type WagmiConfig = ReturnType<typeof wagmiConfigFor>;

/** The struct as the ABI types it; `ForwardArgs` is the same shape, spelled once for the whole client. */
type PortalForwardArgs = ContractFunctionArgs<typeof yacanaPortalAbi, 'nonpayable', 'forward'>[1];
const asPortalArgs = (a: ForwardArgs): PortalForwardArgs =>
  ({ ...a, kind: a.kind as number }) as PortalForwardArgs;

/** The connected account, or an error that names the missing step. */
export function connectedAccount(config: WagmiConfig): Hex {
  const { address, isConnected } = getAccount(config);
  if (!isConnected || !address) throw new Error('connect an Ethereum wallet first');
  return address;
}

/**
 * Asks the wallet to move to the portal's chain when it is elsewhere. The connection's chain, not
 * the config's: a wallet on a chain the config does not list leaves the config on its own chain.
 */
export async function ensureChain(config: WagmiConfig, chainId: number): Promise<void> {
  if (getAccount(config).chainId !== chainId) await switchChain(config, { chainId });
}

const mined = async (config: WagmiConfig, hash: Hex) => {
  const receipt = await waitForTransactionReceipt(config, { hash });
  if (receipt.status !== 'success') throw new Error(`transaction ${hash} reverted`);
  return receipt;
};

export interface DepositParams {
  portal: Hex;
  yaca: Hex;
  amount: bigint;
  secretHash: Hex;
  version: bigint;
  /** Unix seconds after which the portal refuses it: the review's own stale bound. */
  deadline: bigint;
}

/**
 * A deposit is two transactions from the wallet when the portal's allowance is short: an approve
 * for the amount, then the deposit, whose event names the Inbox message the claim consumes.
 */
export async function depositOnEthereum(
  config: WagmiConfig,
  p: DepositParams,
  onStep?: (step: 'approve' | 'deposit') => void,
): Promise<{ txHash: Hex; inboxIndex: bigint }> {
  const owner = connectedAccount(config);
  await ensureChain(config, config.chains[0].id);
  const allowance = await readContract(config, {
    address: p.yaca,
    abi: yacaAbi,
    functionName: 'allowance',
    args: [owner, p.portal],
  });
  if (allowance < p.amount) {
    onStep?.('approve');
    await mined(
      config,
      await writeContract(config, {
        address: p.yaca,
        abi: yacaAbi,
        functionName: 'approve',
        args: [p.portal, p.amount],
      }),
    );
  }
  onStep?.('deposit');
  const txHash = await writeContract(config, {
    address: p.portal,
    abi: yacanaPortalAbi,
    functionName: 'deposit',
    args: [p.amount, p.secretHash, p.version, p.deadline],
  });
  const receipt = await mined(config, txHash);
  const [deposited] = parseEventLogs({ abi: yacanaPortalAbi, eventName: 'Deposited', logs: receipt.logs });
  if (!deposited) throw new Error(`deposit ${txHash} emitted no Deposited event`);
  return { txHash, inboxIndex: deposited.args.inboxIndex };
}

/** The holder's own forward: `args.sig` carries the redeem key's signature; the wallet pays the gas. */
export async function forwardOnEthereum(
  config: WagmiConfig,
  p: { portal: Hex; version: bigint; args: ForwardArgs },
): Promise<{ txHash: Hex; inboxIndex: bigint; target: bigint }> {
  connectedAccount(config);
  await ensureChain(config, config.chains[0].id);
  const txHash = await writeContract(config, {
    address: p.portal,
    abi: yacanaPortalAbi,
    functionName: 'forward',
    args: [p.version, asPortalArgs(p.args)],
  });
  const receipt = await mined(config, txHash);
  const [forwarded] = parseEventLogs({ abi: yacanaPortalAbi, eventName: 'Forwarded', logs: receipt.logs });
  if (!forwarded) throw new Error(`forward ${txHash} emitted no Forwarded event`);
  return { txHash, inboxIndex: forwarded.args.inboxIndex, target: forwarded.args.target };
}

export async function redeemOnEthereum(
  config: WagmiConfig,
  p: { portal: Hex; version: bigint; args: ForwardArgs; recipient: Hex; expiry: bigint; sig: Hex },
): Promise<{ txHash: Hex }> {
  connectedAccount(config);
  await ensureChain(config, config.chains[0].id);
  const txHash = await writeContract(config, {
    address: p.portal,
    abi: yacanaPortalAbi,
    functionName: 'redeem',
    args: [
      p.version,
      asPortalArgs({ ...p.args, expiry: p.expiry, sig: p.sig }),
      p.recipient,
      p.expiry,
      p.sig,
    ],
  });
  await mined(config, txHash);
  return { txHash };
}

/** Records a Registry transition the portal has not seen; anyone may, and a forward after a flip must. */
export async function noteTransitionOnEthereum(
  config: WagmiConfig,
  portal: Hex,
  index: bigint,
): Promise<Hex> {
  connectedAccount(config);
  await ensureChain(config, config.chains[0].id);
  const txHash = await writeContract(config, {
    address: portal,
    abi: yacanaPortalAbi,
    functionName: 'noteTransition',
    args: [index],
  });
  await mined(config, txHash);
  return txHash;
}

export interface PortalAddresses {
  portal: Hex;
  registry: Hex;
  /** Where log scans start. */
  deployBlock: bigint;
}

export interface VersionStanding {
  registered: boolean;
  miner: Hex;
  registryIndex: bigint;
  flipAt: bigint;
  paused: boolean;
  headroom: bigint;
  /** Unix seconds; the max uint256 while open-ended. */
  deadline: bigint;
  retireSent: boolean;
  depositsClosed: boolean;
}

/** The portal and the Registry read through the page's RPC; no wallet, no signature. */
export const portalReader = (client: PublicClient, a: PortalAddresses) => {
  const portal = { address: a.portal, abi: yacanaPortalAbi } as const;
  const registry = { address: a.registry, abi: RegistryAbi } as const;
  return {
    async standing(version: bigint): Promise<VersionStanding> {
      const [info, flipAt, paused, headroom, deadline] = await Promise.all([
        client.readContract({ ...portal, functionName: 'versionInfo', args: [version] }),
        client.readContract({ ...portal, functionName: 'flipAt', args: [version] }),
        client.readContract({ ...portal, functionName: 'isPaused', args: [version] }),
        client.readContract({ ...portal, functionName: 'headroom', args: [version] }),
        client.readContract({ ...portal, functionName: 'deadline', args: [version] }),
      ]);
      return {
        registered: info.registered,
        miner: info.miner,
        registryIndex: BigInt(info.registryIndex),
        flipAt: BigInt(flipAt),
        paused,
        headroom,
        deadline,
        retireSent: info.retireSent,
        depositsClosed: info.depositsClosed,
      };
    },
    /** The Registry's canonical version and its index. */
    async canonical(): Promise<{ version: bigint; index: bigint }> {
      const count = await client.readContract({ ...registry, functionName: 'numberOfVersions' });
      const index = count - 1n;
      return {
        version: await client.readContract({ ...registry, functionName: 'getVersion', args: [index] }),
        index,
      };
    },
    /** The version at Registry index `index`. */
    versionAt: (index: bigint) =>
      client.readContract({ ...registry, functionName: 'getVersion', args: [index] }),
    /** Whether the portal has stamped Registry index `index`. */
    async transitionSeen(index: bigint): Promise<boolean> {
      return (await client.readContract({ ...portal, functionName: 'transitions', args: [index] })) !== 0n;
    },
    /** Whether `version`'s Outbox nullified the leaf: forwarded or redeemed already. */
    async consumed(version: bigint, epoch: bigint, leafId: bigint): Promise<boolean> {
      const rollup = await client.readContract({ ...registry, functionName: 'getRollup', args: [version] });
      const outbox = await client.readContract({
        address: rollup,
        abi: RollupAbi,
        functionName: 'getOutbox',
      });
      return client.readContract({
        address: outbox,
        abi: OutboxAbi,
        functionName: 'hasMessageBeenConsumedAtEpoch',
        args: [epoch, leafId],
      });
    },
    /** The `Forwarded` event of one leaf, if any. */
    async forwarded(version: bigint, epoch: bigint, leafId: bigint) {
      const [log] = await scanLogs(client, {
        ...portal,
        eventName: 'Forwarded',
        args: { version, epoch, leafId },
        fromBlock: a.deployBlock,
        toBlock: await client.getBlockNumber({ cacheTime: 0 }),
        first: true,
      });
      return log
        ? { txHash: log.transactionHash, inboxIndex: log.args.inboxIndex, target: log.args.target }
        : undefined;
    },
    async redeemed(version: bigint, epoch: bigint, leafId: bigint) {
      const [log] = await scanLogs(client, {
        ...portal,
        eventName: 'Redeemed',
        args: { version, epoch, leafId },
        fromBlock: a.deployBlock,
        toBlock: await client.getBlockNumber({ cacheTime: 0 }),
        first: true,
      });
      return log ? { txHash: log.transactionHash } : undefined;
    },
    arrivals: () => readArrivals(client, a),
  };
};

/** Every send-ahead forwarded into any version and every deposit, from the deploy block: the landing's raw material. */
async function readArrivals(client: PublicClient, a: PortalAddresses) {
  const portal = { address: a.portal, abi: yacanaPortalAbi } as const;
  const toBlock = await client.getBlockNumber({ cacheTime: 0 });
  const [forwarded, deposited] = await Promise.all([
    scanLogs(client, { ...portal, eventName: 'Forwarded', fromBlock: a.deployBlock, toBlock }),
    scanLogs(client, { ...portal, eventName: 'Deposited', fromBlock: a.deployBlock, toBlock }),
  ]);
  return {
    forwarded: forwarded
      .filter((l) => l.args.kind === 2)
      .map((l) => ({
        secretHash: l.args.aux,
        source: l.args.version,
        target: l.args.target,
        amount: l.args.amount,
        inboxIndex: l.args.inboxIndex,
        txHash: l.transactionHash,
      })),
    deposited: deposited.map((l) => ({
      secretHash: l.args.secretHash,
      version: l.args.version,
      amount: l.args.amount,
      inboxIndex: l.args.inboxIndex,
      txHash: l.transactionHash,
    })),
  };
}
export type PortalReader = ReturnType<typeof portalReader>;
