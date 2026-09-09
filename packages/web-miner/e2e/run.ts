// Shared between the Bun-side setup/teardown scripts and the Node-side Playwright hooks; keep it
// free of imports so Playwright's loader never touches the repo's ESM modules.
export type E2eServer = 'dev' | 'preview';

export interface E2eRun {
  baseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
  /** A second deployment at an impossible target, for specs that must mine without ever winning. */
  hardMiner: string;
  hardToken: string;
  /** Two forwarding proxies in front of the node (`node-proxy.ts`), the switch spec's A and B. */
  proxyA: string;
  proxyB: string;
  proxyPid: number;
  vitePid: number;
  /** The run's headless Presto (`scripts/run/presto.ts`), or null when this machine has none installed. */
  prestoUrl: string | null;
  prestoPid: number | null;
  prestoHome: string | null;
  runId: string;
  /** `preview` serves a production build made for this run; `dev` is Vite's dev server. */
  server: E2eServer;
}

export const RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
