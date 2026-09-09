// Boot in three parts: the preflight (isolation, node, deployment, each with its evidence; the
// proving keys stream from page load beside it), the sign-in (a passkey or the words → a master),
// then the opening: wallet, account, rules and prover, as cancellable steps.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { createStore } from 'jotai';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { deriveAccountFields } from '../../miner-core/src/keys/derive.ts';
import { type ExpectedDeployment, expectedFromStrings } from '../../miner-core/src/reader.ts';
import { probeNode, type SwitchableNode, switchableNode } from '../../site/src/browser/node.ts';
import { endpointFingerprint, setNodeEndpoint } from '../../site/src/browser/node-guard.ts';
import { markRead, resetNodeHealth, startNodeHealth } from '../../site/src/browser/node-health.ts';
import { clampThreads, type PreflightRow } from '../../ui/src/index.ts';
import { attachDeployment, loadArtifact, type Node, readEpochRules } from './chain';
import type { Connection } from './config';
import { MinerController, type Rebound } from './controller';
import { preparePasskeys } from './keys/passkey';
import { assertNoLegacyWalletDb, listRecords, type MasterRecord } from './keys/store';
import { bytesDetail, initialSteps, type OpeningStep } from './opening-steps';
import { crsReady } from './pinned-crs';
import { type PublicEpochPoll, publicEpochReader, startPublicEpoch } from './public-epoch';
import { loadSettings } from './settings';
import { bootAtom, crsAtom, logAtom, rulesAtom } from './state';
import {
  ChainViewHeldError,
  type OpenedWallet,
  openWallet,
  registerAccount,
  resetAccountView,
} from './wallet';

type Store = ReturnType<typeof createStore>;

export interface Preflighted {
  /** The one handle every holder keeps; `switchable.use()` moves the node under them. */
  node: Node;
  switchable: SwitchableNode;
  expected: ExpectedDeployment;
  chainId: bigint;
  rollupVersion: bigint;
  minerArtifact: ContractArtifact;
  block: number;
  /** The open epoch from public storage while no account is open; stopped at the controller's first read. */
  publicEpoch: PublicEpochPoll;
  /** How long the node and deployment checks took, for the opening's step list. */
  nodeMs: number;
}

/** The build's deployment identity, as the boot and every node check compare it. */
export const expectedOf = (connection: Connection): ExpectedDeployment =>
  expectedFromStrings({
    chainId: import.meta.env.VITE_CHAIN_ID,
    rollupVersion: import.meta.env.VITE_ROLLUP_VERSION,
    rollupAddress: import.meta.env.VITE_ROLLUP_ADDRESS,
    miner: connection.miner,
    minerClassId: import.meta.env.VITE_YACANA_MINER_CLASS,
    token: connection.token,
    tokenClassId: import.meta.env.VITE_YACANA_TOKEN_CLASS,
  });

/** Which endpoint an account's chain view (the PXE namespace) was last built from; missing means unknown. */
const viewKey = (pxeDb: string) => `yacana.pxe-view.${pxeDb}`;
export const viewBuiltOn = (pxeDb: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(viewKey(pxeDb)) ?? null;
  } catch {
    return null;
  }
};
export const markViewBuiltOn = (pxeDb: string, fingerprint: string): void => {
  try {
    globalThis.localStorage?.setItem(viewKey(pxeDb), fingerprint);
  } catch {
    /* private mode: the next boot rebuilds, which is the safe side */
  }
};

const short = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-4)}`;

/** A request to the node that gets no answer for this long is dead. */
export const NODE_REQUEST_MS = 120_000;

/** Runs the checks one by one, each row's evidence landing in the store as it completes. */
export async function preflight(store: Store, connection: Connection): Promise<Preflighted> {
  const rows: PreflightRow[] = [
    { id: 'isolation', label: 'cross-origin isolated', state: 'pending' },
    { id: 'node', label: 'node', state: 'pending' },
    { id: 'deployment', label: 'deployment', state: 'pending' },
  ];
  const set = (id: string, patch: Partial<PreflightRow>) => {
    const i = rows.findIndex((r) => r.id === id);
    rows[i] = { ...(rows[i] as PreflightRow), ...patch };
    store.set(bootAtom, { phase: 'preflight', rows: [...rows] });
  };
  const run = async <T>(id: string, fn: () => Promise<{ evidence: string; value: T }>): Promise<T> => {
    set(id, { state: 'running' });
    const t0 = performance.now();
    try {
      const { evidence, value } = await fn();
      set(id, { state: 'ok', evidence, ms: performance.now() - t0 });
      return value;
    } catch (e) {
      set(id, {
        state: 'failed',
        error: e instanceof Error ? e.message : String(e),
        ms: performance.now() - t0,
      });
      throw e;
    }
  };
  set('isolation', { state: 'pending' });
  await run('isolation', async () => {
    if (!crossOriginIsolated)
      throw new Error(
        'this page is not cross-origin isolated: bb.js cannot use threads (check the COOP/COEP headers)',
      );
    await assertNoLegacyWalletDb();
    return { evidence: `${navigator.hardwareConcurrency || 2} threads available`, value: undefined };
  });
  setNodeEndpoint(connection.nodeUrl, NODE_REQUEST_MS);
  startNodeHealth();
  const switchable = switchableNode(connection.nodeUrl);
  const node = switchable.node;
  const expected = expectedOf(connection);
  const { chainId, rollupVersion, block } = await run('node', async () => {
    const [chain, info, tip] = await Promise.all([
      node.getChainId(),
      node.getNodeInfo(),
      node.getBlockNumber(),
    ]);
    const block = Number(tip);
    return {
      evidence: `${new URL(connection.nodeUrl).host} · block ${block.toLocaleString('en-US')}`,
      value: { chainId: BigInt(chain), rollupVersion: BigInt(info.rollupVersion), block },
    };
  });
  const minerArtifact = await run('deployment', async () => {
    const artifact = await loadArtifact('yacana_miner-YacanaMiner');
    // The same check the Node tile runs on a candidate, here on the node in use.
    const probe = await probeNode(
      connection.nodeUrl,
      expected,
      artifact.storageLayout,
      NODE_REQUEST_MS,
      () => node,
    );
    markRead();
    return {
      evidence: `miner ${short(connection.miner)} · class ${short(import.meta.env.VITE_YACANA_MINER_CLASS)} · block ${probe.block.toLocaleString('en-US')}, ${probe.blockAgeS} s old`,
      value: artifact,
    };
  });
  await preparePasskeys();
  const publicEpoch = startPublicChain(store, connection, node, minerArtifact);
  const nodeMs = rows.filter((r) => r.id !== 'isolation').reduce((n, r) => n + (r.ms ?? 0), 0);
  store.set(bootAtom, { phase: 'signedOut', records: await listRecords() });
  return { node, switchable, expected, chainId, rollupVersion, minerArtifact, block, publicEpoch, nodeMs };
}

/**
 * The chain before the account: the rules from the build's parameters (the contract's replace them
 * after sign-in) and the open epoch from public storage, polled until the controller's first read.
 */
function startPublicChain(
  store: Store,
  connection: Connection,
  node: Node,
  minerArtifact: ContractArtifact,
): PublicEpochPoll {
  store.set(rulesAtom, {
    N: PARAMS.N,
    EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS,
    T_MAX: PARAMS.T_MAX,
    REWARD: PARAMS.REWARD,
  });
  const log = (line: string) =>
    store.set(logAtom, (l) => [...l.slice(-199), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  const poll = startPublicEpoch(
    store,
    publicEpochReader(node, AztecAddress.fromStringUnsafe(connection.miner), minerArtifact.storageLayout),
    { log },
  );
  poll.start();
  return poll;
}

/**
 * Points every holder at another node without a reload: mining pauses, whatever is in flight
 * finishes, the handle moves, an open account's chain view is rebuilt from the new node (the
 * lost-race path, since the PXE's view is per rollup and a node behind or lying can prune or poison
 * it), mining resumes. The caller checked the candidate against this deployment first.
 */
export async function switchNodeLive(o: {
  controller: MinerController | undefined;
  switchable: SwitchableNode;
  url: string;
  deadlineMs?: number;
}): Promise<void> {
  const c = o.controller;
  c?.pause('switch');
  try {
    await c?.drain();
    o.switchable.use(o.url);
    setNodeEndpoint(o.url, o.deadlineMs ?? NODE_REQUEST_MS);
    resetNodeHealth();
    await c?.rebuildForNewNode();
  } finally {
    c?.endSwitch();
    c?.release('switch');
  }
}

/** Rejects with the signal's reason when it aborts: what a wait that cannot itself be cancelled races against. */
const aborted = (signal: AbortSignal): Promise<never> =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));

/** What the opening dialog needs to drive its steps and to be cancelled between them. */
export interface OpeningOpts {
  signal: AbortSignal;
  publish: (steps: OpeningStep[]) => void;
  /** The first step's label for the account's kind (a passkey, twelve words), and how long it took. */
  keyLabel?: string;
  keyMs?: number;
  /** How long the node step took, back in the preflight. */
  nodeMs?: number;
}

export interface Started {
  controller: MinerController;
  wallet: () => EmbeddedWallet;
  threads: number;
}

/**
 * From a master (already checked against the record) to a running miner, publishing the opening
 * steps and honouring the signal between them: an abort throws (its cleanup disposes the controller
 * and stops the wallet, so a retry never finds a second PXE). `wallet()` is the current one; a lost
 * race replaces it with a rebuilt chain view.
 */
export async function startSession(
  store: Store,
  pre: Preflighted,
  connection: Connection,
  record: MasterRecord,
  master: Uint8Array,
  opts: OpeningOpts,
): Promise<Started> {
  const steps = initialSteps(opts.keyLabel);
  if (opts.keyMs !== undefined) (steps[0] as OpeningStep).ms = opts.keyMs;
  if (opts.nodeMs !== undefined) (steps[1] as OpeningStep).ms = opts.nodeMs;
  const set = (id: OpeningStep['id'], patch: Partial<OpeningStep>) => {
    const i = steps.findIndex((s) => s.id === id);
    steps[i] = { ...(steps[i] as OpeningStep), ...patch };
    opts.publish(steps.map((s) => ({ ...s })));
  };
  opts.publish(steps.map((s) => ({ ...s })));
  opts.signal.throwIfAborted();

  // The proving keys: downloading since page load. Show the bytes as they land, then wait for the pin.
  // The wait is this attempt's, not the download's: a cancel leaves the shared download running.
  const t0 = performance.now();
  set('crs', { state: 'active' });
  const onCrs = () => {
    const c = store.get(crsAtom);
    set('crs', { state: 'active', bytes: { loaded: c.loaded, total: c.total }, detail: bytesDetail(c) });
  };
  onCrs();
  const unsub = store.sub(crsAtom, onCrs);
  try {
    await Promise.race([crsReady(), aborted(opts.signal)]);
  } finally {
    unsub();
  }
  opts.signal.throwIfAborted();
  set('crs', { state: 'done', bytes: undefined, detail: undefined, ms: performance.now() - t0 });

  // Notes and balance: the wallet, the account, the deployment, and the controller's first read.
  const t1 = performance.now();
  set('notes', { state: 'active' });
  let opened: OpenedWallet | undefined;
  let controller: MinerController | undefined;
  try {
    opts.signal.throwIfAborted();
    opened = await openWallet(pre.node, pre.chainId);
    opts.signal.throwIfAborted();
    const fields = await deriveAccountFields(master, record.account.index);
    // A view built from another node (or one whose origin is unknown) is thrown away, never read
    // against this one: the PXE anchors on a node's tips and a lagging or lying node can prune or
    // poison it. The marker is written after the rebuild, so an interrupted one rebuilds again.
    const fingerprint = await endpointFingerprint(pre.switchable.current());
    if (viewBuiltOn(opened.pxeDb) !== fingerprint)
      opened = await resetAccountView(opened, pre.node, pre.chainId, fields);
    const account = await registerAccount(opened, fields);
    if (account.toString() !== record.account.address)
      throw new Error('the wallet derived a different address than the vault');
    markViewBuiltOn(opened.pxeDb, fingerprint);
    opts.signal.throwIfAborted();
    const attach = (o: OpenedWallet) =>
      attachDeployment(o.wallet, pre.node, connection, pre.minerArtifact, o.lastSent);
    const deployment = await attach(opened);
    store.set(rulesAtom, await readEpochRules(deployment, account));
    // A drop that fails leaves the old wallet stopped: reopen the namespace as it is, so the page
    // keeps a working wallet, and say so (`rebuilt: false`). `strict` (a node switch) surfaces the
    // failure instead, never the reopen fallback, which against the new node would keep a stale view;
    // `ChainViewHeldError` (another tab holds the namespace) always surfaces (a reopen would queue
    // behind the pending delete, for good).
    const recover = async (strict = false): Promise<Rebound> => {
      let rebuilt = true;
      try {
        opened = await resetAccountView(opened as OpenedWallet, pre.node, pre.chainId, fields);
        markViewBuiltOn((opened as OpenedWallet).pxeDb, await endpointFingerprint(pre.switchable.current()));
      } catch (e) {
        if (e instanceof ChainViewHeldError || strict) throw e;
        rebuilt = false;
        opened = await openWallet(pre.node, pre.chainId);
        await registerAccount(opened, fields);
      }
      const o = opened as OpenedWallet;
      return { deployment: await attach(o), fee: o.fee, rebuilt };
    };
    const cores = navigator.hardwareConcurrency || 2;
    // A setting saved on another machine may exceed this one's cores: the slider's clamp applies.
    const threads = clampThreads(loadSettings().threads ?? Math.max(1, cores - 1), cores);
    const spawnWorker = () => new Worker(new URL('./prover.worker.ts', import.meta.url), { type: 'module' });
    controller = new MinerController({
      store,
      spawnWorker,
      threads,
      deployment,
      account,
      fee: opened.fee,
      chainId: pre.chainId,
      rollupVersion: pre.rollupVersion,
      recover,
    });
    await controller.ready();
    opts.signal.throwIfAborted();
    // The controller's first read owns the epoch from here; a public read still out lands nowhere.
    pre.publicEpoch.stop();
    await controller.begin();
    // A cancel that landed during the first read must not end in a running account.
    opts.signal.throwIfAborted();
    set('notes', { state: 'done', ms: performance.now() - t1 });
    set('ready', { state: 'done' });
    // Over the mutable handle: a rebuild (a lost race, a node switch) replaces `opened`.
    return { controller, wallet: () => (opened as OpenedWallet).wallet, threads };
  } catch (e) {
    // Nothing of an aborted or failed start survives: a retry must not find a second PXE on the
    // namespace, and the public poll takes the epoch back (it stopped only on a first read that stuck).
    controller?.dispose();
    await opened?.wallet.stop().catch(() => {});
    pre.publicEpoch.start();
    throw e;
  }
}
