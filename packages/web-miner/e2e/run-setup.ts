// Bun-side E2E setup: a throwaway deployment at an easy target on AZTEC_NODE_URL, Vite on a
// registry-claimed port (owned by the Playwright process, which outlives this script), and
// e2e/.run.json for the spec. Deploy needs Bun (artifacts are read with Bun.file).
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { deployElixir } from '../../deploy/src/deploy.ts';
import { type E2eRun, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const pkg = resolve(import.meta.dir, '..');
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
  const deployed = await deployElixir(nodeUrl, Fr.random(), Fr.random(), { initialTarget: target });
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  const vite = spawn('bunx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: pkg,
    stdio: ['ignore', log, log],
    detached: true,
  });
  vite.unref();
  const baseURL = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 120 && !up && vite.exitCode === null; i++) {
    up = await fetch(`${baseURL}/`).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await delay(500);
  }
  if (!up) throw new Error(`vite did not start on ${baseURL} (see e2e/.vite.log)`);
  const run: E2eRun = {
    baseURL,
    nodeUrl,
    miner: deployed.miner,
    token: deployed.token,
    vitePid: vite.pid as number,
    runId,
  };
  await Bun.write(RUN_FILE, JSON.stringify(run, null, 2));
  console.log(`e2e: ${baseURL} miner ${deployed.miner} token ${deployed.token}`);
  process.exit(0);
} catch (e) {
  await release(runId).catch(() => {});
  throw e;
}
