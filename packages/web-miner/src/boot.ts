// Boot sequence: pinned CRS, isolation check, node, wallet, deployment, rules, prover Worker.
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { createStore } from 'jotai';
import { attachDeployment, readEpochRules } from './chain';
import { allowedNodeOrigins, type Connection, firstDisallowedUrl } from './config';
import { MinerController } from './controller';
import { preloadPinnedCrs, purgeCrsCache } from './pinned-crs';
import { bootAtom, rulesAtom } from './state';
import { openWallet } from './wallet';

export async function boot(
  store: ReturnType<typeof createStore>,
  connection: Connection,
): Promise<MinerController> {
  const step = (s: string) => store.set(bootAtom, { phase: 'booting', step: s });
  if (!crossOriginIsolated)
    throw new Error(
      'this page is not cross-origin isolated: bb.js cannot use threads (check the COOP/COEP headers)',
    );
  if (!connection.miner || !connection.token)
    throw new Error('no deployment configured: set the miner and token addresses');
  const blocked = firstDisallowedUrl(connection);
  if (blocked)
    throw new Error(
      `${blocked} is outside this build's allowed node origins (${allowedNodeOrigins().join(', ')}): add it to VITE_ALLOWED_NODE_ORIGINS in .env.production and to connect-src in public/_headers, then rebuild`,
    );
  step('verifying the pinned CRS');
  await purgeCrsCache();
  await preloadPinnedCrs();
  step('connecting to the node');
  const node = createAztecNodeClient(connection.nodeUrl);
  const chainId = BigInt(await node.getChainId());
  const rollupVersion = BigInt((await node.getNodeInfo()).rollupVersion);
  step('opening the wallet (first visit creates an account)');
  const { wallet, account, fee, created } = await openWallet(connection.nodeUrl, node, chainId);
  step('registering the deployment');
  const deployment = await attachDeployment(wallet, node, connection);
  const rules = await readEpochRules(deployment, account);
  store.set(rulesAtom, rules);
  step('starting the prover');
  const threads = Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
  const spawn = () => new Worker(new URL('./prover.worker.ts', import.meta.url), { type: 'module' });
  const controller = new MinerController(
    store,
    spawn,
    threads,
    deployment,
    account,
    fee,
    connection,
    chainId,
    rollupVersion,
  );
  await controller.ready();
  await controller.begin();
  store.set(bootAtom, { phase: 'ready', account: account.toString(), threads, created });
  return controller;
}
