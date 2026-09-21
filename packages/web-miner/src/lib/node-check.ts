// The node row's edit, as a pure state machine: the row, the field, the save under way. What the
// buttons may do and what stays under the field follow from the state; an answer for a URL the
// state no longer owns is dropped.
import type { NodeHealth, NodeStanding } from '@yacana/site/browser/node-health';

export type EditState =
  | { kind: 'row' }
  /** The field; `error` is the last save's failure, kept under it until the next attempt. */
  | { kind: 'editing'; url: string; error?: string }
  | { kind: 'probing'; url: string }
  | { kind: 'switching'; url: string; latencyMs: number };

export type EditEvent =
  | { type: 'change'; url: string }
  | { type: 'edit'; url: string }
  | { type: 'cancel' }
  | { type: 'probe'; url: string }
  | { type: 'reachable'; url: string; latencyMs: number }
  | { type: 'failed'; url: string; message: string }
  | { type: 'saved' };

/** The states each event may leave; an answer must also name the URL the state owns. */
const FROM: Record<Exclude<EditEvent['type'], 'change'>, readonly EditState['kind'][]> = {
  edit: ['editing'],
  cancel: ['editing'],
  probe: ['editing'],
  reachable: ['probing'],
  failed: ['probing', 'switching'],
  saved: ['switching'],
};

export function editReducer(state: EditState, e: EditEvent): EditState {
  if (e.type === 'change') return { kind: 'editing', url: e.url };
  if (!FROM[e.type].includes(state.kind)) return state;
  if ('url' in e && 'url' in state && (e.type === 'reachable' || e.type === 'failed') && state.url !== e.url)
    return state;
  switch (e.type) {
    case 'edit':
      return { kind: 'editing', url: e.url };
    case 'cancel':
    case 'saved':
      return { kind: 'row' };
    case 'probe':
      return { kind: 'probing', url: e.url };
    case 'reachable':
      return { kind: 'switching', url: e.url, latencyMs: e.latencyMs };
    case 'failed':
      return { kind: 'editing', url: e.url, error: e.message };
  }
}

export const editing = (s: EditState): boolean => s.kind !== 'row';
export const saving = (s: EditState): boolean => s.kind === 'probing' || s.kind === 'switching';

/** The deployment check's refusal in the row's words; anything else as the check said it. */
export function probeFailure(message: string, kept: string): string {
  const rollup = /node serves rollup ([^,\s]+)/.exec(message);
  const chain = /node is on chain (\d+)/.exec(message);
  const why = rollup
    ? `Not this deployment's node (it serves rollup ${rollup[1]})`
    : chain
      ? `Not this deployment's node (it is on chain ${chain[1]})`
      : message.replace(/\.$/, '');
  return `${why}. Kept ${kept}.`;
}

/** `kept` is the node still in use, or null when the former node could not be rebuilt from either. */
export const rebuildFailure = (from: string, message: string, kept: string | null): string =>
  `Couldn't rebuild your view from ${from}: ${message.replace(/\.$/, '')}. ${
    kept ? `Kept ${kept}.` : 'The former node did not answer either; reload the page.'
  }`;

const clock = (s: number): string => (s >= 90 ? `${Math.round(s / 60)} min` : `${s} s`);
const time = (at: number): string => new Date(at).toISOString().slice(11, 16);

export interface RowWords {
  chip: { word: string; tone: 'ok' | 'warn' | 'dim' };
  /** Line 3: the tip, the state's sentence. */
  line: string;
  retry: boolean;
}

/** The row's chip and third line for a standing; `paused` is the miner's own word. */
export function rowWords(
  standing: NodeStanding,
  h: NodeHealth,
  now: number,
  ageS: number | null,
  paused: boolean,
): RowWords {
  const tip =
    h.tip === null
      ? 'no block read yet'
      : `block ${h.tip.block.toLocaleString('en-US')} · ${clock(ageS ?? 0)} ago`;
  const pause = paused ? ' · mining paused' : '';
  switch (standing) {
    case 'throttled':
      return {
        chip: { word: 'throttled', tone: 'warn' },
        line: `${tip} · public nodes throttle busy pages; it recovers on its own · mining pauses if it lasts a minute`,
        retry: false,
      };
    case 'silent': {
      const since = h.transport.kind === 'silent' ? h.transport.since : now;
      const view = h.lastReadAt === null ? 'no view yet' : `your view is from ${time(h.lastReadAt)}`;
      return {
        chip: { word: `no answer · ${clock(Math.max(0, Math.round((now - since) / 1000)))}`, tone: 'warn' },
        line: `${view}${pause}`,
        retry: true,
      };
    }
    case 'behind':
      return {
        chip: { word: `behind · ${clock(ageS ?? 0)}`, tone: 'warn' },
        line: `${tip} · the node answers, but its chain is old${pause}`,
        retry: false,
      };
    case 'healthy':
      return { chip: { word: 'healthy', tone: 'ok' }, line: tip, retry: false };
    case 'unknown':
      // L1 said nothing yet: the transport's word, never a verdict it could not give.
      return h.deploymentOk
        ? { chip: { word: 'healthy', tone: 'ok' }, line: tip, retry: false }
        : { chip: { word: 'checking', tone: 'dim' }, line: tip, retry: false };
  }
}
