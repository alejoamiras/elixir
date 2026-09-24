// Stats as pages of the miner, loaded the first time they are opened. Its reads go beside the page's
// own and never before them: each request quiet (no cooldown opens or lasts on it) with its own 10 s
// deadline, and none leaves while a claim is out, the node is not ok, or the guard does not admit the
// node yet (a direct visit reaches here before the preflight points the guard) — not even one inside a
// batch that began before.
import { StatsPages } from '@yacana/stats-view/pages';
import { createStatsRuntime } from '@yacana/stats-view/runtime';
import { NodeWayOut, type StatsTab } from '@yacana/ui';
import { type Connection, defaultNodeUrl, restoreDefaultNode } from '@yacana/web-kit/browser/connection';
import { quietEthRpcClient } from '@yacana/web-kit/browser/eth-rpc';
import { quietNodeClient } from '@yacana/web-kit/browser/node';
import { currentNodeEndpoint } from '@yacana/web-kit/browser/node-guard';
import { nodeHealth } from '@yacana/web-kit/browser/node-health';
import { useAtomValue, useStore } from 'jotai';
import { useEffect } from 'react';
import { bridgeRecord } from '../bridge/env';
import { FAQ_HREF } from '../lib/apex';
import { statsRouteOf } from '../lib/tabs';
import { navigate, pathFor } from '../routes';
import { type Endpoints, endpointsAtom, minerAtom } from '../state';
import { createStatsHost, hostedBusy, type StatsHost, whenFree } from './stats-host';

const DEADLINE_MS = 10_000;

const HOST = {
  pathFor: (p: StatsTab) => pathFor(statsRouteOf(p)),
  navigate: (p: StatsTab) => navigate(statsRouteOf(p)),
  faqHref: FAQ_HREF,
};

type Store = ReturnType<typeof useStore>;

let host: StatsHost | undefined;

function hostFor(store: Store, connection: Connection): StatsHost {
  const claiming = () => {
    const { phase } = store.get(minerAtom);
    return phase === 'claiming' || phase === 'recovering';
  };
  const make = (e: Endpoints, gone: AbortSignal) => {
    const busy = () => hostedBusy(claiming(), nodeHealth().transport, currentNodeEndpoint(), e.nodeUrl);
    return createStatsRuntime({
      store,
      connection: { ...connection, nodeUrl: e.nodeUrl, ethRpcUrl: e.ethRpcUrl },
      node: quietNodeClient(e.nodeUrl, DEADLINE_MS, () => whenFree(busy, gone)),
      eth: bridgeRecord() ? quietEthRpcClient(e.ethRpcUrl, DEADLINE_MS) : undefined,
      fill: false,
      yieldTo: busy,
    });
  };
  host ??= createStatsHost(store, make);
  return host;
}

export default function Stats({ page, connection }: { page: StatsTab; connection: Connection }) {
  const store = useStore();
  const endpoints = useAtomValue(endpointsAtom);
  useEffect(() => hostFor(store, connection).show(), [store, connection]);
  const shown = endpoints
    ? { ...connection, nodeUrl: endpoints.nodeUrl, ethRpcUrl: endpoints.ethRpcUrl }
    : connection;
  return (
    <StatsPages
      page={page}
      host={HOST}
      connection={shown}
      onWindow={(w) => void host?.runtime()?.showWindow(w)}
      wayOut={
        <NodeWayOut
          className="mt-2"
          onDefault={shown.nodeUrl === defaultNodeUrl() ? undefined : restoreDefaultNode}
          settingsHref={pathFor('settings')}
        />
      }
    />
  );
}
