// Shared by the Bun-side setup and the Node-side Playwright hooks; no imports, so Playwright's
// loader never touches the repo's ESM modules.

/** The JSON-RPC origin the replay build is pointed at; nothing listens there, the spec answers. */
export const REPLAY_NODE_ORIGIN = 'http://127.0.0.1:1';

export interface ReplayDeployment {
  chainId: string;
  rollupVersion: string;
  rollupAddress: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
}

/** What the recording was taken against; a serve with any of these different refuses to replay it. */
export interface ReplayBinding {
  minerArtifactSha256: string;
  tokenArtifactSha256: string;
  layoutsSha256: string;
  aztecVersion: string;
}

export interface Recording {
  recordedAt: string;
  deployment: ReplayDeployment;
  binding: ReplayBinding;
  /** `method JSON(params)` → the result the node gave. */
  answers: Record<string, unknown>;
}

export interface ReplayRun {
  baseURL: string;
  vitePid: number;
  runId: string;
}

export const REPLAY_RUN_FILE = new URL('./.run.json', import.meta.url).pathname;
export const RECORDING_FILE = new URL('./recording.json', import.meta.url).pathname;

export const rpcKey = (c: { method: string; params?: unknown[] }): string =>
  `${c.method} ${JSON.stringify(c.params ?? [])}`;
