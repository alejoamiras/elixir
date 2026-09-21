// Settings → Network → the Ethereum RPC, the node row's twin: the chip from every outcome the
// guard reports for it, the host and whether it is the default, the chain and the latency; Change
// turns it into a field, Save checks the candidate (the portal's chain, the portal's code) and
// takes it, a failure stays under the field with the old RPC kept.

import { Button, Input, StatusChip } from '@yacana/ui';
import { defaultEthRpcUrl } from '@yacana/web-kit/browser/connection';
import {
  ethChainName,
  ethRpcHealth,
  parseEthRpcUrl,
  subscribeEthRpcHealth,
} from '@yacana/web-kit/browser/eth-rpc';
import { useReducer, useSyncExternalStore } from 'react';
import { bridgeRecord } from '../bridge/env';
import { editReducer, saving } from '../lib/node-check';
import type { Session } from '../session';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const host = (url: string) => new URL(url).host;

function Row({ inUse, onChange, onDefault }: { inUse: string; onChange: () => void; onDefault: () => void }) {
  const health = useSyncExternalStore(subscribeEthRpcHealth, ethRpcHealth, ethRpcHealth);
  const chain = ethChainName(bridgeRecord()?.chainId ?? '');
  const isDefault = inUse === defaultEthRpcUrl();
  const chip =
    health.kind === 'ok'
      ? { word: 'healthy', tone: 'ok' as const }
      : health.kind === 'failed'
        ? { word: 'no answer', tone: 'warn' as const }
        : { word: 'not asked yet', tone: 'dim' as const };
  const line =
    health.kind === 'ok'
      ? `${chain} · ${(health.latencyMs / 1000).toFixed(1)} s`
      : health.kind === 'failed'
        ? `${chain} · not answering (${health.status}) · new withdrawals to Ethereum are held back`
        : chain;
  return (
    <div
      className="flex items-start justify-between gap-4"
      data-testid="eth-rpc-row"
      data-state={health.kind}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2.5 text-sm">
          <span>Ethereum RPC</span>
          <StatusChip tone={chip.tone} data-testid="eth-rpc-chip">
            {chip.word}
          </StatusChip>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-ink-2">
          <span data-testid="eth-rpc-in-use">{host(inUse)}</span>
          {isDefault ? (
            <span className="text-ink-3">· default</span>
          ) : (
            <>
              <span className="text-ink-3">· custom</span>
              <Button variant="link" className="text-xs" onClick={onDefault} data-testid="eth-rpc-default">
                Use the default
              </Button>
            </>
          )}
        </div>
        <div className="font-mono text-2xs text-ink-3" data-testid="eth-rpc-health">
          {line}
        </div>
      </div>
      <Button size="sm" className="shrink-0" onClick={onChange} data-testid="eth-rpc-change">
        Change
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
  const [state, dispatch] = useReducer(editReducer, { kind: 'row' });
  const save = async (typed: string) => {
    let url: string;
    try {
      url = parseEthRpcUrl(typed, import.meta.env.VITE_SITE_MODE).href;
    } catch (e) {
      dispatch({ type: 'probe', url: typed });
      return dispatch({ type: 'failed', url: typed, message: `${message(e)}. Kept ${host(ethRpcUrl)}.` });
    }
    dispatch({ type: 'edit', url });
    dispatch({ type: 'probe', url });
    try {
      const probe = await session.probeEthRpc(url);
      dispatch({ type: 'reachable', url, latencyMs: probe.latencyMs });
      await session.switchEthRpc(url);
    } catch (e) {
      return dispatch({
        type: 'failed',
        url,
        message: `${message(e).replace(/\.$/, '')}. Kept ${host(ethRpcUrl)}.`,
      });
    }
    onSwitched();
    dispatch({ type: 'saved' });
  };
  const busy = saving(state);
  return (
    <div className="rounded-[8px] border border-line-2 px-3.5 py-3">
      {state.kind === 'row' ? (
        <Row
          inUse={ethRpcUrl}
          onChange={() => dispatch({ type: 'change', url: '' })}
          onDefault={() => {
            dispatch({ type: 'change', url: defaultEthRpcUrl() });
            void save(defaultEthRpcUrl());
          }}
        />
      ) : (
        <div className="flex flex-col gap-2" data-testid="eth-rpc-edit">
          <span className="text-sm">Ethereum RPC</span>
          <div className="flex gap-2">
            <Input
              id="eth-rpc"
              className="font-mono"
              value={state.url}
              placeholder="https://…"
              disabled={busy}
              onChange={(e) => dispatch({ type: 'edit', url: e.target.value })}
              data-testid="eth-rpc-input"
            />
            <Button
              variant="primary"
              disabled={busy || !state.url.trim()}
              onClick={() => void save(state.url)}
              data-testid="eth-rpc-save"
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => dispatch({ type: 'cancel' })}
              data-testid="eth-rpc-cancel"
            >
              Cancel
            </Button>
          </div>
          {state.kind === 'editing' && state.error ? (
            <p className="text-xs text-warn" data-testid="eth-rpc-failed">
              {state.error}
            </p>
          ) : (
            <p className="text-xs text-ink-3">Any https JSON-RPC for the portal’s chain.</p>
          )}
        </div>
      )}
    </div>
  );
}
