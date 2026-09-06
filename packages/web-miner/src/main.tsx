import './pinned-crs';
import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { aliasRedirect } from '../../site/src/browser/host.ts';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { loadConnection } from './config';
import type { MinerController } from './controller';
import { Session } from './session';
import { claimsAtom, nowAtom } from './state';

const alias = aliasRedirect(location);
if (alias) location.replace(alias);

const store = createStore();
const connection = loadConnection();
// Claims history stays on this device (localStorage), keyed by nothing: it names no key.
const CLAIMS_KEY = 'yacana.claims';
try {
  const stored = JSON.parse(localStorage.getItem(CLAIMS_KEY) ?? '[]') as {
    epoch: string;
    block: number;
    at: number;
  }[];
  store.set(
    claimsAtom,
    stored.map((c) => ({ ...c, epoch: BigInt(c.epoch) })),
  );
} catch {
  /* foreign value: start empty */
}
store.sub(claimsAtom, () => {
  try {
    localStorage.setItem(
      CLAIMS_KEY,
      JSON.stringify(store.get(claimsAtom).map((c) => ({ ...c, epoch: c.epoch.toString() }))),
    );
  } catch {
    /* private mode */
  }
});
const session = new Session(store, connection);
setInterval(() => store.set(nowAtom, Date.now()), 1000);

// E2E hooks: the test drives the same session and controller the buttons use.
declare global {
  interface Window {
    yacana?: {
      store: typeof store;
      session: Session;
      controller: () => MinerController | undefined;
      ready: Promise<unknown>;
      crashProver: () => void;
    };
  }
}
window.yacana = {
  store,
  session,
  controller: () => session.controller,
  ready: session.ready,
  crashProver: () => session.controller?.crashProver(),
};

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <Provider store={store}>
        <App connection={connection} session={session} />
      </Provider>
    </ThemeProvider>
  </StrictMode>,
);
