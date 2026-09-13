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
  /** A loopback port claimed for this run and never listened on: the spec's Presto that is not there. */
  closedPort: number;
  runId: string;
  /** `preview` serves a production build made for this run; `dev` is Vite's dev server. */
  server: E2eServer;
  /**
   * Bridge mode (E2E_BRIDGE=1, or the `bridge` shard): the portal and YACA deployed for this run
   * on the network's anvil against its real Registry, the run's control server, and the key of the
   * holder the test wallet signs with.
   */
  bridge?: E2eBridge | null;
  controlPid?: number | null;
}

export interface E2eBridge {
  portal: string;
  yaca: string;
  chainId: string;
  l1RpcUrl: string;
  controlUrl: string;
  holderKey: string;
}

/** The suite's own run file, or the one a rig names (E2E_RUN_FILE) when it drives a spec itself. */
export const RUN_FILE = process.env.E2E_RUN_FILE ?? new URL('./.run.json', import.meta.url).pathname;

/** What run-setup spent, step by step, left in e2e/.timings.json for report.ts. */
export interface RigStep {
  name: string;
  ms: number;
}
export interface RigTimings {
  steps: RigStep[];
}
export const TIMINGS_FILE = new URL('./.timings.json', import.meta.url).pathname;
