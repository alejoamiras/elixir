// Boot sequence: pinned CRS, isolation check, node, deployment check, wallet, rules, prover Worker.
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { createStore } from 'jotai';
import { assertDeployment, expectedFromStrings } from '../../miner-core/src/reader.ts';
import { attachDeployment, loadArtifact, readEpochRules } from './chain';
import { allowedNodeOrigins, type Connection, disallowedNodeUrl } from './config';
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
  const blocked = disallowedNodeUrl(connection);
  if (blocked)
    throw new Error(
      `${blocked} is outside this build's allowed node origins (${allowedNodeOrigins().join(', ')}): change it in packages/site/site.env and rebuild`,
    );
  step('verifying the pinned CRS');
  await purgeCrsCache();
  await preloadPinnedCrs();
  step('connecting to the node');
  const node = createAztecNodeClient(connection.nodeUrl);
  const chainId = BigInt(await node.getChainId());
  const rollupVersion = BigInt((await node.getNodeInfo()).rollupVersion);
  step('checking the deployment');
  const minerArtifact = await loadArtifact('yacana_miner-YacanaMiner');
  await assertDeployment(
    node,
    expectedFromStrings({
      chainId: import.meta.env.VITE_CHAIN_ID,
      rollupVersion: import.meta.env.VITE_ROLLUP_VERSION,
      miner: connection.miner,
      minerClassId: import.meta.env.VITE_YACANA_MINER_CLASS,
      token: connection.token,
      tokenClassId: import.meta.env.VITE_YACANA_TOKEN_CLASS,
    }),
    minerArtifact.storageLayout,
  );
  step('opening the wallet (first visit creates an account)');
  const { wallet, account, fee, created } = await openWallet(connection.nodeUrl, node, chainId);
  step('registering the deployment');
  const deployment = await attachDeployment(wallet, node, connection, minerArtifact);
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
    chainId,
    rollupVersion,
  );
  await controller.ready();
  await controller.begin();
  store.set(bootAtom, { phase: 'ready', account: account.toString(), threads, created });
  return controller;
}
