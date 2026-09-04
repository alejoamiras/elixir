import './pinned-crs';
import './index.css';
import { createStore, Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { boot } from './boot';
import { loadConnection } from './config';
import type { MinerController } from './controller';
import { bootAtom, nowAtom } from './state';

const store = createStore();
const connection = loadConnection();
let controller: MinerController | undefined;
const controllerPromise = boot(store, connection).then(
  (c) => (controller = c),
  (e: unknown) =>
    store.set(bootAtom, { phase: 'error', message: e instanceof Error ? e.message : String(e) }),
);
setInterval(() => store.set(nowAtom, Date.now()), 1000);

// E2E hooks: the test drives the same controller the buttons use.
declare global {
  interface Window {
    elixir?: {
      store: typeof store;
      controller: () => MinerController | undefined;
      ready: Promise<unknown>;
      crashProver: () => void;
    };
  }
}
window.elixir = {
  store,
  controller: () => controller,
  ready: controllerPromise,
  crashProver: () => controller?.crashProver(),
};

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App connection={connection} controller={() => controller} />
    </Provider>
  </StrictMode>,
);
