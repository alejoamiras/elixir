// The origin case: the apex's build as `https://yacana.test` and the old role's build as
// `https://v5.yacana.test` (both loopback in the browser, under a certificate made for the run;
// WebAuthn wants a registrable domain shared by the two, which `localhost` is not, and a secure
// context), the same deployment on the rig's node behind both, and origin.e2e.ts driving one
// passkey across them.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { openSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { startPreview } from '../../../scripts/run/preview.ts';
import { claim, release } from '../../../scripts/run/registry.ts';
import { repoRoot } from '../../../scripts/run/toolchain.ts';
import { type RigNode, startUpgradeRig, type UpgradeRig } from '../../../scripts/run/upgrade-rig.ts';
import { registerVersion } from '../../deploy/src/bridge/register.ts';
import { e2eBuildEnv } from '../../web-miner/e2e/build-env.ts';
import type { E2eRun } from '../../web-miner/e2e/run.ts';
import { deployBridge, deployMiner, type MinerOnRig } from '../src/yacana.ts';

/** A child awaited without blocking this process: the rig's node logs through it and the control server answers from it. */
const exec = (cmd: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv; log?: number }) =>
  new Promise<number>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: opts.log === undefined ? 'inherit' : ['ignore', opts.log, opts.log],
      env: opts.env ?? process.env,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(127));
  });

const enabled = process.env.YACANA_RIG === '1';
const minerPkg = resolve(repoRoot, 'packages/web-miner');

/** A preview behind the run's self-signed certificate answers; Node's fetch would refuse the cert. */
async function upOverTls(url: string, child: ChildProcess): Promise<boolean> {
  for (let i = 0; i < 120 && child.exitCode === null; i++) {
    const ok = await fetch(url, { tls: { rejectUnauthorized: false } } as never).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return true;
    await delay(500);
  }
  return false;
}

describe.skipIf(!enabled)('the versioned origin (origin)', () => {
  let rig: UpgradeRig;
  let node: RigNode;
  let v5: MinerOnRig;
  const servers: ChildProcess[] = [];
  const runId = `web-miner-rig-origin-${process.pid}-${Date.now()}`;
  const lane = {
    runId,
    ownerPid: process.pid,
    worktree: repoRoot,
    base: lanePortBase(runPortWindowBase(runId), 0, 8),
    span: 8,
  };
  let apexPort: number;
  let oldPort: number;
  let runFile: string;

  const kill = (child: ChildProcess) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* gone */
    }
  };

  beforeAll(async () => {
    rig = await startUpgradeRig();
    node = rig.node as RigNode;
    const bridge = await deployBridge(rig);
    v5 = await deployMiner(rig, node, bridge);
    await registerVersion(v5.operator);
    runFile = join(rig.runRoot, 'run.json');
    const log = openSync(join(rig.runRoot, 'origin.log'), 'w');
    apexPort = await claim({ ...lane, service: 'vite' });
    oldPort = await claim({ ...lane, service: 'vite-old' });
    const oldAppOrigin = `https://v5.yacana.test:${oldPort}`;
    // One certificate for both names, for this run only.
    const cert = join(rig.runRoot, 'tls-cert.pem');
    const key = join(rig.runRoot, 'tls-key.pem');
    const made = await exec(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=yacana.test',
        '-addext',
        'subjectAltName=DNS:yacana.test,DNS:v5.yacana.test',
      ],
      { cwd: rig.runRoot, log },
    );
    if (made !== 0) throw new Error('openssl could not make the run certificate');
    if ((await exec('bun', ['scripts/prebuild.ts'], { cwd: minerPkg })) !== 0)
      throw new Error('prebuild failed');
    for (const [role, port, outDir] of [
      ['apex', apexPort, 'e2e/.rig-dist-apex'],
      ['old', oldPort, 'e2e/.rig-dist-old'],
    ] as const) {
      const env = {
        ...e2eBuildEnv(v5.deployment, {
          nodeUrl: node.nodeUrl,
          prestoPort: null,
          bridge,
          proverless: false,
          role,
          oldAppOrigin,
          rpId: 'yacana.test',
        }),
        YACANA_E2E_TLS_CERT: cert,
        YACANA_E2E_TLS_KEY: key,
      };
      const built = await exec('bunx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
        cwd: minerPkg,
        env,
        log,
      });
      if (built !== 0) throw new Error(`vite build into ${outDir} failed (see the run's log)`);
      const child = startPreview(minerPkg, outDir, log, port, env);
      servers.push(child);
      if (!(await upOverTls(`https://localhost:${port}/`, child)))
        throw new Error(`vite preview (${role}) did not start on port ${port}`);
    }
    const run: E2eRun = {
      baseURL: `https://yacana.test:${apexPort}`,
      nodeUrl: node.nodeUrl,
      miner: v5.deployment.miner,
      token: v5.deployment.token,
      hardMiner: v5.deployment.miner,
      hardToken: v5.deployment.token,
      proxyA: '',
      proxyB: '',
      proxyPid: 0,
      vitePid: servers[0]?.pid ?? 0,
      prestoUrl: null,
      prestoPid: null,
      prestoHome: null,
      closedPort: 0,
      runId,
      server: 'preview',
      bridge: null,
      controlPid: null,
    };
    await Bun.write(runFile, JSON.stringify(run, null, 2));
  }, 1_200_000);

  afterAll(async () => {
    for (const s of servers) kill(s);
    await release(runId).catch(() => {});
    rmSync(resolve(minerPkg, 'e2e/.rig-dist-apex'), { recursive: true, force: true });
    rmSync(resolve(minerPkg, 'e2e/.rig-dist-old'), { recursive: true, force: true });
    await rig?.teardown();
  });

  test(
    'one passkey across the apex and the versioned origin: the same account, restored, never created',
    async () => {
      const code = await exec(
        'bunx',
        ['playwright', 'test', 'e2e/origin.e2e.ts', '--config', 'playwright.rig.config.ts'],
        {
          cwd: minerPkg,
          env: {
            ...process.env,
            E2E_RUN_FILE: runFile,
            RIG_OLD_BASE_URL: `https://v5.yacana.test:${oldPort}`,
            RIG_TEST_DOMAINS: '1',
            E2E_PROVERLESS: '',
          },
        },
      );
      expect(code).toBe(0);
    },
    20 * 60_000,
  );
});
