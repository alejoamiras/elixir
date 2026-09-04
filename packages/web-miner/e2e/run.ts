// Shared between the Bun-side setup/teardown scripts and the Node-side Playwright hooks; keep it
// free of imports so Playwright's loader never touches the repo's ESM modules.
export type E2eServer = 'dev' | 'preview';

export interface E2eRun {
  baseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
  vitePid: number;
  runId: string;
  /** `preview` serves a production build made for this run; `dev` is Vite's dev server. */
  server: E2eServer;
}

export const RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
