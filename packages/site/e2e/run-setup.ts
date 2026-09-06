// Bun-side E2E setup: a throwaway deployment on AZTEC_NODE_URL, the site assembled in e2e mode
// into e2e/.dist, served by `wrangler pages dev` (the `_headers` and `_redirects` Cloudflare would
// apply) on a registry-claimed port (lane 7; owned by the Playwright process, which outlives this
// script), and e2e/.run.json for the specs. The server binds `localhost`.
import { type ChildProcess, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { type Deployment, deployYacana } from '../../deploy/src/deploy.ts';
import { assemble } from '../src/assemble.ts';
import { type E2eRun, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const pkg = resolve(import.meta.dir, '..');
const OUT_DIR = resolve(pkg, 'e2e/.dist');

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

function startServer(log: number, port: number): ChildProcess {
  const args = ['wrangler', 'pages', 'dev', OUT_DIR, '--port', String(port), '--ip', 'localhost'];
  const child = spawn('bunx', args, {
    cwd: pkg,
    stdio: ['ignore', log, log],
    detached: true,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  });
  child.unref();
  return child;
}

async function waitUntilUp(baseURL: string, child: ChildProcess): Promise<boolean> {
  for (let i = 0; i < 240 && child.exitCode === null; i++) {
    const ok = await fetch(`${baseURL}/build.json`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return true;
    await delay(500);
  }
  return false;
}

const ownerPid = Number(process.env.E2E_OWNER_PID ?? process.ppid);
const runId = `site-e2e-${ownerPid}-${Date.now()}`;
const port = await claim({
  runId,
  service: 'wrangler',
  ownerPid,
  worktree: resolve(pkg, '../..'),
  base: lanePortBase(runPortWindowBase(runId), 7, 8),
  span: 8,
});
let spawned: ChildProcess | undefined;
try {
  // A target no proof reaches: the landing's demo scores its proof and never has a winner.
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n });
  await assemble(OUT_DIR, e2eEnv(deployed));
  const log = openSync(resolve(pkg, 'e2e/.wrangler.log'), 'w');
  spawned = startServer(log, port);
  const baseURL = `http://localhost:${port}`;
  if (!(await waitUntilUp(baseURL, spawned)))
    throw new Error(`wrangler pages dev did not start on ${baseURL} (see e2e/.wrangler.log)`);
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    serverPid: spawned.pid as number,
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
