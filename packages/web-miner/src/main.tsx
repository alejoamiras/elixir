import '../../site/src/browser/node-guard.ts';
import { startCrs } from './pinned-crs';
import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../ui/src/index.ts';
import { App } from './App';
import { loadConnection } from './config';
import type { MinerController } from './controller';
import { Session } from './session';
import { bootAtom, claimsAtom, crsAtom, logAtom, nowAtom } from './state';
import { PROVERLESS } from './wallet';

const store = createStore();
// The proving keys download from the first moment, off the preflight's path: the wallet and the
// prover wait for them, the page does not. A failure is in the atom and in `crsReady()`.
startCrs((c) => store.set(crsAtom, c)).catch(() => {});
const connection = loadConnection();
// Claims history stays on this device (localStorage), under the deployment and, once an account is
// open, the account: another version's or another key's claims are not this cockpit's ledger.
const deploymentKey = `${import.meta.env.VITE_CHAIN_ID}.${import.meta.env.VITE_ROLLUP_VERSION}.${connection.miner}`;
const claimsKeyFor = (account?: string) => `yacana.claims.${deploymentKey}${account ? `.${account}` : ''}`;
let claimsKey = claimsKeyFor();
const loadClaims = (key: string) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as {
      epoch: string;
      block: number;
      at: number;
    }[];
    store.set(
      claimsAtom,
      stored.map((c) => ({ ...c, epoch: BigInt(c.epoch) })),
    );
  } catch {
    store.set(claimsAtom, []); // foreign value: start empty
  }
};
loadClaims(claimsKey);
store.sub(claimsAtom, () => {
  try {
    localStorage.setItem(
      claimsKey,
      JSON.stringify(store.get(claimsAtom).map((c) => ({ ...c, epoch: c.epoch.toString() }))),
    );
  } catch {
    /* private mode */
  }
});
const session = new Session(store, connection);
// The account's own ledger once it is open; signing out goes back to the device's.
store.sub(bootAtom, () => {
  const boot = store.get(bootAtom);
  const next = claimsKeyFor(boot.phase === 'ready' ? boot.account : undefined);
  if (next === claimsKey) return;
  claimsKey = next;
  loadClaims(claimsKey);
});
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
      /** The page's own log lines, the ones the About tile copies as diagnostics. */
      log: () => string[];
      /** Whether this build's PXE skips proving. */
      proverless: boolean;
      /** The next claim goes out with a bound public input altered: real proving must refuse it. */
      tamperNextClaim: () => void;
      /** The refused claim again with its input restored; false when there is none. */
      retryPendingClaim: () => boolean;
    };
  }
}
window.yacana = {
  store,
  session,
  controller: () => session.controller,
  ready: session.ready,
  crashProver: () => session.controller?.crashProver(),
  log: () => store.get(logAtom),
  proverless: PROVERLESS,
  tamperNextClaim: () => session.controller?.tamperNextClaim(),
  retryPendingClaim: () => session.controller?.retryPendingClaim() ?? false,
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
