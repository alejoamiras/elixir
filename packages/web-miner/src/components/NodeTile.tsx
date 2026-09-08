import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { defaultNodeUrl, isPinnedByQuery, saveConnection } from '../../../site/src/browser/connection.ts';
import { type NodeProbe, parseNodeUrl } from '../../../site/src/browser/node.ts';
import { nodeHealth, subscribeNodeHealth } from '../../../site/src/browser/node-health.ts';
import { Button, ExternalLink, Input, Label, Tile, TileHeader } from '../../../ui/src/index.ts';
import { canUse, checkReducer, describeProbe } from '../lib/node-check';
import type { Session } from '../session';

const RUN_A_NODE = 'https://docs.aztec.network/the_aztec_network/guides/run_nodes/how_to_run_full_node';
const HEALTH_EVERY_MS = 10_000;

type Health =
  | { kind: 'pending'; verified: boolean }
  | { kind: 'ok'; probe: NodeProbe; verified: true }
  | { kind: 'failed'; message: string; verified: boolean };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The node in use, probed every ten seconds while the tile is on screen. `verified` survives a
 * failed probe: a node that passed the deployment check once is still that deployment when it throttles.
 */
function useNodeHealth(session: Session, nodeUrl: string): Health {
  const [health, setHealth] = useState<Health>({ kind: 'pending', verified: false });
  useEffect(() => {
    let live = true;
    let running = false;
    setHealth({ kind: 'pending', verified: false });
    // The active node's probe rides the page's handle, whose deadline is the guard's, not this 10 s.
    // A slow node could outlast the interval, so a tick is skipped while the last probe is in flight.
    const tick = () => {
      if (running) return;
      running = true;
      session
        .probeNode(nodeUrl, HEALTH_EVERY_MS)
        .then((probe) => live && setHealth({ kind: 'ok', probe, verified: true }))
        .catch(
          (e: unknown) =>
            live && setHealth((h) => ({ kind: 'failed', message: message(e), verified: h.verified })),
        )
        .finally(() => {
          running = false;
        });
    };
    void tick();
    const timer = setInterval(tick, HEALTH_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [session, nodeUrl]);
  return health;
}

const secondsSince = (at: number | null) =>
  at === null ? null : Math.max(0, Math.round((Date.now() - at) / 1000));

/** The status line: the store's word while the node is throttled or silent, the probe's otherwise. */
function HealthLine({ health }: { health: Health }) {
  const store = useSyncExternalStore(subscribeNodeHealth, nodeHealth, nodeHealth);
  const t = store.transport;
  if (t.kind !== 'ok') {
    const age = secondsSince(store.lastReadAt);
    return (
      <>
        <span className="text-warn">
          {t.kind === 'throttled' ? '429 · rate limited' : `no answer for ${secondsSince(t.since)} s`}
        </span>
        {age !== null && <span>last answer {age} s ago</span>}
        {health.verified && <span className="text-ok">this deployment ✓</span>}
      </>
    );
  }
  if (health.kind === 'pending') return <span>checking…</span>;
  if (health.kind === 'failed') return <span className="text-warn">{health.message}</span>;
  return (
    <>
      <span className="text-ok">
        block {health.probe.block.toLocaleString('en-US')} · {health.probe.blockAgeS} s ago
      </span>
      <span>{Math.round(health.probe.latencyMs)} ms</span>
      <span className="text-ok">this deployment ✓</span>
    </>
  );
}

function HealthRow({ nodeUrl, health }: { nodeUrl: string; health: Health }) {
  const isDefault = nodeUrl === defaultNodeUrl();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line-2 px-3.5 py-3">
      <div className="min-w-0">
        <div className="font-mono text-sm" data-testid="node-in-use">
          {new URL(nodeUrl).host}
          {isDefault && <span className="text-2xs text-ink-3"> · the default</span>}
        </div>
        <div
          className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-2xs text-ink-2"
          data-testid="node-health"
        >
          <HealthLine health={health} />
        </div>
      </div>
      <Button size="sm" disabled>
        In use
      </Button>
    </div>
  );
}

function CheckForm({
  session,
  nodeUrl,
  onSwitched,
}: {
  session: Session;
  nodeUrl: string;
  onSwitched: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [state, dispatch] = useReducer(checkReducer, { kind: 'idle' });
  const pinned = isPinnedByQuery();
  const check = async () => {
    let url: string;
    try {
      url = parseNodeUrl(typed, import.meta.env.VITE_SITE_MODE).href;
    } catch (e) {
      dispatch({ type: 'check', url: typed.trim() });
      return dispatch({ type: 'failed', url: typed.trim(), message: message(e) });
    }
    dispatch({ type: 'check', url });
    setTyped(url);
    try {
      dispatch({ type: 'ok', url, probe: await session.probeNode(url) });
    } catch (e) {
      dispatch({ type: 'failed', url, message: message(e) });
    }
  };
  const use = async () => {
    const url = typed.trim();
    dispatch({ type: 'switch', url });
    try {
      await session.switchNode(url);
    } catch (e) {
      return dispatch({ type: 'switch-failed', url, message: message(e) });
    }
    // The live node moved: the tile follows it now. The setting is saved only after the switch, so a
    // failed switch never leaves storage pointing at a node the page never took.
    onSwitched();
    if (!saveConnection({ nodeUrl: url }))
      return dispatch({
        type: 'switch-failed',
        url,
        message:
          'Now in use, but the browser refused to save it; free some site storage so it sticks on reload.',
      });
    dispatch({ type: 'switched', url });
  };
  const busy = state.kind === 'checking' || state.kind === 'switching';
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="node-url">Another node</Label>
        <div className="flex gap-2">
          <Input
            id="node-url"
            className="font-mono"
            value={typed}
            placeholder="https://…"
            disabled={pinned || busy}
            onChange={(e) => {
              setTyped(e.target.value);
              dispatch({ type: 'edit' });
            }}
            data-testid="node-url"
          />
          <Button
            size="default"
            disabled={pinned || busy || !typed.trim()}
            onClick={() => void check()}
            data-testid="node-check"
          >
            {state.kind === 'checking' ? 'Checking…' : 'Check'}
          </Button>
        </div>
        {pinned && <span className="text-xs text-ink-2">set by the page URL</span>}
      </div>
      <CheckResult state={state} />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!canUse(state, typed, nodeUrl) || pinned}
          onClick={() => void use()}
          data-testid="node-use"
        >
          {state.kind === 'switching' ? 'Switching…' : 'Use this node'}
        </Button>
        <span className="text-xs text-ink-3">
          Applies at once; your account's view of the chain is rebuilt from the new node (about a minute) and
          mining carries on. The page checks any node against this deployment before it reads a number from
          it.
        </span>
      </div>
    </div>
  );
}

function CheckResult({ state }: { state: ReturnType<typeof checkReducer> }) {
  if (state.kind === 'idle' || state.kind === 'checking') return null;
  const lines =
    state.kind === 'ok'
      ? describeProbe(state.probe)
      : state.kind === 'switching'
        ? ['rebuilding the chain view from the new node…']
        : state.kind === 'switched'
          ? ['✓ in use']
          : [state.message];
  const warn = state.kind === 'failed' || state.kind === 'switch-failed';
  return (
    <div
      className={`flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-2xs ${warn ? 'text-warn' : 'text-ink-2'}`}
      data-testid="node-check-result"
    >
      {lines.map((l) => (
        <span key={l} className={!warn && l.startsWith('✓') ? 'text-ok' : undefined}>
          {l}
        </span>
      ))}
    </div>
  );
}

const NodeNote = () => (
  <p className="border-t border-line pt-3 text-xs text-ink-3">
    The node answers what this page asks; it can delay or hide, never spend: every claim is proved here and
    verified on the chain. A public node may rate-limit you:{' '}
    <ExternalLink href={RUN_A_NODE} className="font-sans whitespace-nowrap text-ink-2">
      run a node
    </ExternalLink>
  </p>
);

/** Settings → Node: the node in use and its health, and the way to check and use another one. */
export function NodeTile({
  session,
  nodeUrl,
  onSwitched,
}: {
  session: Session;
  nodeUrl: string;
  onSwitched: () => void;
}) {
  const health = useNodeHealth(session, nodeUrl);
  return (
    <Tile>
      <TileHeader aside="chain reads and claims go through it">Node</TileHeader>
      <div className="grid gap-3.5">
        <HealthRow nodeUrl={nodeUrl} health={health} />
        <CheckForm session={session} nodeUrl={nodeUrl} onSwitched={onSwitched} />
        <NodeNote />
      </div>
    </Tile>
  );
}
