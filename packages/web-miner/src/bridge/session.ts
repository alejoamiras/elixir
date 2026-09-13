// The bridge as the open account sees it: its journal (the store, mirrored into an atom), the
// portal's standing and the flip verdict read through the Ethereum RPC, the arrivals waiting for
// it, and the operations the sheets call. One instance per open account, started with it and
// stopped with it; nothing sends or claims on its own — every crossing begins with a tap.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { EthAddress } from '@aztec/foundation/eth-address';
import { getEpochAtSlot } from '@aztec/stdlib/epoch-helpers';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import { TxHash } from '@aztec/stdlib/tx';
import type { createStore } from 'jotai';
import { createPublicClient, type Hex, http } from 'viem';
import { epochProven, proofDeadline, rollupReads } from '../../../bridge/src/deadline.ts';
import { flipVerdict } from '../../../bridge/src/flip.ts';
import { claimLeaf } from '../../../bridge/src/inbox.ts';
import { advance, type Crossing, inFlight } from '../../../bridge/src/journal.ts';
import { OperationQueue } from '../../../bridge/src/queue.ts';
import type { BridgeRecord } from '../../../bridge/src/record.ts';
import { parseRecoveryFile, type RecoveryFile, recoveryFile } from '../../../bridge/src/recovery.ts';
import { leafIdOf } from '../../../bridge/src/signatures.ts';
import {
  archiveEntry,
  type ExitScope,
  exitMessageContent,
  fetchWitness,
  outboxLeaf,
} from '../../../bridge/src/witness.ts';
import { readBalanceSnapshot, saveBalanceSnapshot } from '../bridge/snapshot.ts';
import type { Connection } from '../config';
import { fingerprintOf } from '../keys/classes';
import { type BridgeView, bridgeAtom, journalAtom } from '../state';
import { type PortalReader, portalReader, type WagmiConfig, wagmiConfigFor } from './eth.ts';
import { type FactReads, factsFor } from './facts.ts';
import {
  claimArrival,
  deposit,
  exitToL1,
  type L2Handles,
  redeem,
  secretsFor,
  selfForward,
  sendAhead,
} from './flows.ts';
import { arrivalCandidates, matchArrivals } from './landing.ts';
import { type BridgeStore, openBridgeStore } from './store.ts';

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

export class BridgeSession {
  readonly config: WagmiConfig;
  readonly reader: PortalReader;
  private readonly ctx: Parameters<typeof sendAhead>[0];
  private readonly journal: BridgeStore;
  private readonly reads: FactReads;
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshing: Promise<void> | undefined;
  private constants: Promise<{ epochDuration: number }> | undefined;

  private constructor(
    private readonly d: BridgeSessionDeps,
    owner: string,
  ) {
    const chainId = Number(d.record.chainId);
    const client = createPublicClient({ transport: http(d.connection.ethRpcUrl, { retryCount: 0 }) });
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
      ...(d.now ? { now: d.now } : {}),
    };
    const rollup = rollupReads(client, import.meta.env.VITE_ROLLUP_ADDRESS as Hex);
    const scope = {
      chainId: this.ctx.chainId,
      rollupVersion: this.ctx.version,
      miner: d.l2().miner.address,
      portal: EthAddress.fromString(d.record.portal),
    };
    this.reads = this.factReads(rollup, scope);
  }

  /** Each source of a crossing's facts behind one function: the node, the rollup, the portal, the destination. */
  private factReads(rollup: ReturnType<typeof rollupReads>, scope: ExitScope): FactReads {
    const d = this.d;
    /** The exit as the miner logged it, with the aux the master re-derives: the tag (K1) or the secret hash (K2). */
    const recorded = async (c: Crossing) => {
      const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
      const aux = (c.kind === 1 ? secrets.tag : secrets.secretHash).toString() as Hex;
      return {
        index: c.index,
        kind: c.kind as 1 | 2,
        amount: BigInt(c.amount),
        aux,
        recipientOrRedeemKey: c.ethAddress,
        txHash: c.txHash as string,
      };
    };
    const witnessLeaf = (c: Crossing) =>
      c.witness
        ? {
            epoch: BigInt(c.witness.epoch),
            leafId: leafIdOf({ path: c.witness.path, leafIndex: BigInt(c.witness.leafIndex) }),
          }
        : undefined;
    return {
      tx: async (c) => {
        const r = await d.node.getTxReceipt(TxHash.fromString(c.txHash as string));
        if (r.status === 'dropped') return { status: 'dropped' };
        if (r.status === 'pending') return { status: 'pending' };
        const block = Number(r.blockNumber ?? 0);
        return { status: 'mined', block, epoch: (await this.epochOfBlock(block)).toString() };
      },
      epochOfBlock: async (block) => (await this.epochOfBlock(block)).toString(),
      proofDeadline: (epoch) => proofDeadline(rollup, epoch),
      epochProven: (epoch) => epochProven(rollup, epoch),
      witness: async (c) => {
        const exit = await recorded(c);
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
          deadlinePassed: BigInt(Math.floor((d.now?.() ?? Date.now()) / 1000)) > standing.deadline,
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
        if (!c.inboxIndex) return false;
        const secrets = await secretsFor(this.ctx, c.index, BigInt(c.version));
        const leaf = claimLeaf(scope, BigInt(c.amount), secrets.secretHash, BigInt(c.inboxIndex));
        return (await d.node.getL1ToL2MessageMembershipWitness('latest', leaf)) !== undefined;
      },
      claimed: async () => undefined,
      nowSeconds: () => BigInt(Math.floor((d.now?.() ?? Date.now()) / 1000)),
    };
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
    await this.landing().catch(() => {});
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
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
    for (const c of await this.journal.list()) {
      if (!inFlight(c)) continue;
      try {
        const next = advance(c, await factsFor(this.reads, c, now));
        if (next !== c) await this.journal.put(next);
      } catch (e) {
        await this.journal.put({
          ...c,
          error: e instanceof Error ? e.message.split('\n')[0] : String(e),
          updatedAt: now,
        });
      }
    }
    await this.publishJournal();
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

  /** Send-aheads forwarded here from earlier versions and deposits into this one, as cards with a Claim. */
  async landing(): Promise<void> {
    const sources = await this.sourceVersions();
    const candidates = await arrivalCandidates(
      this.d.master,
      { chainId: this.ctx.chainId, portal: EthAddress.fromString(this.ctx.portal) },
      { sources, current: this.ctx.version },
    );
    const found = matchArrivals(
      await this.reader.arrivals(),
      candidates,
      await this.journal.list(),
      { chainId: this.d.record.chainId, portal: this.ctx.portal },
      this.d.now?.() ?? Date.now(),
    );
    for (const c of found) if (!(await this.journal.get(c.id))) await this.journal.put(c);
    await this.publishJournal();
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
    return this.after(sendAhead(this.ctx, amount));
  }
  async exitToL1(amount: bigint, recipient: Hex): Promise<Crossing> {
    return this.after(exitToL1(this.ctx, amount, recipient));
  }
  async deposit(amount: bigint, onStep?: (step: 'approve' | 'deposit') => void): Promise<Crossing> {
    const deadline = BigInt(Math.floor((this.d.now?.() ?? Date.now()) / 1000)) + 3600n;
    return this.after(deposit(this.ctx, this.config, amount, deadline, onStep));
  }
  async claim(c: Crossing): Promise<Crossing> {
    return this.after(claimArrival(this.ctx, c));
  }
  async selfForward(c: Crossing): Promise<Crossing> {
    const canonical = await this.reader.canonical();
    return this.after(selfForward(this.ctx, this.config, c, canonical.version));
  }
  async redeem(c: Crossing, recipient: Hex): Promise<Crossing> {
    return this.after(redeem(this.ctx, this.config, c, recipient));
  }

  private async after(op: Promise<Crossing>): Promise<Crossing> {
    try {
      return await op;
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

  /** Restores the file's crossings the journal does not hold; their states refresh from the chain. */
  async importRecovery(text: string): Promise<number> {
    const file = parseRecoveryFile(text, { chainId: this.d.record.chainId, portal: this.ctx.portal });
    let added = 0;
    for (const c of file.crossings) {
      if (await this.journal.get(c.id)) continue;
      await this.journal.put(c);
      added++;
    }
    await this.publishJournal();
    return added;
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
