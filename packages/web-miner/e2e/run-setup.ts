// Bun-side E2E setup: a throwaway deployment at an easy target on AZTEC_NODE_URL, Vite on a
// registry-claimed port (owned by the Playwright process, which outlives this script), and
// e2e/.run.json for the spec. Deploy needs Bun (artifacts are read with Bun.file).
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
import { claim, release } from '../../../scripts/run/registry.ts';
import { deployYacana } from '../../deploy/src/deploy.ts';
import { type E2eRun, type E2eServer, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const server = (process.env.E2E_SERVER ?? 'preview') as E2eServer;
if (server !== 'dev' && server !== 'preview')
  throw new Error(`E2E_SERVER must be dev or preview, got ${server}`);
const pkg = resolve(import.meta.dir, '..');
const OUT_DIR = 'e2e/.dist';
// The lying-node tests mock this origin; a production build refuses nodes outside its allowlist.
const MOCK_NODE_ORIGIN = 'http://127.0.0.1:1';

function buildForRun(log: number, miner: string, token: string): void {
  execFileSync('bunx', ['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      VITE_AZTEC_NODE_URL: nodeUrl,
      VITE_ELIXIR_MINER: miner,
      VITE_ELIXIR_TOKEN: token,
      VITE_ALLOWED_NODE_ORIGINS: `${new URL(nodeUrl as string).origin},${MOCK_NODE_ORIGIN}`,
    },
  });
}

function startServer(log: number, port: number): ChildProcess {
  const serve = ['--port', String(port), '--strictPort', '--host', '127.0.0.1'];
  const args = server === 'preview' ? ['vite', 'preview', '--outDir', OUT_DIR, ...serve] : ['vite', ...serve];
  const child = spawn('bunx', args, { cwd: pkg, stdio: ['ignore', log, log], detached: true });
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
const port = await claim({
  runId,
  service: 'vite',
  ownerPid,
  worktree: resolve(pkg, '../..'),
  base: lanePortBase(runPortWindowBase(runId), 6, 8),
  span: 8,
});
try {
  const target = BigInt(process.env.ELIXIR_E2E_TARGET ?? String(1n << 127n));
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: target });
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  if (server === 'preview') buildForRun(log, deployed.miner, deployed.token);
  const vite = startServer(log, port);
  const baseURL = `http://127.0.0.1:${port}`;
  if (!(await waitUntilUp(baseURL, vite)))
    throw new Error(`vite ${server} did not start on ${baseURL} (see e2e/.vite.log)`);
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    vitePid: vite.pid as number,
    runId,
    server,
  };
  await Bun.write(RUN_FILE, JSON.stringify(run, null, 2));
  console.log(`e2e: ${baseURL} (${server}) miner ${deployed.miner} token ${deployed.token}`);
  process.exit(0);
} catch (e) {
  await release(runId).catch(() => {});
  throw e;
}
