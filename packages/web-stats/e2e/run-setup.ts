// Bun-side E2E setup: a throwaway deployment on AZTEC_NODE_URL, Vite preview on a registry-claimed
// port (lane 4; owned by the Playwright process, which outlives this script), the mocked-RPC
// storage for the fixture spec, and e2e/.run.json for the specs. The server binds `localhost`.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Fr } from '@aztec/aztec.js/fields';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { type Deployment, deployYacana } from '../../deploy/src/deploy.ts';
import { loadMinerArtifact } from '../../miner-core/src/artifacts.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { rowsFromJson } from '../../miner-core/src/reader.ts';
import { deriveSlotTable } from '../../miner-core/src/slots.ts';
import { type E2eRun, MOCK_FILE, RUN_FILE } from './run.ts';

const nodeUrl = process.env.AZTEC_NODE_URL;
if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
const pkg = resolve(import.meta.dir, '..');
const OUT_DIR = 'e2e/.dist';
// The mocked-RPC spec answers this origin; a production build refuses nodes outside its allowlist.
export const MOCK_NODE_ORIGIN = 'http://127.0.0.1:1';

const e2eEnv = (d: Deployment): NodeJS.ProcessEnv => ({
  ...process.env,
  YACANA_SITE_MODE: 'e2e',
  VITE_AZTEC_NODE_URL: nodeUrl,
  VITE_ALLOWED_NODE_ORIGINS: `${new URL(nodeUrl as string).origin},${MOCK_NODE_ORIGIN}`,
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

/** Public storage, slot by slot, that reproduces the captured testnet history on this deployment. */
async function mockStorage(d: Deployment): Promise<Record<string, Record<string, string>>> {
  const layout = (await loadMinerArtifact()).storageLayout;
  const rows = rowsFromJson(
    await Bun.file(resolve(pkg, '../miner-core/fixtures/epochs.testnet.json')).text(),
  );
  const table = await deriveSlotTable(layout, 0);
  const slot = (name: string) => {
    const s = layout[name]?.slot;
    if (!s) throw new Error(`no slot ${name}`);
    return s.toString();
  };
  const hex = (v: bigint) => new Fr(v).toString();
  const miner: Record<string, string> = { [slot('open_epoch')]: hex(BigInt(rows.length - 1)) };
  let claims = 0n;
  for (const r of rows) {
    const base = (table.epochs[r.epoch] as Fr).toBigInt();
    miner[hex(base)] = hex(r.target);
    miner[hex(base + 1n)] = hex(r.seed ?? 0n);
    miner[hex(base + 2n)] = hex(BigInt(r.openedAt));
    miner[(table.claims[r.epoch] as Fr).toString()] = hex(BigInt(r.claims));
    claims += BigInt(r.claims);
  }
  // The token's total_supply slot: the standard token's layout is stable across the deployments.
  const tokenLayout = (
    JSON.parse(await Bun.file(resolve(pkg, 'public/layouts.json')).text()) as {
      token: Record<string, string>;
    }
  ).token;
  return {
    [d.miner]: miner,
    [d.token]: { [tokenLayout.total_supply as string]: hex(claims * PARAMS.REWARD) },
  };
}

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
const runId = `web-stats-e2e-${ownerPid}-${Date.now()}`;
const port = await claim({
  runId,
  service: 'vite',
  ownerPid,
  worktree: resolve(pkg, '../..'),
  base: lanePortBase(runPortWindowBase(runId), 4, 8),
  span: 8,
});
try {
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 127n });
  await Bun.write(MOCK_FILE, JSON.stringify(await mockStorage(deployed)));
  const log = openSync(resolve(pkg, 'e2e/.vite.log'), 'w');
  const env = e2eEnv(deployed);
  buildForRun(log, env);
  const vite = startServer(log, port, env);
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
  await release(runId).catch(() => {});
  throw e;
}
