// The Ethereum RPC as a setting, the Node tile's twin: the one in use with its health, a field to
// check another (it must serve the portal's chain and know the portal), and "Use this RPC".
import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { defaultEthRpcUrl } from '../../../site/src/browser/connection.ts';
import {
  type EthRpcProbe,
  ethRpcHealth,
  parseEthRpcUrl,
  subscribeEthRpcHealth,
} from '../../../site/src/browser/eth-rpc.ts';
import { Button, Input, Label, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { Session } from '../session';

type Check =
  | { kind: 'idle' }
  | { kind: 'checking'; url: string }
  | { kind: 'ok'; url: string; probe: EthRpcProbe }
  | { kind: 'failed'; url: string; message: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function HealthLine({ inUse }: { inUse: string }) {
  const health = useSyncExternalStore(subscribeEthRpcHealth, ethRpcHealth, ethRpcHealth);
  const isDefault = inUse === defaultEthRpcUrl();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line-2 px-3.5 py-3">
      <div className="min-w-0">
        <div className="font-mono text-sm" data-testid="eth-rpc-in-use">
          {new URL(inUse).host}
          {isDefault && <span className="text-2xs text-ink-3"> · the default</span>}
        </div>
        <div className="mt-1.5 font-mono text-2xs text-ink-2" data-testid="eth-rpc-health">
          {health.kind === 'unknown' && <span>not asked yet</span>}
          {health.kind === 'ok' && (
            <span className="text-ok">answering · {Math.round(health.latencyMs)} ms</span>
          )}
          {health.kind === 'failed' && (
            <span className="text-warn">
              not answering ({health.status}) · new withdrawals to Ethereum are held back
            </span>
          )}
        </div>
      </div>
      <Button size="sm" disabled>
        In use
      </Button>
    </div>
  );
}

export function EthRpcTile({
  session,
  ethRpcUrl,
  onSwitched,
}: {
  session: Session;
  ethRpcUrl: string;
  onSwitched: () => void;
}) {
  const [text, setText] = useState('');
  const [check, dispatch] = useReducer((_: Check, next: Check) => next, { kind: 'idle' });
  const [busy, setBusy] = useState(false);
  useEffect(() => dispatch({ kind: 'idle' }), []);
  const run = async () => {
    let url: string;
    try {
      url = parseEthRpcUrl(text, import.meta.env.VITE_SITE_MODE).href;
    } catch (e) {
      dispatch({ kind: 'failed', url: text, message: message(e) });
      return;
    }
    dispatch({ kind: 'checking', url });
    try {
      dispatch({ kind: 'ok', url, probe: await session.probeEthRpc(url) });
    } catch (e) {
      dispatch({ kind: 'failed', url, message: message(e) });
    }
  };
  const use = async (url: string) => {
    setBusy(true);
    try {
      await session.switchEthRpc(url);
      setText('');
      dispatch({ kind: 'idle' });
      onSwitched();
    } catch (e) {
      dispatch({ kind: 'failed', url, message: message(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tile>
      <TileHeader aside="Ethereum">Ethereum RPC</TileHeader>
      <p className="mb-3 text-xs text-ink-2">
        The bridge reads the portal through this JSON-RPC and holds back new withdrawals while it is silent.
        Any https endpoint for the portal’s chain will do.
      </p>
      <HealthLine inUse={ethRpcUrl} />
      <div className="mt-3 flex flex-col gap-1">
        <Label htmlFor="eth-rpc">Another RPC</Label>
        <div className="flex gap-2">
          <Input
            id="eth-rpc"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              dispatch({ kind: 'idle' });
            }}
            placeholder="https://…"
            className="font-mono"
            data-testid="eth-rpc-input"
          />
          <Button
            size="sm"
            disabled={!text || check.kind === 'checking'}
            onClick={() => void run()}
            data-testid="eth-rpc-check"
          >
            {check.kind === 'checking' ? 'Checking…' : 'Check'}
          </Button>
        </div>
      </div>
      {check.kind === 'failed' && (
        <p className="mt-2 text-xs text-warn" data-testid="eth-rpc-failed">
          {check.message}
        </p>
      )}
      {check.kind === 'ok' && (
        <div className="mt-2 flex items-center gap-3 text-xs" data-testid="eth-rpc-ok">
          <span className="text-ok">
            chain {check.probe.chainId.toString()} · block {check.probe.block.toString()} ·{' '}
            {Math.round(check.probe.latencyMs)} ms · the portal is there ✓
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => void use(check.url)}
            data-testid="eth-rpc-use"
          >
            Use this RPC
          </Button>
        </div>
      )}
    </Tile>
  );
}
