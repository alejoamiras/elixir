// Boot in three parts: the preflight (isolation, CRS, node, deployment, each with its evidence),
// the key screen (a passkey or the words → a master), then wallet, account, rules and prover.
import type { ContractArtifact } from '@aztec/stdlib/abi';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { createStore } from 'jotai';
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
import { shortAddress } from './lib/format';
import { preloadPinnedCrs, purgeCrsCache } from './pinned-crs';
import { loadSettings } from './settings';
import { bootAtom, rulesAtom } from './state';
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
    { id: 'crs', label: 'pinned CRS', state: 'pending' },
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
  await run('crs', async () => {
    await purgeCrsCache();
    const { bytes, sha256 } = await preloadPinnedCrs();
    return {
      evidence: `${Math.round(bytes / 2 ** 20)} MiB · sha256 ${sha256.slice(0, 4)}…${sha256.slice(-4)}`,
      value: undefined,
    };
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
  store.set(bootAtom, { phase: 'key', records: await listRecords() });
  return { node, switchable, expected, chainId, rollupVersion, minerArtifact, block };
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
    c?.release('switch');
  }
}

/**
 * From a master (already checked against the record) to a running miner. `wallet()` is the current
 * one: a lost race replaces it with a rebuilt chain view.
 */
export async function startSession(
  store: Store,
  pre: Preflighted,
  connection: Connection,
  record: MasterRecord,
  master: Uint8Array,
): Promise<{ controller: MinerController; wallet: () => EmbeddedWallet }> {
  const step = (s: string) => store.set(bootAtom, { phase: 'opening', step: s });
  step('opening the wallet');
  let opened = await openWallet(pre.node, pre.chainId);
  let controller: MinerController | undefined;
  try {
    step(`registering your account ${shortAddress(record.account.address)}`);
    const fields = await deriveAccountFields(master, record.account.index);
    // A view built from another node (or one whose origin is unknown) is thrown away, never read
    // against this one: the PXE anchors on a node's tips and a lagging or lying node can prune or
    // poison it. The marker is written after the rebuild, so an interrupted one rebuilds again.
    const fingerprint = await endpointFingerprint(pre.switchable.current());
    if (viewBuiltOn(opened.pxeDb) !== fingerprint) {
      step('rebuilding the chain view from this node');
      opened = await resetAccountView(opened, pre.node, pre.chainId, fields);
    }
    const account = await registerAccount(opened, fields);
    if (account.toString() !== record.account.address)
      throw new Error('the wallet derived a different address than the vault');
    markViewBuiltOn(opened.pxeDb, fingerprint);
    step('registering the deployment');
    const attach = (o: OpenedWallet) =>
      attachDeployment(o.wallet, pre.node, connection, pre.minerArtifact, o.lastSent);
    const deployment = await attach(opened);
    store.set(rulesAtom, await readEpochRules(deployment, account));
    // A drop that fails leaves the old wallet stopped: reopen the namespace as it is, so the page
    // keeps a working wallet, and say so (`rebuilt: false`). Not when another tab holds the
    // namespace: a reopen would queue behind the pending delete, for good.
    const recover = async (): Promise<Rebound> => {
      let rebuilt = true;
      try {
        opened = await resetAccountView(opened, pre.node, pre.chainId, fields);
        markViewBuiltOn(opened.pxeDb, await endpointFingerprint(pre.switchable.current()));
      } catch (e) {
        if (e instanceof ChainViewHeldError) throw e;
        rebuilt = false;
        opened = await openWallet(pre.node, pre.chainId);
        await registerAccount(opened, fields);
      }
      return { deployment: await attach(opened), fee: opened.fee, rebuilt };
    };
    step('starting the prover');
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
    await controller.begin();
    store.set(bootAtom, { phase: 'ready', account: account.toString(), threads, record });
    return { controller, wallet: () => opened.wallet };
  } catch (e) {
    // Nothing of a failed start survives: a retry must not find a second PXE on the namespace.
    controller?.dispose();
    await opened.wallet.stop().catch(() => {});
    throw e;
  }
}
