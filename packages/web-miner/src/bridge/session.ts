// The bridge as the open account sees it: its journal (the store, mirrored into an atom), the
// portal's standing and the flip verdict read through the Ethereum RPC, the arrivals waiting for
// it, and the operations the sheets call. One instance per open account, started with it and
// stopped with it; nothing sends or claims on its own — every crossing begins with a tap.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { EthAddress } from '@aztec/foundation/eth-address';
import { getEpochAtSlot } from '@aztec/stdlib/epoch-helpers';
import { siloNullifier } from '@aztec/stdlib/hash';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import { Tag } from '@aztec/stdlib/logs';
import { computeFeeJuiceMessageNullifier } from '@aztec/stdlib/messaging';
import { MerkleTreeId } from '@aztec/stdlib/trees';
import { TxHash } from '@aztec/stdlib/tx';
import type { createStore } from 'jotai';
import { createPublicClient, type Hex, http, type PublicClient } from 'viem';
import { epochProven, proofDeadline, type RollupReads, rollupReads } from '../../../bridge/src/deadline.ts';
import { flipVerdict } from '../../../bridge/src/flip.ts';
import { claimLeaf } from '../../../bridge/src/inbox.ts';
import { advance, type Crossing, destinationOf, type Facts, inFlight } from '../../../bridge/src/journal.ts';
import { OperationQueue } from '../../../bridge/src/queue.ts';
import type { BridgeRecord } from '../../../bridge/src/record.ts';
import { asHint, parseRecoveryFile, type RecoveryFile, recoveryFile } from '../../../bridge/src/recovery.ts';
import { exitLogTag } from '../../../bridge/src/secrets.ts';
import { leafIdOf } from '../../../bridge/src/signatures.ts';
import {
  type ArchivedExit,
  archiveEntry,
  type ExitScope,
  exitMessageContent,
  fetchWitness,
  outboxLeaf,
  type RecordedExit,
  readArchive,
  verifiedArchiveEntry,
} from '../../../bridge/src/witness.ts';
import { readBalanceSnapshot, saveBalanceSnapshot } from '../bridge/snapshot.ts';
import type { Connection } from '../config';
import { fingerprintOf } from '../keys/classes';
import { type BridgeView, bridgeAtom, journalAtom } from '../state';
import { servedBuild, staleTab } from './env.ts';
import { type PortalReader, portalReader, type WagmiConfig, wagmiConfigFor } from './eth.ts';
import { type FactReads, factsFor } from './facts.ts';
import {
  claimArrival,
  deposit,
  exitToL1,
  type L2Handles,
  nextIndexFromChain,
  redeem,
  secretsFor,
  selfForward,
  sendAhead,
} from './flows.ts';
import { arrivalCandidates, landed, matchArrivals } from './landing.ts';
import { type BridgeStore, openBridgeStore, SCAN_WINDOW } from './store.ts';

type Store = ReturnType<typeof createStore>;

export interface BridgeSessionDeps {
  store: Store;
  node: AztecNode;
  /** The wallet and the contracts as they stand now; a rebuilt chain view replaces them under the session. */
  l2: () => L2Handles;
  from: AztecAddress;
  master: Uint8Array;
  connection: Connection;
  record: BridgeRecord;
  /** The miner's pause around a proof; absent on the old app, which mines nothing. */
  controller?: { pause(reason: 'bridge'): void; release(reason: 'bridge'): void };
  now?: () => number;
}

const REFRESH_MS = 15_000;
/** One refresh reads the clock for every crossing it holds against a deadline; one block answers them all. */
const L1_CLOCK_MS = 2_000;
/** The portal's events are scanned again every so many refreshes: a forward by Yacana lands while the page is open. */
const LANDING_EVERY = 4;

/** The archive the site serves for `version`, or null when it serves none (a 404, or no site). */
async function fetchArchive(version: string): Promise<string | null> {
  const root = (import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/');
  try {
    const res = await fetch(`${root}witnesses/${version}.jsonl`, { cache: 'no-store' });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}
/** One scan derives at most this many indices per version, whatever a file or a counter claims. */
const MAX_LANDING_INDICES = 2_000;

export class BridgeSession {
  readonly config: WagmiConfig;
  readonly reader: PortalReader;
  private readonly client: PublicClient;
  private readonly ctx: Parameters<typeof sendAhead>[0];
  private readonly journal: BridgeStore;
  private readonly reads: FactReads;
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshing: Promise<void> | undefined;
  private constants: Promise<{ epochDuration: number }> | undefined;
  private l1Clock: { at: number; value: Promise<bigint> } | undefined;
  private readonly rollups = new Map<string, Promise<RollupReads>>();
  /** The served witness archives by version, kept once read; a miss is asked for again next refresh. */
  private readonly archives = new Map<string, Promise<ArchivedExit[]>>();
  private readonly scope: ExitScope;
  private refreshes = 0;

  private constructor(
    private readonly d: BridgeSessionDeps,
    owner: string,
  ) {
    const chainId = Number(d.record.chainId);
    const client = createPublicClient({ transport: http(d.connection.ethRpcUrl, { retryCount: 0 }) });
    this.client = client;
    this.config = wagmiConfigFor({
      chainId,
      rpcUrl: d.connection.ethRpcUrl,
      ...(import.meta.env.VITE_L1_EXPLORER_URL !== 'off'
        ? { explorerUrl: import.meta.env.VITE_L1_EXPLORER_URL }
        : {}),
    });
    this.reader = portalReader(client, {
      portal: d.record.portal as Hex,
      registry: d.record.registry as Hex,
      deployBlock: BigInt(d.record.deployBlock ?? 0),
    });
    this.journal = openBridgeStore({ chainId: d.record.chainId, portal: d.record.portal as Hex, owner });
    this.ctx = {
      node: d.node,
      l2: d.l2,
      from: d.from,
      master: d.master,
      chainId: BigInt(d.record.chainId),
      version: BigInt(import.meta.env.VITE_ROLLUP_VERSION),
      portal: d.record.portal as Hex,
      yaca: d.record.yaca as Hex,
      store: this.journal,
      queue: new OperationQueue(),
      ...(d.controller
        ? {
            pause: (r: 'bridge') => d.controller?.pause(r),
            release: (r: 'bridge') => d.controller?.release(r),
          }
        : {}),
      l1Now: () => this.l1Now(),
      preflight: () => this.preflight(),
      ...(d.now ? { now: d.now } : {}),
    };
    this.rollups.set(
      this.ctx.version.toString(),
      Promise.resolve(rollupReads(client, import.meta.env.VITE_ROLLUP_ADDRESS as Hex)),
    );
    this.scope = {
      chainId: this.ctx.chainId,
      rollupVersion: this.ctx.version,
      miner: d.l2().miner.address,
      portal: EthAddress.fromString(d.record.portal),
    };
    this.reads = this.factReads(this.scope);
  }

  /** The Rollup of a crossing's own version: this build's from its record, an earlier one's from the Registry. */
  private rollupFor(version: string): Promise<RollupReads> {
    let r = this.rollups.get(version);
    if (!r) {
      r = this.reader.rollupOf(BigInt(version)).then((address) => rollupReads(this.client, address));
      r.catch(() => this.rollups.delete(version));
      this.rollups.set(version, r);
    }
    return r;
  }

  /** The record's own version is the one this build's node serves; an earlier version's chain is not here. */
  private servesVersion(c: Crossing): boolean {
    return BigInt(c.version) === this.ctx.version;
  }

  /**
   * The send's log by the tag the master derives: a record that lost its hash (the page closed
   * after the send) is named again by the chain, and the hash rejoins the journal.
   */
  private async txByTag(c: Crossing): Promise<Facts['tx']> {
    const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
    const tag = new Tag(await exitLogTag(c.kind === 1 ? secrets.tag : secrets.secretHash));
    const [logs] = await this.d.node.getPublicLogsByTags({
      contractAddress: this.d.l2().miner.address,
      tags: [tag],
    });
    const log = logs?.[0];
    if (!log) return undefined;
    const block = Number(log.blockNumber);
    return {
      status: 'mined',
      block,
      epoch: (await this.epochOfBlock(block)).toString(),
      txHash: log.txHash.toString(),
    };
  }

  /**
   * An earlier version's witness from the archive the site serves (`/witnesses/<version>.jsonl`,
   * committed by the operator once the exits settled): the only source once that version's node is
   * gone. The leaf names that version's own miner, the one the portal registered for it, not this
   * build's; the entry is believed only once its fold reaches that version's Outbox root. A miss
   * drops the cached file, so a republished archive is read at the next refresh.
   */
  private async archivedWitness(c: Crossing): Promise<ArchivedExit | undefined> {
    if (c.kind === 3) return undefined;
    const version = BigInt(c.version);
    const [entries, standing, secrets] = await Promise.all([
      this.archiveEntries(c.version),
      this.reader.standing(version),
      secretsFor(this.ctx, c.index, version),
    ]);
    const aux = (c.kind === 1 ? secrets.tag : secrets.secretHash).toString() as Hex;
    const entry = await verifiedArchiveEntry(
      entries,
      { ...c, kind: c.kind },
      aux,
      { ...this.scope, rollupVersion: version, miner: AztecAddress.fromStringUnsafe(standing.miner) },
      (epoch, n) => this.reader.outboxRoot(version, epoch, n),
    );
    if (!entry) this.archives.delete(c.version);
    return entry;
  }

  /** The served archive's entries, parsed once and kept until a lookup misses. */
  private archiveEntries(version: string): Promise<ArchivedExit[]> {
    const cached = this.archives.get(version);
    if (cached) return cached;
    const entries = fetchArchive(version).then((text) => (text === null ? [] : readArchive(text)));
    entries.catch(() => this.archives.delete(version));
    this.archives.set(version, entries);
    return entries;
  }

  /** For a version no node serves: a verified archive entry names the epoch of a send that lost it; the hash stays the record's. */
  private async txFromArchive(c: Crossing): Promise<Facts['tx']> {
    const w = await this.archivedWitness(c);
    return w ? { status: 'mined', epoch: w.epoch } : undefined;
  }

  /** The exit as the miner logged it, with the aux the master re-derives: the tag (K1) or the secret hash (K2). */
  private async recordedExit(c: Crossing): Promise<RecordedExit> {
    const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
    return {
      index: c.index,
      kind: c.kind as 1 | 2,
      amount: BigInt(c.amount),
      aux: (c.kind === 1 ? secrets.tag : secrets.secretHash).toString() as Hex,
      recipientOrRedeemKey: c.ethAddress,
      txHash: c.txHash as string,
    };
  }

  /** The siloed nullifier the miner's claim of this message leaves in the tree. */
  private async claimNullifier(
    c: Crossing,
    scope: ExitScope,
  ): Promise<import('@aztec/foundation/curves/bn254').Fr> {
    const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
    const leaf = claimLeaf(scope, BigInt(c.amount), secrets.secretHash, BigInt(c.inboxIndex as string));
    return siloNullifier(scope.miner, await computeFeeJuiceMessageNullifier(leaf, secrets.secret));
  }

  /** Each source of a crossing's facts behind one function: the node, the rollup, the portal, the destination. */
  private factReads(scope: ExitScope): FactReads {
    const d = this.d;
    const witnessLeaf = (c: Crossing) =>
      c.witness
        ? {
            epoch: BigInt(c.witness.epoch),
            leafId: leafIdOf({ path: c.witness.path, leafIndex: BigInt(c.witness.leafIndex) }),
          }
        : undefined;
    return {
      tx: async (c) => {
        if (!this.servesVersion(c)) return this.txFromArchive(c);
        if (!c.txHash) return this.txByTag(c);
        const r = await d.node.getTxReceipt(TxHash.fromString(c.txHash));
        if (r.status === 'dropped') return { status: 'dropped' };
        if (r.status === 'pending') return { status: 'pending' };
        const block = Number(r.blockNumber ?? 0);
        return { status: 'mined', block, epoch: (await this.epochOfBlock(block)).toString() };
      },
      epochOfBlock: async (c, block) =>
        this.servesVersion(c) ? (await this.epochOfBlock(block)).toString() : undefined,
      proofDeadline: async (c, epoch) => proofDeadline(await this.rollupFor(c.version), epoch),
      epochProven: async (c, epoch) => epochProven(await this.rollupFor(c.version), epoch),
      witness: async (c) => {
        if (!this.servesVersion(c)) return this.archivedWitness(c);
        const exit = await this.recordedExit(c);
        const leaf = outboxLeaf(
          { ...scope, rollupVersion: BigInt(c.version) },
          exitMessageContent(exit, EthAddress.fromString(exit.recipientOrRedeemKey)),
        );
        const w = await fetchWitness(d.node, exit.txHash, leaf);
        return w ? archiveEntry(BigInt(c.version), exit, w) : undefined;
      },
      portal: async (c) => {
        const standing = await this.reader.standing(BigInt(c.version));
        const canonical = await this.reader.canonical();
        const target =
          canonical.version === BigInt(c.version) ? undefined : await this.reader.standing(canonical.version);
        return {
          paused: standing.paused,
          hasHeadroom: standing.headroom >= BigInt(c.amount),
          deadlinePassed: (await this.l1Now()) > standing.deadline,
          canonicalIsNewer: canonical.index > standing.registryIndex,
          ...(target ? { canonicalRegistered: target.registered } : {}),
        };
      },
      forwarded: async (c) => {
        const w = witnessLeaf(c);
        if (!w) return undefined;
        const f = await this.reader.forwarded(BigInt(c.version), w.epoch, w.leafId);
        return f
          ? { txHash: f.txHash, inboxIndex: f.inboxIndex.toString(), target: f.target.toString() }
          : undefined;
      },
      redeemed: async (c) => {
        const w = witnessLeaf(c);
        return w ? this.reader.redeemed(BigInt(c.version), w.epoch, w.leafId) : undefined;
      },
      messageReady: async (c) => {
        if (!c.inboxIndex || !this.landsHere(c)) return false;
        const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
        const leaf = claimLeaf(scope, BigInt(c.amount), secrets.secretHash, BigInt(c.inboxIndex));
        return (await d.node.getL1ToL2MessageMembershipWitness('latest', leaf)) !== undefined;
      },
      claimed: async (c) => {
        if (!c.inboxIndex || !this.landsHere(c)) return undefined;
        const [leaf] = await d.node.findLeavesIndexes('latest', MerkleTreeId.NULLIFIER_TREE, [
          await this.claimNullifier(c, scope),
        ]);
        return leaf ? { txHash: c.claimTxHash ?? '', block: Number(leaf.l2BlockNumber) } : undefined;
      },
      nowSeconds: () => this.l1Now(),
    };
  }

  /** Whether the crossing's destination is this build's version: only its own node can see the claim. */
  private landsHere(c: Crossing): boolean {
    const destination = destinationOf(c);
    return destination !== undefined && BigInt(destination) === this.ctx.version;
  }

  /**
   * Ethereum's clock: the latest block's timestamp, which the portal measures every deadline and
   * signature expiry against. The device's clock is not consulted: a chain whose clock runs ahead
   * of the device's would refuse every signature dated from the device.
   */
  private l1Now(): Promise<bigint> {
    if (this.d.now) return Promise.resolve(BigInt(Math.floor(this.d.now() / 1000)));
    const at = Date.now();
    if (!this.l1Clock || at - this.l1Clock.at > L1_CLOCK_MS) {
      const value = this.client.getBlock({ blockTag: 'latest' }).then((b) => b.timestamp);
      value.catch(() => {
        if (this.l1Clock?.value === value) this.l1Clock = undefined;
      });
      this.l1Clock = { at, value };
    }
    return this.l1Clock.value;
  }

  /** One per open account: the journal is keyed by the master's fingerprint. */
  static async open(d: BridgeSessionDeps): Promise<BridgeSession> {
    return new BridgeSession(d, await fingerprintOf(d.master));
  }

  private async epochOfBlock(block: number): Promise<bigint> {
    this.constants ??= this.d.node.getL1Constants();
    const { epochDuration } = await this.constants;
    const b = await this.d.node.getBlock(block as never);
    if (!b) throw new Error(`block ${block} is not on this node`);
    return BigInt(getEpochAtSlot(b.header.globalVariables.slotNumber, { epochDuration }));
  }

  /** Lists the journal, reads the standing, scans arrivals once, then refreshes every 15 s. */
  async start(): Promise<void> {
    await this.publishJournal();
    try {
      await this.refresh();
    } finally {
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async publishJournal(): Promise<Crossing[]> {
    const list = (await this.journal.list()).sort((a, b) => b.createdAt - a.createdAt);
    this.d.store.set(journalAtom, list);
    return list;
  }

  /** The portal's standing and the flip verdict, then every in-flight crossing's next reading. */
  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refreshImpl().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  private async refreshImpl(): Promise<void> {
    const now = this.d.now?.() ?? Date.now();
    const version = this.ctx.version;
    const prev = this.d.store.get(bridgeAtom);
    let view: BridgeView;
    try {
      const [standing, canonical, retired] = await Promise.all([
        this.reader.standing(version),
        this.reader.canonical(),
        this.minerRetired(),
      ]);
      view = {
        verdict: flipVerdict({
          buildVersion: version,
          registryCanonical: canonical.version,
          minerRetired: retired,
          nodeVersion: null,
        }),
        standing,
        canonical,
        readAt: now,
        rpcFailing: false,
      };
    } catch {
      view = { ...prev, rpcFailing: true };
    }
    this.d.store.set(bridgeAtom, view);
    if (view.rpcFailing) return;
    if (this.refreshes++ % LANDING_EVERY === 0) await this.landing().catch(() => {});
    for (const c of await this.journal.list()) {
      if (inFlight(c)) await this.reread(c, now);
      else if (c.state === 'minted-l2' && !c.claimSettled && this.landsHere(c))
        await this.recheckClaim(c, now);
    }
    await this.publishJournal();
  }

  /**
   * One reading applied to the record as stored now: an operation that landed while the facts
   * were being read (a forward, a claim) is not rolled back by them.
   */
  private async reread(c: Crossing, now: number): Promise<void> {
    let next: Crossing;
    try {
      next = advance(c, await factsFor(this.reads, c, now));
    } catch (e) {
      next = { ...c, error: e instanceof Error ? e.message.split('\n')[0] : String(e), updatedAt: now };
    }
    if (next === c) return;
    await this.journal.update(c.id, (stored) =>
      stored.updatedAt === c.updatedAt && stored.state === c.state ? next : stored,
    );
  }

  /**
   * A minted record is asked about until its claim's epoch is proven — on every visit, however
   * late: a claim whose block was pruned with its epoch has no nullifier any more and is offered
   * again; one whose epoch is proven is settled and asked no more.
   */
  private async recheckClaim(c: Crossing, now: number): Promise<void> {
    try {
      const claimed = await this.reads.claimed(c);
      if (!claimed) {
        // Absence means pruning only from a node that has reached the claim's block; a node behind it knows nothing yet.
        if (c.claimBlock === undefined || (await this.d.node.getBlockNumber()) < c.claimBlock) return;
        await this.journal.update(c.id, (stored) =>
          stored.state === 'minted-l2'
            ? { ...stored, state: 'claimable', claimTxHash: undefined, claimBlock: undefined, updatedAt: now }
            : stored,
        );
        return;
      }
      // The block the nullifier is in now: a claim made again after a pruning has a newer one.
      const block = claimed.block;
      const settled = await epochProven(
        await this.rollupFor(this.ctx.version.toString()),
        await this.epochOfBlock(block),
      );
      if (settled || c.claimBlock !== block)
        await this.journal.update(c.id, (stored) =>
          stored.state === 'minted-l2'
            ? { ...stored, claimBlock: block, ...(settled ? { claimSettled: true } : {}) }
            : stored,
        );
    } catch {
      /* the node or the RPC did not answer: the record keeps its state until they do */
    }
  }

  private async minerRetired(): Promise<boolean | null> {
    try {
      const view = (await this.d.l2().miner.methods.bridge_state().simulate({ from: this.d.from })) as {
        result?: unknown[];
      };
      const retired = view.result?.[2];
      return typeof retired === 'boolean' ? retired : null;
    } catch {
      return null;
    }
  }

  /**
   * Send-aheads forwarded here from earlier versions and deposits into this one, as cards with a
   * Claim; window after window of indices past every index this account is known to have used
   * (exits arrive nowhere, so a silent window alone proves nothing) and until one answers nothing.
   * Each arrival is applied to the record as stored, in the transaction that reserves its index.
   */
  async landing(): Promise<void> {
    const versions = { sources: await this.sourceVersions(), current: this.ctx.version };
    const scope = { chainId: this.ctx.chainId, portal: EthAddress.fromString(this.ctx.portal) };
    const arrivals = await this.reader.arrivals();
    const now = this.d.now?.() ?? Date.now();
    const floor = await this.indicesInUse([...versions.sources, versions.current]);
    for (let from = 0; from < MAX_LANDING_INDICES; from += SCAN_WINDOW) {
      const candidates = await arrivalCandidates(this.d.master, scope, versions, SCAN_WINDOW, from);
      const arrived = matchArrivals(arrivals, candidates, {
        chainId: this.d.record.chainId,
        portal: this.ctx.portal,
        current: this.ctx.version,
      });
      for (const a of arrived) await this.journal.adopt(a.crossing(now), (stored) => landed(stored, a, now));
      if (arrived.length === 0 && from + SCAN_WINDOW >= floor) break;
    }
    await this.publishJournal();
  }

  /** One past the highest index of any of `versions` this device or the chain knows the account used. */
  private async indicesInUse(versions: bigint[]): Promise<number> {
    const journal = await this.journal.list();
    let floor = 0;
    for (const version of versions) {
      const held = journal
        .filter((c) => BigInt(c.version) === version)
        .reduce((max, c) => Math.max(max, c.index + 1), 0);
      const reserved = (await this.journal.nextIndex(version.toString())) ?? 0;
      const onChain = version === this.ctx.version ? await nextIndexFromChain(this.ctx).catch(() => 0) : 0;
      floor = Math.max(floor, held, reserved, onChain);
    }
    return floor;
  }

  /** The Registry's versions before this one: where a send-ahead to here may have come from. */
  private async sourceVersions(): Promise<bigint[]> {
    const canonical = await this.reader.canonical().catch(() => null);
    if (!canonical) return [];
    const standing = await this.reader.standing(this.ctx.version).catch(() => null);
    const mine = standing?.registered ? standing.registryIndex : canonical.index;
    const out: bigint[] = [];
    for (let i = 0n; i < mine; i++) out.push(await this.reader.versionAt(i));
    return out;
  }

  async sendAhead(amount: bigint): Promise<Crossing> {
    return this.after(() => sendAhead(this.ctx, amount));
  }
  async exitToL1(amount: bigint, recipient: Hex): Promise<Crossing> {
    return this.after(() => exitToL1(this.ctx, amount, recipient));
  }
  /** Refused when the portal routes this version's deposits to a miner other than this build's. */
  async deposit(
    amount: bigint,
    onStep?: (step: 'approve' | 'deposit') => void,
    resumes?: Crossing,
  ): Promise<Crossing> {
    return this.after(async () => {
      await this.registeredHere(this.ctx.version, 'deposits');
      const deadline = (await this.l1Now()) + 3600n;
      return deposit(this.ctx, this.config, amount, deadline, onStep, resumes);
    });
  }
  async claim(c: Crossing): Promise<Crossing> {
    return this.after(() => claimArrival(this.ctx, c));
  }
  /**
   * An exit goes to Ethereum. A send-ahead goes into the live version, which must be this build's
   * — its record names the miner the portal must route to; the old origin offers no forward.
   */
  async selfForward(c: Crossing): Promise<Crossing> {
    return this.after(async () => {
      const canonical = await this.reader.canonical();
      if (c.kind === 2) {
        if (canonical.version !== this.ctx.version)
          throw new Error(
            'forward it from the live version’s page: this build is not the version it lands on',
          );
        await this.registeredHere(canonical.version, 'send-aheads');
      }
      return selfForward(this.ctx, this.config, c, canonical.version);
    });
  }
  async redeem(c: Crossing, recipient: Hex): Promise<Crossing> {
    return this.after(() => redeem(this.ctx, this.config, c, recipient));
  }

  /** The portal routes `version`'s messages to its registered miner: it must be this build's. */
  private async registeredHere(version: bigint, what: string): Promise<void> {
    const standing = await this.reader.standing(version);
    const mine = this.d.l2().miner.address.toString().toLowerCase();
    if (!standing.registered || standing.miner.toLowerCase() !== mine)
      throw new Error(`the portal does not route ${what} to this build’s miner; update the page first`);
  }

  /**
   * Once the queue reaches an operation, before anything is signed: the site must still serve
   * this tab's build, and the Ethereum RPC must answer — a crossing nobody can watch is not made.
   */
  private async preflight(): Promise<void> {
    const served = await servedBuild();
    if (
      staleTab(served, {
        miner: this.d.l2().miner.address.toString(),
        rollupVersion: this.ctx.version.toString(),
      })
    )
      throw new Error('Yacana has been redeployed since this page loaded: reload before you send or claim.');
    await this.reader.canonical().catch(() => {
      throw new Error('the Ethereum RPC is not answering: nothing is sent until it does');
    });
  }

  private async after(op: () => Promise<Crossing>): Promise<Crossing> {
    try {
      return await op();
    } finally {
      await this.publishJournal();
    }
  }

  /** Every crossing of this account on this portal, as a file to keep. */
  async exportRecovery(): Promise<RecoveryFile> {
    return recoveryFile(
      { chainId: this.d.record.chainId, portal: this.ctx.portal, account: this.d.from.toString() },
      await this.journal.list(),
    );
  }

  /**
   * Restores the file's crossings the journal does not hold, their ended states as hints the chain
   * confirms. A witnessed crossing must be this master's: its aux is the tag or the secret hash the
   * master derives for that index, so another account's file — or a forged one — is refused whole.
   */
  async importRecovery(text: string): Promise<number> {
    const file = parseRecoveryFile(text, { chainId: this.d.record.chainId, portal: this.ctx.portal });
    for (const c of file.crossings) {
      if (!c.witness) continue;
      const s = await secretsFor(this.ctx, c.index, BigInt(c.version));
      const aux = (c.kind === 1 ? s.tag : s.secretHash).toString().toLowerCase();
      if (c.witness.aux.toLowerCase() !== aux) throw new Error(`crossing ${c.id} is not this account’s`);
    }
    let restored = 0;
    for (const c of file.crossings) {
      // A claim on another version's chain cannot be re-read here: the file's word stands for it.
      const hint = c.state === 'minted-l2' && !this.landsHere(c) ? c : asHint(c);
      const { added } = await this.journal.adopt(hint, (stored) => stored);
      if (added) restored++;
    }
    await this.publishJournal();
    return restored;
  }

  /** The balance the previous version's build last saw for this master, if this origin kept one. */
  previousBalance(previousVersion: string, token: string) {
    return readBalanceSnapshot(this.d.master, {
      chainId: this.d.record.chainId,
      rollupVersion: previousVersion,
      token,
      account: this.d.from.toString(),
    });
  }

  /** Written on every balance read: what the next version's build shows as "you still had". */
  rememberBalance(balance: bigint): Promise<void> {
    return saveBalanceSnapshot(
      this.d.master,
      {
        chainId: this.d.record.chainId,
        rollupVersion: import.meta.env.VITE_ROLLUP_VERSION,
        token: import.meta.env.VITE_YACANA_TOKEN,
        account: this.d.from.toString(),
      },
      { balance, at: this.d.now?.() ?? Date.now() },
    );
  }
}
