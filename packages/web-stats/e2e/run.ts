// Shared between the Bun-side setup/teardown scripts and the Node-side Playwright hooks; keep it
// free of imports so Playwright's loader never touches the repo's ESM modules.
export interface E2eRun {
  baseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
  chainId: string;
  rollupVersion: string;
  vitePid: number;
  runId: string;
}

export const RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
/** The mocked-RPC spec's storage: slot → value for the fixture's history, written by run-setup. */
export const MOCK_FILE = new URL('./.mock.json', import.meta.url).pathname;
