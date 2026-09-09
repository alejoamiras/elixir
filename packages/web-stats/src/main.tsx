import '../../site/src/browser/node-guard.ts';
import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { expectedDeployment, loadConnection } from '../../site/src/browser/connection.ts';
import { endpointFingerprint, quietNodeReads } from '../../site/src/browser/node-guard.ts';
import { markRead, nodeHealth, startNodeHealth, waitTurn } from '../../site/src/browser/node-health.ts';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { type BeatReads, type BeatSinks, bootBeats, pollBeats, windowBeat } from './beats';
import { openReader, POLL_MS, type Reader } from './chain';
import { cacheKey, readCache, type StorageLike, writeCache } from './history-cache';
import { createFill } from './history-fill';
import { readFixed } from './read-fixed';
import { readLotteryOf, readWindowRows } from './read-window';
import { coalesced, serial } from './serial';
import {
  fillAtom,
  fixedAtom,
  type History,
  historyAtom,
  nowAtom,
  sinceOpenedAtom,
  slowAtom,
  statusAtom,
} from './state';
import { type EpochWindow, windowHeld } from './window';

const store = createStore();
const connection = loadConnection();
setInterval(() => store.set(nowAtom, Date.now()), 1000);
// Nothing under 300 ms: a beat that lands first never shows a skeleton; the ones still out at 300 ms do.
setTimeout(() => store.set(slowAtom, true), 300);

let reader: Reader | undefined;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const reads = (r: Reader): BeatReads => ({
  fixed: () => readFixed(r),
  rows: (from, to, open) => readWindowRows(r, from, to, open),
  lottery: () => readLotteryOf(r),
});

/** The browser's storage, or nothing where it throws (a locked-down context): the cache is optional. */
const storage = (): StorageLike | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};
/** The cache key: the deployment and the node, so a switch starts a fresh history. */
let key: string | undefined;
let cacheMerged = false;

const persist = (h: History, open: number): void => {
  const s = storage();
  if (key && s && !h.error) writeCache(s, key, h.rows, open);
};

/** Beat two's first publish joins the cached rows under the read ones: the map draws whole at once. */
const withCache = (h: History): History => {
  const fixed = store.get(fixedAtom);
  const s = storage();
  if (cacheMerged || h.error || !key || !s || !fixed) return h;
  cacheMerged = true;
  const cached = readCache(s, key, {
    launchAt: fixed.genesis.launchAt,
    now: Math.floor(Date.now() / 1000),
    open: fixed.open,
  });
  if (!cached) return h;
  const rows = new Map(cached);
  for (const [e, r] of h.rows) rows.set(e, r);
  return { ...h, rows };
};

/** Each beat lands in its atom the moment it is read; a chain read is what marks the node fresh. */
const publish: BeatSinks = {
  fixed: (f) => {
    markRead();
    store.set(fixedAtom, f);
    if (!store.get(sinceOpenedAtom)) store.set(sinceOpenedAtom, { supply: f.supply, at: Date.now() });
  },
  history: (h) => {
    if (!h.error) markRead();
    store.set(historyAtom, withCache(h));
  },
};

/** Window fetches queued or running: the fill yields to them. */
let foreground = 0;
/** Per window: not before this time (in flight, or failed — its error publish re-fires the ask at once). */
const askedUntil = new Map<string, number>();

/** A window the visitor asked for that is not held: read at once, ahead of the fill. */
const showWindow = (w: EpochWindow): Promise<void> => {
  const key = `${w.from}-${w.to}`;
  if ((askedUntil.get(key) ?? 0) > Date.now()) return Promise.resolve();
  askedUntil.set(key, Number.POSITIVE_INFINITY);
  foreground++;
  return serial(async () => {
    let failed = false;
    try {
      const fixed = store.get(fixedAtom);
      const history = store.get(historyAtom);
      if (reader && fixed && history && !windowHeld(history.rows, w, fixed.open))
        await windowBeat(reads(reader), publish, { fixed, history }, w);
      failed = !!store.get(historyAtom)?.error;
    } finally {
      foreground--;
      // A failure waits for the poll cadence; the poll's publish re-fires the ask.
      askedUntil.set(key, failed ? Date.now() + POLL_MS : 0);
    }
  });
};

const fill = createFill({
  // Quiet: a page the fill asks for never opens a cooldown (the fill stops itself on the first failure).
  rows: (from, to, open) =>
    reader
      ? quietNodeReads(() => readWindowRows(reader as Reader, from, to, open))
      : Promise.reject(new Error('no reader')),
  held: () => {
    const fixed = store.get(fixedAtom);
    const history = store.get(historyAtom);
    return fixed && history ? { open: fixed.open, history } : null;
  },
  publish: publish.history,
  transport: () => nodeHealth().transport.kind,
  foreground: () => foreground > 0,
  serial,
  persist,
  onState: (s) => store.set(fillAtom, s),
});

/** The 30 s poll: a failure marks the node unreachable and keeps the last view; an answer clears it. */
const poll = coalesced(async () => {
  const fixed = store.get(fixedAtom);
  if (!reader || !fixed) return;
  try {
    await pollBeats(reads(reader), publish, { fixed, history: store.get(historyAtom) });
    if (store.get(statusAtom).phase === 'unreachable') store.set(statusAtom, { phase: 'ready' });
  } catch (e) {
    const status = store.get(statusAtom);
    if (status.phase !== 'unreachable')
      store.set(statusAtom, { phase: 'unreachable', since: Date.now(), error: message(e) });
  }
});

const cacheKeyFor = async (): Promise<string | undefined> => {
  try {
    const expected = expectedDeployment();
    return cacheKey({
      chainId: expected.chainId.toString(),
      rollupAddress: expected.rollupAddress,
      miner: connection.miner,
      endpoint: await endpointFingerprint(connection.nodeUrl),
    });
  } catch {
    return undefined;
  }
};

/** A boot that fails because the node is throttled or silent waits for the store's turn and tries again. */
async function boot(): Promise<void> {
  startNodeHealth();
  key ??= await cacheKeyFor();
  try {
    store.set(statusAtom, { phase: 'loading', step: 'checking the deployment' });
    reader = await openReader(connection);
    store.set(statusAtom, { phase: 'loading', step: 'reading the chain' });
    const fixed = await bootBeats(reads(reader), publish);
    store.set(statusAtom, { phase: 'ready' });
    const history = store.get(historyAtom);
    if (history) persist(history, fixed.open);
    setInterval(() => {
      void poll();
      void fill.tick();
    }, POLL_MS);
    void fill.tick();
  } catch (e) {
    store.set(statusAtom, { phase: 'error', message: message(e) });
    if (nodeHealth().transport.kind === 'ok') return;
    await waitTurn();
    return boot();
  }
}

void boot();

declare global {
  interface Window {
    yacanaStats?: { store: typeof store; poll: () => Promise<void> };
  }
}
window.yacanaStats = { store, poll };

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Provider store={store}>
        <App connection={connection} onWindow={(w) => void showWindow(w)} />
      </Provider>
    </ThemeProvider>
  </StrictMode>,
);
