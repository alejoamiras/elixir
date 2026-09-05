// The miner's state machine, kept pure so the epoch-switch and secret-rotation rules are unit
// tested without a Worker or a chain: the controller feeds it events, it says what to do next.
import type { ProofLine, Sample } from '../../../ui/src/index.ts';

export interface EpochInfo {
  epoch: bigint;
  seed: bigint;
  target: bigint;
  openedAt: bigint;
  claims: number;
}

export type Phase = 'idle' | 'mining' | 'claiming';

export type LedgerLine = ProofLine & { id: number };

export interface MinerState {
  phase: Phase;
  /** The epoch the Worker is (or was last) mining, with the secret generated for it. */
  job: { epoch: bigint; seed: bigint; target: bigint; secretId: number } | null;
  /** Monotonic id of the current secret; a new epoch always gets a new one. */
  secretId: number;
  /** Tickets tried in the current epoch and in this session. */
  tickets: number;
  proofs: number;
  /** Prove durations of the last attempts, newest last, for the rate readout. */
  recent: number[];
  /** Best score of the current epoch, if any attempt was made. */
  best: number | null;
  /** Every attempt of the last SAMPLE_SPAN_MS, oldest first (the score loop). */
  samples: Sample[];
  /** performance.now() of the last winning proof, for the bar flash. */
  winAt: number | null;
  /** Newest first, at most LEDGER lines. */
  ledger: LedgerLine[];
  wins: number;
  lastError: string | null;
  /** Set once the prover is abandoned (start failure or repeated crashes): only a reload helps. */
  proverDead: boolean;
}

export const initial: MinerState = {
  phase: 'idle',
  job: null,
  secretId: 0,
  tickets: 0,
  proofs: 0,
  recent: [],
  best: null,
  samples: [],
  winAt: null,
  ledger: [],
  wins: 0,
  lastError: null,
  proverDead: false,
};

/** A wall-clock stamp (`at`, ms since epoch) and a monotonic one (`t`, performance.now()). */
export interface Clock {
  at: number;
  t: number;
}

export type Event =
  | { type: 'start'; epoch: EpochInfo }
  | { type: 'stop' }
  | ({ type: 'epoch'; epoch: EpochInfo; difficultyRatio?: number } & Partial<Clock>)
  | ({ type: 'attempt'; proveMs: number; score: number; win: boolean } & Clock)
  | { type: 'winner'; epoch: bigint; secretId: number }
  | ({ type: 'claimed'; block: number; reward: string; chain?: string } & Partial<Clock>)
  | ({ type: 'failed'; error: string } & Partial<Clock>)
  | { type: 'prover-dead'; error: string };

export type Command =
  | { type: 'mine'; epoch: bigint; seed: bigint; target: bigint; secretId: number }
  | { type: 'halt' }
  | { type: 'submit' }
  | { type: 'discard'; reason: string };

const RECENT = 20;
const LEDGER = 200;
const SAMPLE_SPAN_MS = 60_000;

const clock = (at?: number): string => new Date(at ?? Date.now()).toISOString().slice(11, 19);

let lineId = 0;
const line = (state: MinerState, l: ProofLine): LedgerLine[] =>
  [{ ...l, id: ++lineId }, ...state.ledger].slice(0, LEDGER);

function startJob(state: MinerState, epoch: EpochInfo): [MinerState, Command[]] {
  const secretId = state.secretId + 1;
  const job = { epoch: epoch.epoch, seed: epoch.seed, target: epoch.target, secretId };
  return [{ ...state, phase: 'mining', job, secretId, lastError: null }, [{ type: 'mine', ...job }]];
}

function attempt(state: MinerState, e: Extract<Event, { type: 'attempt' }>): MinerState {
  const tickets = state.tickets + 1;
  const best = state.best === null || e.score > state.best ? e.score : state.best;
  const samples = [...state.samples.filter((s) => e.t - s.t <= SAMPLE_SPAN_MS), { t: e.t, score: e.score }];
  const l: ProofLine = e.win
    ? { kind: 'win', time: clock(e.at), n: tickets, score: e.score, proveMs: e.proveMs }
    : {
        kind: 'attempt',
        time: clock(e.at),
        n: tickets,
        score: e.score,
        proveMs: e.proveMs,
        best: e.score === best,
      };
  return {
    ...state,
    tickets,
    proofs: state.proofs + 1,
    recent: [...state.recent, e.proveMs].slice(-RECENT),
    best,
    samples,
    winAt: e.win ? e.t : state.winAt,
    ledger: line(state, l),
  };
}

function epochSwitch(state: MinerState, e: Extract<Event, { type: 'epoch' }>): [MinerState, Command[]] {
  // A new epoch while mining: the in-flight nonce is worthless and the secret rotates with it.
  // The running job is halted first; the Worker starts the replacement once it has stopped.
  if (state.job?.epoch === e.epoch.epoch) return [state, []];
  const ratio = e.difficultyRatio === undefined ? '' : ` (×${e.difficultyRatio.toFixed(2)})`;
  const opened = {
    ...state,
    tickets: 0,
    best: null,
    ledger: line(state, {
      kind: 'epoch',
      time: clock(e.at),
      text: `epoch ${e.epoch.epoch} opened${ratio} · new secret`,
    }),
  };
  if (state.phase !== 'mining') return [opened, []];
  const [next, commands] = startJob(opened, e.epoch);
  return [next, [{ type: 'halt' }, ...commands]];
}

function winner(state: MinerState, e: Extract<Event, { type: 'winner' }>): [MinerState, Command[]] {
  // Only a winner for the job that is still current gets submitted; a stale one is discarded.
  if (state.phase !== 'mining' || !state.job) return [state, []];
  if (e.epoch !== state.job.epoch || e.secretId !== state.job.secretId)
    return [state, [{ type: 'discard', reason: 'won against a closed epoch' }]];
  return [{ ...state, phase: 'claiming' }, [{ type: 'submit' }]];
}

function claimed(state: MinerState, e: Extract<Event, { type: 'claimed' }>): MinerState {
  return {
    ...state,
    phase: 'idle',
    job: null,
    wins: state.wins + 1,
    ledger: line(state, {
      kind: 'minted',
      time: clock(e.at),
      text: `claim in block ${e.block.toLocaleString('en-US')} · ${e.reward} minted, privately`,
      ...(e.chain && { chain: e.chain }),
    }),
  };
}

export function reduce(state: MinerState, event: Event): [MinerState, Command[]] {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' && !state.proverDead ? startJob(state, event.epoch) : [state, []];
    case 'prover-dead':
      return [{ ...state, phase: 'idle', job: null, lastError: event.error, proverDead: true }, []];
    case 'stop':
      return [{ ...state, phase: 'idle', job: null }, state.phase === 'idle' ? [] : [{ type: 'halt' }]];
    case 'epoch':
      return epochSwitch(state, event);
    case 'attempt':
      return [attempt(state, event), []];
    case 'winner':
      return winner(state, event);
    case 'claimed':
      return [claimed(state, event), []];
    case 'failed':
      return [
        {
          ...state,
          phase: 'idle',
          job: null,
          lastError: event.error,
          ledger: line(state, { kind: 'failed', time: clock(event.at), text: event.error }),
        },
        [{ type: 'halt' }],
      ];
  }
}
