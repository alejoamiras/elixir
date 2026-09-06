import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConnection } from '../../site/src/browser/connection.ts';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { openReader, pollChain, type Reader, readChain, readOlder } from './chain';
import { type Chain, chainAtom, historyLimitAtom, loadingOlderAtom, nowAtom, statusAtom } from './state';

const POLL_MS = 30_000;

const store = createStore();
const connection = loadConnection();
setInterval(() => store.set(nowAtom, Date.now()), 1000);

let reader: Reader | undefined;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Chain reads run one at a time: a poll and a "load older" must not each publish a stale whole. */
let inFlight: Promise<void> = Promise.resolve();
const serial = (fn: () => Promise<void>): Promise<void> => {
  const run = inFlight.then(fn);
  inFlight = run.catch(() => {});
  return run;
};

const historyLimit = (chain: Chain, reason: string) =>
  store.set(historyLimitAtom, { beyond: chain.rows.at(-1)?.epoch ?? 0, reason });

/** The 30 s poll: a failure marks the node unreachable and keeps the last view; an answer clears it. */
const poll = () =>
  serial(async () => {
    const chain = store.get(chainAtom);
    if (!reader || !chain) return;
    try {
      const { chain: next, historyError } = await pollChain(reader, chain);
      store.set(chainAtom, next);
      if (historyError) historyLimit(next, historyError);
      else if (store.get(historyLimitAtom)) store.set(historyLimitAtom, null);
      if (store.get(statusAtom).phase === 'unreachable') store.set(statusAtom, { phase: 'ready' });
    } catch (e) {
      const status = store.get(statusAtom);
      if (status.phase !== 'unreachable')
        store.set(statusAtom, { phase: 'unreachable', since: Date.now(), error: message(e) });
    }
  });

async function boot() {
  try {
    store.set(statusAtom, { phase: 'loading', step: 'checking the deployment' });
    reader = await openReader(connection);
    const { chain, historyError } = await readChain(reader, (step) =>
      store.set(statusAtom, { phase: 'loading', step }),
    );
    store.set(chainAtom, chain);
    if (historyError) historyLimit(chain, historyError);
    store.set(statusAtom, { phase: 'ready' });
    setInterval(() => void poll(), POLL_MS);
  } catch (e) {
    store.set(statusAtom, { phase: 'error', message: message(e) });
  }
}

/** "Load older": the previous window, joined in front; a failure is a notice, not a crash. */
const older = () =>
  serial(async () => {
    const chain = store.get(chainAtom);
    if (!reader || !chain || store.get(loadingOlderAtom)) return;
    store.set(loadingOlderAtom, true);
    try {
      store.set(chainAtom, await readOlder(reader, chain));
    } catch (e) {
      store.set(historyLimitAtom, { beyond: chain.rows[0]?.epoch ?? 0, reason: message(e) });
    } finally {
      store.set(loadingOlderAtom, false);
    }
  });

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
