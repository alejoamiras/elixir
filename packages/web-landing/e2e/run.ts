// Shared between the Bun-side setup/teardown scripts and the Node-side Playwright hooks; keep it
// free of imports so Playwright's loader never touches the repo's ESM modules.
export interface E2eRun {
  baseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
  vitePid: number;
  runId: string;
}

export const RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
