// The Node tile's check, as a pure state machine: what the buttons may do follows from the state.
import type { NodeProbe } from '../../../site/src/browser/node.ts';

export type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking'; url: string }
  | { kind: 'ok'; url: string; probe: NodeProbe }
  | { kind: 'failed'; url: string; message: string }
  | { kind: 'switching'; url: string }
  | { kind: 'switched'; url: string }
  | { kind: 'switch-failed'; url: string; message: string };

export type CheckEvent =
  | { type: 'edit' }
  | { type: 'check'; url: string }
  | { type: 'ok'; url: string; probe: NodeProbe }
  | { type: 'failed'; url: string; message: string }
  | { type: 'switch'; url: string }
  | { type: 'switched'; url: string }
  | { type: 'switch-failed'; url: string; message: string };

/** Only the state that owns the answer's URL takes it; anything else is stale and ignored. */
const owns = (state: CheckState, kind: CheckState['kind'], url: string): boolean =>
  state.kind === kind && 'url' in state && state.url === url;

export function checkReducer(state: CheckState, e: CheckEvent): CheckState {
  if (e.type === 'edit') return state.kind === 'switching' ? state : { kind: 'idle' };
  if (e.type === 'check') return { kind: 'checking', url: e.url };
  const from: Record<Exclude<CheckEvent['type'], 'edit' | 'check'>, CheckState['kind']> = {
    ok: 'checking',
    failed: 'checking',
    switch: 'ok',
    switched: 'switching',
    'switch-failed': 'switching',
  };
  if (!owns(state, from[e.type], e.url)) return state;
  switch (e.type) {
    case 'ok':
      return { kind: 'ok', url: e.url, probe: e.probe };
    case 'failed':
      return { kind: 'failed', url: e.url, message: e.message };
    case 'switch':
      return { kind: 'switching', url: e.url };
    case 'switched':
      return { kind: 'switched', url: e.url };
    case 'switch-failed':
      return { kind: 'switch-failed', url: e.url, message: e.message };
  }
}

/** "Use this node" is offered only for the URL whose check passed and that is not the node in use. */
export const canUse = (state: CheckState, typed: string, inUse: string): boolean =>
  state.kind === 'ok' && state.url === typed.trim() && state.url !== inUse;

export const describeProbe = (p: NodeProbe): string[] => [
  `✓ chain ${p.chainId} · rollup ${p.rollupVersion}`,
  '✓ the miner and the token are there',
  `block ${p.block.toLocaleString('en-US')} · ${p.blockAgeS} s old`,
  `${Math.round(p.latencyMs)} ms`,
];
