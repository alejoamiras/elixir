// Shared between the Bun-side setup/teardown scripts and the Node-side Playwright hooks; keep it
// free of imports so Playwright's loader never touches the repo's ESM modules.
export interface E2eRun {
  baseURL: string;
  /** The old role's assembly, served as the versioned origin (`v5.localhost`, a loopback name browsers resolve). */
  oldBaseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
  serverPid: number;
  oldServerPid: number;
  runId: string;
}

export const RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
