// The screenshot gate's fixture-only build and server, and the one-off recording it replays.
//   bun e2e/visual-setup.ts record    # under `bun run e2e:agent --`: deploys, records every JSON-RPC
//                                     # answer the page needs into visual-rpc.json (+ the deployment)
//   bun e2e/visual-setup.ts serve     # builds e2e/.visual-dist from the recorded deployment, with a
//                                     # fixed source commit and only chunk 0 of the slot table; serves it
//   bun e2e/visual-setup.ts teardown
// No node is involved in `serve`: the spec answers the page's RPC from the recording.
import type { ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Fr } from '@aztec/aztec.js/fields';
import { type Browser, chromium, type Route } from '@playwright/test';
import { release } from '../../../scripts/run/registry.ts';
import { deployYacana } from '../../deploy/src/deploy.ts';
import { slotTableToJson } from '../../miner-core/src/reader.ts';
import { deriveSlotTable, LAYOUTS_PATH, loadLayouts } from '../../miner-core/src/slots.ts';
import { MOCK_NODE_ORIGIN } from './helpers.ts';
import { buildApp, claimPreviewPort, mockStorage, pkg, startPreview, waitUntilUp } from './serve.ts';

const OUT_DIR = 'e2e/.visual-dist';
const VISUAL_FILE = resolve(pkg, 'e2e/.visual.json');
const RPC_FILE = resolve(pkg, 'e2e/visual-rpc.json');
const DEPLOYMENT_FILE = resolve(pkg, 'e2e/visual-deployment.json');
/** What the Verify chips and the footer show: the baselines must not move with the commit. */
const VISUAL_COMMIT = '0123456789abcdef0123456789abcdef01234567';

interface VisualDeployment {
  chainId: string;
  rollupVersion: string;
  rollupAddress: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
}

interface VisualRun {
  baseURL: string;
  nodeOrigin: string;
  vitePid: number;
  runId: string;
}

interface RpcCall {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: unknown[];
}

const rpcKey = (c: RpcCall) => `${c.method} ${JSON.stringify(c.params ?? [])}`;

const visualEnv = (d: VisualDeployment): NodeJS.ProcessEnv => ({
  ...process.env,
  YACANA_SITE_MODE: 'e2e',
  VITE_AZTEC_NODE_URL: MOCK_NODE_ORIGIN,
  VITE_RP_ID: 'localhost',
  VITE_SOURCE_COMMIT: VISUAL_COMMIT,
  VITE_CHAIN_ID: d.chainId,
  VITE_ROLLUP_VERSION: d.rollupVersion,
  VITE_ROLLUP_ADDRESS: d.rollupAddress,
  VITE_YACANA_MINER: d.miner,
  VITE_YACANA_TOKEN: d.token,
  VITE_YACANA_MINER_CLASS: d.minerClassId,
  VITE_YACANA_TOKEN_CLASS: d.tokenClassId,
  VITE_DEPLOYMENT_RECORD: JSON.stringify(d),
});

/** The build, then only chunk 0 of the slot table (the fixture's 31 epochs live there) and the layouts. */
async function build(d: VisualDeployment, log: number): Promise<void> {
  buildApp(OUT_DIR, log, visualEnv(d));
  const dist = resolve(pkg, OUT_DIR);
  rmSync(resolve(dist, 'slots'), { recursive: true, force: true });
  mkdirSync(resolve(dist, 'slots'), { recursive: true });
  writeFileSync(
    resolve(dist, 'slots/0.json'),
    slotTableToJson(await deriveSlotTable((await loadLayouts()).miner, 0)),
  );
  cpSync(LAYOUTS_PATH, resolve(dist, 'layouts.json'));
}

async function serve(d: VisualDeployment, ownerPid: number): Promise<VisualRun> {
  const runId = `web-stats-visual-${ownerPid}-${Date.now()}`;
  const port = await claimPreviewPort(runId, ownerPid);
  let spawned: ChildProcess | undefined;
  try {
    const log = openSync(resolve(pkg, 'e2e/.visual.log'), 'w');
    await build(d, log);
    spawned = startPreview(OUT_DIR, log, port, visualEnv(d));
    const baseURL = `http://localhost:${port}`;
    if (!(await waitUntilUp(baseURL, spawned)))
      throw new Error(`vite preview did not start on ${baseURL} (see e2e/.visual.log)`);
    const run: VisualRun = { baseURL, nodeOrigin: MOCK_NODE_ORIGIN, vitePid: spawned.pid as number, runId };
    await Bun.write(VISUAL_FILE, JSON.stringify(run, null, 2));
    return run;
  } catch (e) {
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
}

async function teardown(): Promise<void> {
  const file = Bun.file(VISUAL_FILE);
  if (!(await file.exists())) return;
  const run = (await file.json()) as VisualRun;
  try {
    process.kill(-run.vitePid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  await release(run.runId).catch(() => {});
  rmSync(VISUAL_FILE, { force: true });
}

/**
 * Drives the built page once against a fresh deployment: the fixture's storage answers locally,
 * everything else goes to the real node, and every answer is kept under its method and params.
 */
async function record(nodeUrl: string): Promise<void> {
  const deployed = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 127n });
  const d: VisualDeployment = {
    chainId: deployed.chainId,
    rollupVersion: deployed.rollupVersion,
    miner: deployed.miner,
    token: deployed.token,
    minerClassId: deployed.minerClassId,
    tokenClassId: deployed.tokenClassId,
  };
  const storage = await mockStorage(deployed);
  const answers: Record<string, unknown> = {};
  const run = await serve(d, process.pid);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route(
      (url) => url.origin === MOCK_NODE_ORIGIN,
      async (route: Route) => {
        const body = route.request().postDataJSON() as RpcCall | RpcCall[];
        const calls = Array.isArray(body) ? body : [body];
        const out = [];
        for (const c of calls) {
          const [, contract, slot] = (c.params ?? []) as [unknown, string, string];
          const local = c.method === 'aztec_getPublicStorageAt' ? storage[contract]?.[slot] : undefined;
          const result =
            local ??
            (
              (await (
                await route.fetch({ url: nodeUrl, method: 'POST', postData: JSON.stringify(c) })
              ).json()) as { result: unknown }
            ).result;
          answers[rpcKey(c)] = result;
          out.push({ jsonrpc: '2.0', id: c.id, result });
        }
        await route.fulfill({ json: Array.isArray(body) ? out : out[0] });
      },
    );
    await page.goto(`${run.baseURL}/`);
    await page.getByTestId('table').locator('tbody tr').nth(30).waitFor({ timeout: 60_000 });
    await page.getByTestId('freshness').filter({ hasText: 'block' }).waitFor({ timeout: 60_000 });
  } finally {
    await browser?.close();
    await teardown();
  }
  const sorted = Object.fromEntries(
    Object.keys(answers)
      .sort()
      .map((k) => [k, answers[k]]),
  );
  writeFileSync(RPC_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  writeFileSync(DEPLOYMENT_FILE, `${JSON.stringify(d, null, 2)}\n`);
  console.log(`recorded ${Object.keys(sorted).length} answers for ${d.miner}`);
}

const command = process.argv[2];
if (command === 'record') {
  const nodeUrl = process.env.AZTEC_NODE_URL;
  if (!nodeUrl) throw new Error('AZTEC_NODE_URL is not set: run through `bun run e2e:agent -- …`');
  await record(nodeUrl);
} else if (command === 'serve') {
  const d = (await Bun.file(DEPLOYMENT_FILE).json()) as VisualDeployment;
  const run = await serve(d, Number(process.env.E2E_OWNER_PID ?? process.ppid));
  console.log(`visual: ${run.baseURL}`);
  process.exit(0);
} else if (command === 'teardown') {
  await teardown();
} else {
  throw new Error('usage: visual-setup.ts record|serve|teardown');
}
