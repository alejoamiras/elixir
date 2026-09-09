// Bun-side E2E setup: a throwaway deployment on AZTEC_NODE_URL, Vite preview on a registry-claimed
// port (lane 4; owned by the Playwright process, which outlives this script), the mocked-RPC
// storage for the fixture spec, and e2e/.run.json for the specs. The server binds `localhost`.
import type { ChildProcess } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { Fr } from '@aztec/aztec.js/fields';
import { release } from '../../../scripts/run/registry.ts';
import { type Deployment, deployYacana } from '../../deploy/src/deploy.ts';
import { type E2eRun, MOCK_FILE, RUN_FILE } from './run.ts';
import { buildApp, claimPreviewPort, mockStorage, pkg, startPreview, waitUntilUp } from './serve.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const OUT_DIR = 'e2e/.dist';

// The mocked-RPC spec answers MOCK_NODE_ORIGIN, a local origin the e2e headers admit.
const e2eEnv = (d: Deployment): NodeJS.ProcessEnv => ({
  ...process.env,
  YACANA_SITE_MODE: 'e2e',
  VITE_AZTEC_NODE_URL: nodeUrl,
  VITE_RP_ID: 'localhost',
  VITE_E2E_QUERY_OVERRIDES: '1',
  VITE_CHAIN_ID: d.chainId,
  VITE_ROLLUP_VERSION: d.rollupVersion,
  VITE_ROLLUP_ADDRESS: d.rollupAddress,
  VITE_YACANA_MINER: d.miner,
  VITE_YACANA_TOKEN: d.token,
  VITE_YACANA_MINER_CLASS: d.minerClassId,
  VITE_YACANA_TOKEN_CLASS: d.tokenClassId,
  VITE_DEPLOYMENT_RECORD: JSON.stringify(d),
});

const ownerPid = Number(process.env.E2E_OWNER_PID ?? process.ppid);
const runId = `web-stats-e2e-${ownerPid}-${Date.now()}`;
const port = await claimPreviewPort(runId, ownerPid);
let spawned: ChildProcess | undefined;
try {
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 127n });
  await Bun.write(MOCK_FILE, JSON.stringify(await mockStorage(deployed)));
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  const env = e2eEnv(deployed);
  buildApp(OUT_DIR, log, env);
  spawned = startPreview(OUT_DIR, log, port, env);
  const vite = spawned;
  const baseURL = `http://localhost:${port}`;
  if (!(await waitUntilUp(baseURL, vite)))
    throw new Error(`vite preview did not start on ${baseURL} (see e2e/.vite.log)`);
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    minerClassId: deployed.minerClassId,
    tokenClassId: deployed.tokenClassId,
    chainId: deployed.chainId,
    rollupVersion: deployed.rollupVersion,
    vitePid: vite.pid as number,
    runId,
  };
  await Bun.write(RUN_FILE, JSON.stringify(run, null, 2));
  console.log(`e2e: ${baseURL} miner ${deployed.miner} token ${deployed.token}`);
  process.exit(0);
} catch (e) {
  // The server is detached: nothing else would reap it once this script is gone.
  if (spawned?.pid) {
    try {
      process.kill(-spawned.pid, 'SIGKILL');
    } catch {
      /* never started */
    }
  }
  await release(runId).catch(() => {});
  throw e;
}
