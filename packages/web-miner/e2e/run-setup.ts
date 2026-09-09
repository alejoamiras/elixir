// Bun-side E2E setup: a throwaway deployment at an easy target on AZTEC_NODE_URL, Vite on a
// registry-claimed port (owned by the Playwright process, which outlives this script), and
// e2e/.run.json for the spec. Deploy needs Bun (artifacts are read with Bun.file). The server
// binds `localhost`, not 127.0.0.1: WebAuthn refuses an IP literal as an RP ID.
//
// E2E_SERVER=preview (default) builds the production bundle for this run into e2e/.dist and serves
// it with `vite preview`, so the Workers, CSP and allowlist under test are the ones that ship; the
// dev server injects Node globals and accepts local nodes on its own, which hid a Worker without
// `Buffer` once. E2E_SERVER=dev keeps the dev server for debugging with readable stacks.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import {
  type PrestoLane,
  prestoServerBinary,
  startPrestoServer,
  stopPrestoServer,
} from '../../../scripts/run/presto.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { type Deployment, deployYacana } from '../../deploy/src/deploy.ts';
import { type E2eRun, type E2eServer, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const server = (process.env.E2E_SERVER ?? 'preview') as E2eServer;
if (server !== 'dev' && server !== 'preview')
  throw new Error(`E2E_SERVER must be dev or preview, got ${server}`);
const pkg = resolve(import.meta.dir, '..');
const OUT_DIR = 'e2e/.dist';

/** The e2e build: the throwaway deployment, the local node, localhost as the RP ID, query overrides on, the run's Presto port. */
const e2eEnv = (d: Deployment, prestoPort: number | null): NodeJS.ProcessEnv => ({
  ...process.env,
  YACANA_SITE_MODE: 'e2e',
  VITE_PRESTO_E2E_PORT: prestoPort === null ? '' : String(prestoPort),
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
});

function buildForRun(log: number, env: NodeJS.ProcessEnv): void {
  execFileSync('bunx', ['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    env,
  });
}

function startServer(log: number, port: number, env: NodeJS.ProcessEnv): ChildProcess {
  const serve = ['--port', String(port), '--strictPort', '--host', 'localhost'];
  const args = server === 'preview' ? ['vite', 'preview', '--outDir', OUT_DIR, ...serve] : ['vite', ...serve];
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
const runId = `web-miner-e2e-${ownerPid}-${Date.now()}`;
const lane = {
  runId,
  ownerPid,
  worktree: resolve(pkg, '../..'),
  base: lanePortBase(runPortWindowBase(runId), 6, 8),
  span: 8,
};
const port = await claim({ ...lane, service: 'vite' });
const proxyPorts = [
  await claim({ ...lane, service: 'node-proxy-a' }),
  await claim({ ...lane, service: 'node-proxy-b' }),
];
// Claimed so nothing else on this host binds it for the run's duration; deliberately never listened on.
const closedPort = await claim({ ...lane, service: 'presto-closed' });
let spawned: ChildProcess | undefined;
let proxies: ChildProcess | undefined;
let presto: PrestoLane | null = null;
try {
  // The run's headless Presto: absent only where none is installed (presto.e2e.ts then skips); an
  // installed one that fails to start fails the run.
  if (prestoServerBinary())
    presto = await startPrestoServer({ lane, home: resolve(pkg, 'e2e/.presto-home', runId) });
  else console.log('e2e: presto-server is not installed; the Presto spec will skip');
  const target = BigInt(process.env.YACANA_E2E_TARGET ?? String(1n << 127n));
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: target });
  const hard = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 64n });
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  const env = e2eEnv(deployed, presto?.port ?? null);
  if (server === 'preview') buildForRun(log, env);
  spawned = startServer(log, port, env);
  const vite = spawned;
  const baseURL = `http://localhost:${port}`;
  if (!(await waitUntilUp(baseURL, vite)))
    throw new Error(`vite ${server} did not start on ${baseURL} (see e2e/.vite.log)`);
  proxies = spawn('bun', ['e2e/node-proxy.ts', nodeUrl, ...proxyPorts.map(String)], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    detached: true,
  });
  proxies.unref();
  const proxyA = `http://127.0.0.1:${proxyPorts[0]}`;
  const proxyB = `http://127.0.0.1:${proxyPorts[1]}`;
  for (let i = 0; i < 60; i++) {
    const up = await fetch(`${proxyA}/__stats`).then(
      (r) => r.ok,
      () => false,
    );
    if (up) break;
    await delay(250);
  }
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    hardMiner: hard.miner,
    hardToken: hard.token,
    proxyA,
    proxyB,
    proxyPid: proxies.pid as number,
    vitePid: vite.pid as number,
    prestoUrl: presto?.url ?? null,
    prestoPid: presto?.pid ?? null,
    prestoHome: presto?.home ?? null,
    closedPort,
    runId,
    server,
  };
  await Bun.write(RUN_FILE, JSON.stringify(run, null, 2));
  console.log(
    `e2e: ${baseURL} (${server}) miner ${deployed.miner} token ${deployed.token}${presto ? ` presto ${presto.url}` : ''}`,
  );
  process.exit(0);
} catch (e) {
  // The server is detached: nothing else would reap it once this script is gone.
  for (const child of [spawned, proxies]) {
    if (!child?.pid) continue;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* never started */
    }
  }
  if (presto) await stopPrestoServer(presto.pid);
  await release(runId).catch(() => {});
  throw e;
}
