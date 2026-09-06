// Bun-side E2E setup: a throwaway deployment on AZTEC_NODE_URL, Vite preview on a registry-claimed
// port (lane 5; owned by the Playwright process, which outlives this script), and e2e/.run.json
// for the specs. The server binds `localhost`.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { type Deployment, deployYacana } from '../../deploy/src/deploy.ts';
import { type E2eRun, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const pkg = resolve(import.meta.dir, '..');
const OUT_DIR = 'e2e/.dist';

const e2eEnv = (d: Deployment): NodeJS.ProcessEnv => ({
  ...process.env,
  YACANA_SITE_MODE: 'e2e',
  VITE_AZTEC_NODE_URL: nodeUrl,
  VITE_ALLOWED_NODE_ORIGINS: new URL(nodeUrl as string).origin,
  VITE_RP_ID: 'localhost',
  VITE_E2E_QUERY_OVERRIDES: '1',
  VITE_CHAIN_ID: d.chainId,
  VITE_ROLLUP_VERSION: d.rollupVersion,
  VITE_YACANA_MINER: d.miner,
  VITE_YACANA_TOKEN: d.token,
  VITE_YACANA_MINER_CLASS: d.minerClassId,
  VITE_YACANA_TOKEN_CLASS: d.tokenClassId,
  VITE_DEPLOYMENT_RECORD: JSON.stringify(d),
});

function buildForRun(log: number, env: NodeJS.ProcessEnv): void {
  execFileSync('bunx', ['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    env,
  });
}

function startServer(log: number, port: number, env: NodeJS.ProcessEnv): ChildProcess {
  const args = [
    'vite',
    'preview',
    '--outDir',
    OUT_DIR,
    '--port',
    String(port),
    '--strictPort',
    '--host',
    'localhost',
  ];
  const child = spawn('bunx', args, { cwd: pkg, stdio: ['ignore', log, log], detached: true, env });
  child.unref();
  return child;
}

async function waitUntilUp(baseURL: string, child: ChildProcess): Promise<boolean> {
  for (let i = 0; i < 120 && child.exitCode === null; i++) {
    const ok = await fetch(`${baseURL}/`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return true;
    await delay(500);
  }
  return false;
}

const ownerPid = Number(process.env.E2E_OWNER_PID ?? process.ppid);
const runId = `web-landing-e2e-${ownerPid}-${Date.now()}`;
const port = await claim({
  runId,
  service: 'vite',
  ownerPid,
  worktree: resolve(pkg, '../..'),
  base: lanePortBase(runPortWindowBase(runId), 5, 8),
  span: 8,
});
let spawned: ChildProcess | undefined;
try {
  // A target no proof reaches: the demo scores its proof and never has a winner to discard.
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n });
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  const env = e2eEnv(deployed);
  buildForRun(log, env);
  spawned = startServer(log, port, env);
  const baseURL = `http://localhost:${port}`;
  if (!(await waitUntilUp(baseURL, spawned)))
    throw new Error(`vite preview did not start on ${baseURL} (see e2e/.vite.log)`);
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    vitePid: spawned.pid as number,
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
