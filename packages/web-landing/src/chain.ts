// The page's chain state over time: the boot read, then a poll a minute. A failed poll keeps the
// last numbers and marks them unreachable; a failed boot is the error state.
import type { Connection } from '../../site/src/browser/connection.ts';
import { markRead, nodeHealth, startNodeHealth, waitTurn } from '../../site/src/browser/node-health.ts';
import {
  type Launch,
  type Live,
  openReader,
  POLL_MS,
  type Reader,
  readLaunch,
  readLaunched,
  readLive,
} from './live';
import { type LaunchStatus, type LiveStatus, launchMode } from './state';

export interface ChainSink {
  live: (s: LiveStatus | ((prev: LiveStatus) => LiveStatus)) => void;
  launch: (s: LaunchStatus | ((prev: LaunchStatus) => LaunchStatus)) => void;
}

export interface Reads {
  live: (r: Reader) => Promise<Live>;
  launch: (r: Reader) => Promise<Launch>;
  launched: (r: Reader) => Promise<boolean>;
}

const REAL: Reads = { live: readLive, launch: readLaunch, launched: readLaunched };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A failed poll: what was read stays on the page, marked as stale. */
export function markUnreachable(sink: ChainSink): void {
  sink.live((s) => (s.phase === 'ready' ? { ...s, unreachable: true } : s));
  sink.launch((s) => (s.phase === 'ready' ? { ...s, unreachable: true } : s));
}

/**
 * In launch mode the lottery is read first and on its own: before `launch()` epoch 0 does not
 * exist and the live read would refuse it.
 */
export async function readAll(
  reader: Reader,
  sink: ChainSink,
  launch = launchMode(),
  reads = REAL,
): Promise<void> {
  if (launch) {
    sink.launch({ phase: 'ready', launch: await reads.launch(reader), unreachable: false });
    if (!(await reads.launched(reader))) {
      sink.live({ phase: 'unlaunched' });
      return;
    }
  }
  sink.live({ phase: 'ready', live: await reads.live(reader), unreachable: false });
}

/** Starts the reads; the returned function stops them (nothing lands afterwards). */
export function watchChain(connection: Connection, sink: ChainSink): () => void {
  startNodeHealth();
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const guarded: ChainSink = {
    live: (s) => !stopped && sink.live(s),
    launch: (s) => !stopped && sink.launch(s),
  };
  const poll = async (reader: Reader) => {
    if (inFlight) return;
    inFlight = true;
    try {
      await readAll(reader, guarded);
      markRead();
    } catch {
      markUnreachable(guarded);
    } finally {
      inFlight = false;
    }
  };
  const fail = (e: unknown) => {
    guarded.live({ phase: 'error', message: message(e) });
    guarded.launch({ phase: 'error' });
  };
  // A failed initialisation is shown and, when the node is the reason (throttled or silent), retried
  // once the store says the node is usable again; a failed data read is retried by the polls.
  const start = async (): Promise<void> => {
    let reader: Reader;
    try {
      reader = await openReader(connection);
    } catch (e) {
      fail(e);
      if (stopped || nodeHealth().transport.kind === 'ok') return;
      await waitTurn();
      return stopped ? undefined : start();
    }
    try {
      await readAll(reader, guarded);
      markRead();
    } catch (e) {
      fail(e);
    }
    if (!stopped) timer = setInterval(() => void poll(reader), POLL_MS);
  };
  void start();
  return () => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
  };
}
