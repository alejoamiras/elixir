// The page's chain state over time: the boot read, then a poll a minute. A failed poll keeps the
// last numbers and marks them unreachable; a failed boot is the error state.
import type { Connection } from '../../site/src/browser/connection.ts';
import { openReader, POLL_MS, type Reader, readLaunch, readLive } from './live';
import { type LaunchStatus, type LiveStatus, launchMode } from './state';

export interface ChainSink {
  live: (s: LiveStatus | ((prev: LiveStatus) => LiveStatus)) => void;
  launch: (s: LaunchStatus) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function readAll(reader: Reader, sink: ChainSink): Promise<void> {
  sink.live({ phase: 'ready', live: await readLive(reader), unreachable: false });
  if (launchMode()) sink.launch({ phase: 'ready', launch: await readLaunch(reader) });
}

/** Starts the reads; the returned function stops them (nothing lands afterwards). */
export function watchChain(connection: Connection, sink: ChainSink): () => void {
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
    } catch {
      guarded.live((s) => (s.phase === 'ready' ? { ...s, unreachable: true } : s));
    } finally {
      inFlight = false;
    }
  };
  (async () => {
    try {
      const reader = await openReader(connection);
      await readAll(reader, guarded);
      if (!stopped) timer = setInterval(() => void poll(reader), POLL_MS);
    } catch (e) {
      guarded.live({ phase: 'error', message: message(e) });
      guarded.launch({ phase: 'error' });
    }
  })();
  return () => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
  };
}
