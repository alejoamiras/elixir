// The in-browser claim: deploy the contracts from Node, then let a headless Chromium
// page (Vite dev server with COOP/COEP) run the embedded wallet, prove W with bb.js and prove + send
// the claim in-page. Reports wall-clock per step and the peak RSS of the whole browser process tree.
//   bun packages/deploy/scripts/spike-browser.ts [--threads N]
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { $ } from 'bun';
import { chromium } from 'playwright';
import { startIsolatedNode } from '../../../scripts/run/isolated-node.ts';
import { lanePortBase, runPortWindowBase } from '../../../scripts/run/port-window.ts';
import { claim as claimPort, release } from '../../../scripts/run/registry.ts';

declare global {
  interface Window {
    __spike?: Record<string, unknown>;
  }
}

const args = process.argv.slice(2);
const threadsIdx = args.indexOf('--threads');
const threads = threadsIdx >= 0 ? Number(args[threadsIdx + 1]) : Math.max(1, cpus().length - 1);
const repo = resolve(import.meta.dir, '../../..');
const pkg = resolve(repo, 'packages/deploy');
const TARGET = 1n << 127n;
const t = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// Static assets the page fetches (build outputs, so copied rather than committed).
const pub = resolve(pkg, 'browser/public/artifacts');
mkdirSync(pub, { recursive: true });
cpSync(
  resolve(repo, 'packages/contracts/target/yacana_spike-YacanaSpike.json'),
  `${pub}/yacana_spike-YacanaSpike.json`,
);
cpSync(resolve(repo, 'packages/work-circuit/target/yacana_work.json'), `${pub}/yacana_work.json`);
cpSync(
  Bun.resolveSync('@aztec-foundation/aztec-standards/artifacts/target/token_contract-Token.json', pkg),
  `${pub}/token_contract-Token.json`,
);

// Peak RSS over a process tree, sampled every 500 ms (bb's WASM workers live in the renderer).
async function peakRssWatcher(rootPid: number) {
  let peak = 0;
  let stop = false;
  const tick = async () => {
    while (!stop) {
      try {
        const rows = (await $`ps -e -o pid=,ppid=,rss=`.quiet().text()).trim().split('\n');
        const byParent = new Map<number, number[]>();
        const rss = new Map<number, number>();
        for (const r of rows) {
          const [pid, ppid, kb] = r.trim().split(/\s+/).map(Number) as [number, number, number];
          rss.set(pid, kb);
          byParent.set(ppid, [...(byParent.get(ppid) ?? []), pid]);
        }
        let total = 0;
        const stack = [rootPid];
        while (stack.length) {
          const p = stack.pop() as number;
          total += rss.get(p) ?? 0;
          stack.push(...(byParent.get(p) ?? []));
        }
        peak = Math.max(peak, total);
      } catch {
        /* ps hiccup */
      }
      await delay(500);
    }
  };
  void tick();
  return { peakKiB: () => peak, stop: () => (stop = true) };
}

// The lowest pid whose command line carries the user-data-dir is the browser's root process.
async function findBrowserPid(userDataDir: string): Promise<number> {
  for (let i = 0; i < 20; i++) {
    const pids = (await $`ps -eo pid=,args=`.quiet().text())
      .split('\n')
      .filter((l) => l.includes(userDataDir))
      .map((l) => Number(l.trim().split(/\s+/)[0]))
      .filter((p) => Number.isInteger(p) && p !== process.pid);
    if (pids.length) return Math.min(...pids);
    await delay(250);
  }
  throw new Error('browser process not found');
}

const node = await startIsolatedNode();
const runId = `browser-${process.pid}-${Date.now()}`;
const vitePort = await claimPort({
  runId,
  service: 'vite',
  ownerPid: process.pid,
  worktree: repo,
  base: lanePortBase(runPortWindowBase(runId), 5, 8),
  span: 8,
});
const results: Record<string, unknown> = {
  machine: `${hostname()} · ${cpus()[0]?.model} × ${cpus().length}`,
  threads,
};
let vite: ReturnType<typeof spawn> | undefined;
try {
  // Deploy + bind from Node with a fresh account paying through the sponsored FPC.
  const wallet = await EmbeddedWallet.create(node.nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
  const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
  const secret = Fr.random();
  const deployer = (
    await wallet.createSchnorrInitializerlessAccount(
      secret,
      Fr.random(),
      deriveMasterMessageSigningSecretKey(secret),
    )
  ).address;
  const minerArtifact = loadContractArtifact(
    await Bun.file(resolve(repo, 'packages/contracts/target/yacana_spike-YacanaSpike.json')).json(),
  );
  const minerDeploy = Contract.deploy(wallet, minerArtifact, [TARGET, Fr.random()], 'constructor', {
    deployer,
    salt: Fr.random(),
  });
  const predicted = (await minerDeploy.getInstance()).address;
  const { contract: token } = await TokenContract.deployWithOpts(
    { method: 'constructor_with_minter', wallet, instantiation: { deployer, salt: Fr.random() } },
    'Yacana',
    'YACA',
    18,
    predicted,
    AztecAddress.ZERO,
  ).send({ from: deployer, fee, wait: { timeout: 300 } });
  const { contract: miner } = await minerDeploy.send({ from: deployer, fee, wait: { timeout: 300 } });
  await miner.methods.bind_token(token.address).send({ from: deployer, fee, wait: { timeout: 120 } });
  await wallet.stop();
  console.log(`deployed miner ${miner.address}, token ${token.address}`);

  vite = spawn('bunx', ['vite', '--port', String(vitePort), '--strictPort', '--host', '127.0.0.1'], {
    cwd: pkg,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  // Both pipes must be drained: a full stdout pipe blocks the dev server silently.
  vite.stdout?.on('data', (b: Buffer) => process.stdout.write(`[vite] ${b}`));
  vite.stderr?.on('data', (b: Buffer) => process.stderr.write(`[vite] ${b}`));
  const url = `http://127.0.0.1:${vitePort}/?node=${encodeURIComponent(node.nodeUrl)}&miner=${miner.address}&token=${token.address}&threads=${threads}`;
  let viteReady = false;
  for (let i = 0; i < 60 && !viteReady && vite.exitCode === null; i++) {
    try {
      viteReady = (await fetch(`http://127.0.0.1:${vitePort}/`)).ok;
    } catch {
      /* not up yet */
    }
    if (!viteReady) await delay(500);
  }
  if (!viteReady) throw new Error(`vite did not start on port ${vitePort} (exit code ${vite.exitCode})`);

  // A persistent context's user-data-dir is on every Chromium process's command line, which is how
  // the process tree is found for the RSS watcher (Playwright exposes no browser pid here).
  const userDataDir = resolve(pkg, 'target', `chromium-${runId}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const browserPid = await findBrowserPid(userDataDir);
  const watcher = await peakRssWatcher(browserPid);
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('console', (m) => console.log(`[page] ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  page.on('crash', () => console.log('[page] renderer crashed'));
  page.on('close', () => console.log('[page] closed'));
  context.on('close', () => console.log('[browser] context closed'));
  const t0 = performance.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__spike !== undefined, undefined, { timeout: 1_800_000 });
  const spike = (await page.evaluate(() => window.__spike)) as Record<string, unknown>;
  watcher.stop();
  results.page = spike;
  const totalMs = performance.now() - t0;
  const peakBrowserRssMiB = Math.round(watcher.peakKiB() / 1024);
  Object.assign(results, { totalMs, peakBrowserRssMiB });
  console.log(`page done in ${t(totalMs)}; peak browser tree RSS ${peakBrowserRssMiB} MiB`);
  console.log(JSON.stringify(spike, null, 2));
  await context.close();
  if (!spike.ok) process.exitCode = 1;
} finally {
  if (vite?.pid) {
    try {
      process.kill(-vite.pid, 'SIGKILL');
    } catch {
      /* gone */
    }
  }
  await release(runId).catch(() => {});
  await node.teardown();
}
await Bun.write(resolve(pkg, 'target/spike-browser.json'), JSON.stringify(results, null, 2));
