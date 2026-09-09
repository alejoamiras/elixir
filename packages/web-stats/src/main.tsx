import '../../site/src/browser/node-guard.ts';
import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConnection } from '../../site/src/browser/connection.ts';
import { markRead, nodeHealth, startNodeHealth, waitTurn } from '../../site/src/browser/node-health.ts';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { type BeatReads, type BeatSinks, bootBeats, olderBeat, pollBeats } from './beats';
import { openReader, POLL_MS, type Reader } from './chain';
import { readFixed } from './read-fixed';
import { readLotteryOf, readWindowRows } from './read-window';
import { coalesced, serial } from './serial';
import {
  fixedAtom,
  historyAtom,
  loadingOlderAtom,
  nowAtom,
  sinceOpenedAtom,
  slowAtom,
  statusAtom,
} from './state';

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

/** Each beat lands in its atom the moment it is read; a chain read is what marks the node fresh. */
const publish: BeatSinks = {
  fixed: (f) => {
    markRead();
    store.set(fixedAtom, f);
    if (!store.get(sinceOpenedAtom)) store.set(sinceOpenedAtom, { supply: f.supply, at: Date.now() });
  },
  history: (h) => {
    if (!h.error) markRead();
    store.set(historyAtom, h);
  },
};

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

/** A boot that fails because the node is throttled or silent waits for the store's turn and tries again. */
async function boot(): Promise<void> {
  startNodeHealth();
  try {
    store.set(statusAtom, { phase: 'loading', step: 'checking the deployment' });
    reader = await openReader(connection);
    store.set(statusAtom, { phase: 'loading', step: 'reading the chain' });
    await bootBeats(reads(reader), publish);
    store.set(statusAtom, { phase: 'ready' });
    setInterval(() => void poll(), POLL_MS);
  } catch (e) {
    store.set(statusAtom, { phase: 'error', message: message(e) });
    if (nodeHealth().transport.kind === 'ok') return;
    await waitTurn();
    return boot();
  }
}

/**
 * "Load older": the previous window, joined in front; a failure is a notice, not a crash. The flag
 * is taken before queueing, so a held key asks for one window, not one per repeat.
 */
const older = (): Promise<void> => {
  if (store.get(loadingOlderAtom)) return Promise.resolve();
  store.set(loadingOlderAtom, true);
  return serial(async () => {
    const fixed = store.get(fixedAtom);
    const history = store.get(historyAtom);
    try {
      if (reader && fixed && history) await olderBeat(reads(reader), publish, { fixed, history });
    } finally {
      store.set(loadingOlderAtom, false);
    }
  });
};

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
        <App connection={connection} onOlder={() => void older()} />
      </Provider>
    </ThemeProvider>
  </StrictMode>,
);
