// The browser case: the whole migration through the page, real proving, on the upgrade rig. The rig
// deploys the portal and V5, builds the miner for V5 and serves it, and runs bridge.e2e.ts stage by
// stage — doing between stages what Yacana does by hand: settle and forward (the control server the
// spec calls), the flip, the retire, the redeploy as V5's continuation, the V6 build.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { type ChildProcess, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Hex } from 'viem';
import { serveControl } from '../../../scripts/run/control.ts';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { buildApp, startPreview, waitUntilUp } from '../../../scripts/run/preview.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { repoRoot } from '../../../scripts/run/toolchain.ts';
import {
  type RigNode,
  type RigVersion,
  startUpgradeRig,
  type UpgradeRig,
} from '../../../scripts/run/upgrade-rig.ts';
import { forwardAll } from '../../deploy/src/bridge/forward.ts';
import type { Operator } from '../../deploy/src/bridge/operator.ts';
import { registerVersion } from '../../deploy/src/bridge/register.ts';
import { retireOnL1, retireOnL2 } from '../../deploy/src/bridge/retire.ts';
import { noteAllTransitions } from '../../deploy/src/bridge/transition.ts';
import { type BridgeRecord, continuationOf } from '../../deploy/src/deploy.ts';
import { e2eBuildEnv } from '../../web-miner/e2e/build-env.ts';
import type { E2eRun } from '../../web-miner/e2e/run.ts';
import { openUser } from '../src/user.ts';
import { asForwarder, deployBridge, deployMiner, type MinerOnRig } from '../src/yacana.ts';

const enabled = process.env.YACANA_RIG === '1';
/** Anvil account 3: the holder the page's test wallet signs with. */
const HOLDER_KEY: Hex = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const minerPkg = resolve(repoRoot, 'packages/web-miner');
const STAGE_MS = 45 * 60_000;

describe.skipIf(!enabled)('the migration through the page (browser)', () => {
  let rig: UpgradeRig;
  let node5: RigNode;
  let bridge: BridgeRecord;
  let v5: MinerOnRig;
  let v6v: RigVersion;
  let forwarder: Operator;
  let archive: string;
  let control: ReturnType<typeof serveControl>;
  let preview: ChildProcess | undefined;
  let log: number;
  const runId = `web-miner-rig-browser-${process.pid}-${Date.now()}`;
  const lane = {
    runId,
    ownerPid: process.pid,
    worktree: repoRoot,
    base: lanePortBase(runPortWindowBase(runId), 0, 8),
    span: 8,
  };
  let vitePort: number;
  let controlPort: number;
  let handoff: string;
  let runFile: string;

  const settle = async () => {
    await rig.warpBy(72 * 5);
    await rig.prove();
  };

  /** A V5- or V6-profile build of the miner, served on the run's port; the spec's run file rewritten. */
  async function serve(m: MinerOnRig, node: RigNode, outDir: string, announced: boolean): Promise<void> {
    if (preview?.pid) {
      try {
        process.kill(-preview.pid, 'SIGKILL');
      } catch {
        /* gone */
      }
      preview = undefined;
    }
    // Announced a day ahead on V5: the migration card is where the send-aheads leave from.
    const migration = announced
      ? {
          toIndex: '1',
          announcedAt: String(Math.floor(Date.now() / 1000)),
          expectedFlipAt: String(Math.floor(Date.now() / 1000) + 86_400),
        }
      : null;
    const env = e2eBuildEnv(m.deployment, {
      nodeUrl: node.nodeUrl,
      prestoPort: null,
      bridge,
      migration,
      proverless: false,
    });
    buildApp(minerPkg, outDir, log, env);
    preview = startPreview(minerPkg, outDir, log, vitePort, env);
    const baseURL = `http://localhost:${vitePort}`;
    if (!(await waitUntilUp(baseURL, preview))) throw new Error(`vite preview did not start on ${baseURL}`);
    const run: E2eRun = {
      baseURL,
      nodeUrl: node.nodeUrl,
      miner: m.deployment.miner,
      token: m.deployment.token,
      hardMiner: m.deployment.miner,
      hardToken: m.deployment.token,
      proxyA: '',
      proxyB: '',
      proxyPid: 0,
      vitePid: preview.pid ?? 0,
      prestoUrl: null,
      prestoPid: null,
      prestoHome: null,
      closedPort: 0,
      runId,
      server: 'preview',
      bridge: {
        portal: bridge.portal,
        yaca: bridge.yaca,
        chainId: bridge.chainId,
        l1RpcUrl: rig.l1RpcUrl,
        controlUrl: control.url,
        holderKey: HOLDER_KEY,
      },
      controlPid: null,
    };
    await Bun.write(runFile, JSON.stringify(run, null, 2));
  }

  /** One stage of bridge.e2e.ts under the rig's Playwright config; its exit code is the verdict. */
  const stage = (name: string, grep: string) => {
    const r = spawnSync(
      'bunx',
      ['playwright', 'test', 'e2e/bridge.e2e.ts', '--config', 'playwright.rig.config.ts', '--grep', grep],
      {
        cwd: minerPkg,
        stdio: 'inherit',
        env: {
          ...process.env,
          E2E_RUN_FILE: runFile,
          RIG_STAGE: name,
          RIG_HANDOFF: handoff,
          E2E_PROVERLESS: '',
        },
      },
    );
    return r.status ?? 1;
  };

  beforeAll(async () => {
    rig = await startUpgradeRig();
    node5 = rig.node as RigNode;
    bridge = await deployBridge(rig);
    v5 = await deployMiner(rig, node5, bridge);
    await registerVersion(v5.operator);
    forwarder = await asForwarder(rig, v5);
    archive = relative(repoRoot, `${rig.runRoot}/witnesses.jsonl`);
    handoff = join(rig.runRoot, 'handoff');
    runFile = join(rig.runRoot, 'run.json');
    mkdirSync(handoff, { recursive: true });
    log = openSync(join(rig.runRoot, 'browser.log'), 'w');
    vitePort = await claim({ ...lane, service: 'vite' });
    controlPort = await claim({ ...lane, service: 'control' });
    control = serveControl(controlPort, {
      ping: async () => 'pong',
      settle,
      nudge: () => rig.nudge(),
      forward: async () => {
        const report = await forwardAll(forwarder, {
          source: v5.deployment,
          sourceNodeUrl: node5.nodeUrl,
          archive,
        });
        return { forwarded: report.forwarded.length, failed: report.failed.length };
      },
    });
    // The pinned CRS, the artifacts and the slot table the build reads.
    const pre = spawnSync('bun', ['scripts/prebuild.ts'], { cwd: minerPkg, stdio: 'inherit' });
    if (pre.status !== 0) throw new Error('prebuild failed');
    await serve(v5, node5, 'e2e/.rig-dist-v5', true);
  }, 1_200_000);

  afterAll(async () => {
    if (preview?.pid) {
      try {
        process.kill(-preview.pid, 'SIGKILL');
      } catch {
        /* gone */
      }
    }
    control?.stop();
    await release(runId).catch(() => {});
    rmSync(resolve(minerPkg, 'e2e/.rig-dist-v5'), { recursive: true, force: true });
    rmSync(resolve(minerPkg, 'e2e/.rig-dist-v6'), { recursive: true, force: true });
    await rig?.teardown();
  });

  test(
    'on V5: mine, exit, deposit, send ahead twice, save the recovery file — through the page',
    () => {
      expect(stage('v5', 'on V5:')).toBe(0);
    },
    STAGE_MS,
  );

  test(
    'the flip: V5 retired on Ethereum and on its own chain; the page says mining has ended',
    async () => {
      v6v = await rig.deployNext({ bump: 1n });
      await rig.flip(v6v);
      expect(await noteAllTransitions(v5.operator)).toEqual([1n]);
      const sent = await retireOnL1(v5.operator, BigInt(v5.deployment.rollupVersion));
      await rig.nudge();
      const user = await openUser(v5.deployment, node5.nodeUrl);
      try {
        await retireOnL2(user, bridge.portal as Hex, sent, 300);
      } finally {
        await user.stop();
      }
      expect(stage('v5-flipped', 'on V5 after the flip:')).toBe(0);
    },
    STAGE_MS,
  );

  test(
    'on V6: restore, the recovery file, the holder’s own forward and claim, the redeem — through the page',
    async () => {
      const continuation = await continuationOf(v5.recordPath);
      await rig.stopNode();
      const node6 = await rig.startNode(v6v);
      const v6 = await deployMiner(rig, node6, bridge, { continuation });
      await registerVersion(v6.operator);
      await serve(v6, node6, 'e2e/.rig-dist-v6', false);
      expect(stage('v6', 'on V6:')).toBe(0);
    },
    STAGE_MS,
  );
});
