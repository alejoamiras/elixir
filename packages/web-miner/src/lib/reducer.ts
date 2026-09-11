// The miner's state machine, kept pure so the epoch-switch, secret-rotation and claim-outcome
// rules are unit tested without a Worker or a chain: the controller feeds it events, it says what
// to do next.
import { CLAIM_FAILURE_COPY, type ClaimFailure } from '../../../miner-core/src/claim-failure.ts';
import { difficulty } from '../../../miner-core/src/metrics.ts';
import type { ProofLine, Sample } from '../../../ui/src/index.ts';

export interface EpochInfo {
  epoch: bigint;
  seed: bigint;
  target: bigint;
  openedAt: bigint;
  claims: number;
}

/** `recovering`: the chain view is being rebuilt after a lost race; `start` waits for it. */
export type Phase = 'idle' | 'mining' | 'claiming' | 'recovering';

export type LedgerLine = ProofLine & { id: number };

/** The claim in flight: `proving` in-page, `sent` to the node (the TTL runs), `waiting` for its note. */
export interface ClaimProgress {
  step: 'proving' | 'sent' | 'waiting';
  /** Wall clock (ms) when the current step started. */
  since: number;
  /** Durations (ms) of the finished steps, in order. */
  done: number[];
  txHash?: string;
  /** Unix seconds; the sequencer drops the claim past this. */
  expiresAt?: number;
}

/** What the chain saw of the last claim; kept until the next claim, shown fresh for MINTED_FRESH_MS. */
export interface Minted {
  block: number;
  txHash: string;
  nullifier: string;
  noteHash: string;
  /** How many note hashes the transaction carried (a first contact adds the handshake's). */
  noteHashes: number;
  /** The epoch's claim count before and after. */
  claims: [number, number];
  /** Wall clock (ms) of the mint; the acknowledgement's freshness runs from here. */
  at: number;
}

/** How long a mint counts as fresh: the slot shows its ✓ and the pill says minted for this long. */
export const MINTED_FRESH_MS = 10_000;
export const mintedFresh = (m: Minted | null, nowMs: number): boolean =>
  m !== null && nowMs - m.at < MINTED_FRESH_MS;

export type NoticeKind = 'reverted' | 'expired' | 'failed' | 'prover-dead' | 'offline' | 'paused';

/** The card under the loop. `until` (ms) is when a pause ends. */
export interface Notice {
  kind: NoticeKind;
  title: string;
  body: string;
  until?: number;
}

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
  claim: ClaimProgress | null;
  minted: Minted | null;
  notice: Notice | null;
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
  claim: null,
  minted: null,
  notice: null,
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
  | { type: 'winner'; epoch: bigint; secretId: number; at?: number }
  | { type: 'sent'; txHash: string; expiresAt?: number; at?: number }
  | { type: 'included'; block: number; at?: number }
  | ({ type: 'claimed'; reward: string } & Omit<Minted, 'at'> & Partial<Clock>)
  | ({ type: 'failed'; error: string; kind?: ClaimFailure } & Partial<Clock>)
  | { type: 'recovered'; at?: number }
  /** A claim that failed at proving, submitted again from idle (the e2e canary's control). */
  | { type: 'retry'; at?: number }
  /** The honest pause after a recovery that did not unblock the key. */
  | { type: 'paused'; until: number; at?: number }
  | { type: 'offline'; since: number }
  | { type: 'online' }
  | { type: 'prover-dead'; error: string };

export type Command =
  | { type: 'mine'; epoch: bigint; seed: bigint; target: bigint; secretId: number }
  | { type: 'halt' }
  | { type: 'submit' }
  | { type: 'discard'; reason: string };

const RECENT = 20;
const LEDGER = 200;
/** Three minutes of proofs: the calm loop's window, about thirty samples at six seconds a proof. */
export const SAMPLE_SPAN_MS = 180_000;

const clock = (at?: number): string => new Date(at ?? Date.now()).toISOString().slice(11, 19);
const now = (at?: number): number => at ?? Date.now();

let lineId = 0;
const line = (state: MinerState, l: ProofLine): LedgerLine[] =>
  [{ ...l, id: ++lineId }, ...state.ledger].slice(0, LEDGER);

function startJob(state: MinerState, epoch: EpochInfo): [MinerState, Command[]] {
  const secretId = state.secretId + 1;
  const job = { epoch: epoch.epoch, seed: epoch.seed, target: epoch.target, secretId };
  // An expiry card outlives the automatic restart that follows it; the next winner clears it.
  const notice = state.notice?.kind === 'expired' ? state.notice : null;
  return [{ ...state, phase: 'mining', job, secretId, notice }, [{ type: 'mine', ...job }]];
}

function attempt(state: MinerState, e: Extract<Event, { type: 'attempt' }>): MinerState {
  const tickets = state.tickets + 1;
  const best = state.best === null || e.score > state.best ? e.score : state.best;
  // The bar of the job that scored it travels with the sample: a retarget must not re-judge old proofs.
  const bar = state.job ? difficulty(state.job.target) : undefined;
  const samples = [
    ...state.samples.filter((s) => e.t - s.t <= SAMPLE_SPAN_MS),
    { t: e.t, score: e.score, bar, win: e.win },
  ];
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
  // A new claim in flight replaces the last mint's acknowledgement.
  const claim: ClaimProgress = { step: 'proving', since: now(e.at), done: [] };
  return [{ ...state, phase: 'claiming', claim, minted: null, notice: null }, [{ type: 'submit' }]];
}

/** Moves the claim to its next step, closing the elapsed time of the current one. */
function advance(
  state: MinerState,
  step: ClaimProgress['step'],
  at: number | undefined,
  patch: Partial<ClaimProgress> = {},
): MinerState {
  if (!state.claim) return state;
  const t = now(at);
  const done = [...state.claim.done, Math.max(0, t - state.claim.since)];
  return { ...state, claim: { ...state.claim, ...patch, step, since: t, done } };
}

function claimed(state: MinerState, e: Extract<Event, { type: 'claimed' }>): MinerState {
  const { type: _, reward, at, t: __, ...rest } = e;
  const minted: Minted = { ...rest, at: now(at) };
  return {
    ...state,
    phase: 'idle',
    job: null,
    wins: state.wins + 1,
    claim: null,
    minted,
    ledger: line(state, {
      kind: 'minted',
      time: clock(at),
      text: `${reward} minted, privately`,
      links: { block: e.block, tx: e.txHash },
    }),
  };
}

function failed(state: MinerState, e: Extract<Event, { type: 'failed' }>): [MinerState, Command[]] {
  const base = {
    ...state,
    claim: null,
    ledger: line(state, { kind: 'failed', time: clock(e.at), text: e.error }),
  };
  if (e.kind === 'expired')
    return [
      { ...base, phase: 'idle', job: null, notice: { kind: 'expired', ...CLAIM_FAILURE_COPY.expired } },
      [],
    ];
  if (e.kind === 'reverted' || e.kind === 'delivery-blocked')
    return [
      {
        ...base,
        phase: 'recovering',
        job: null,
        notice: { kind: 'reverted', ...CLAIM_FAILURE_COPY[e.kind] },
      },
      [],
    ];
  const notice: Notice = { kind: 'failed', title: CLAIM_FAILURE_COPY.other.title, body: e.error };
  return [{ ...base, phase: 'idle', job: null, notice }, [{ type: 'halt' }]];
}

export function reduce(state: MinerState, event: Event): [MinerState, Command[]] {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' && !state.proverDead ? startJob(state, event.epoch) : [state, []];
    case 'prover-dead':
      return [
        {
          ...state,
          phase: 'idle',
          job: null,
          claim: null,
          notice: { kind: 'prover-dead', title: 'stopped · reload the page', body: event.error },
          proverDead: true,
        },
        [],
      ];
    case 'stop':
      return [{ ...state, phase: 'idle', job: null }, state.phase === 'idle' ? [] : [{ type: 'halt' }]];
    case 'retry':
      return state.phase === 'idle'
        ? [
            {
              ...state,
              phase: 'claiming',
              claim: { step: 'proving', since: now(event.at), done: [] },
              notice: null,
            },
            [{ type: 'submit' }],
          ]
        : [state, []];
    case 'epoch':
      return epochSwitch(state, event);
    case 'attempt':
      return [attempt(state, event), []];
    case 'winner':
      return winner(state, event);
    case 'sent':
      return [advance(state, 'sent', event.at, { txHash: event.txHash, expiresAt: event.expiresAt }), []];
    case 'included':
      return [advance(state, 'waiting', event.at), []];
    case 'claimed':
      return [claimed(state, event), []];
    case 'failed':
      return failed(state, event);
    case 'recovered':
      return [
        {
          ...state,
          phase: 'idle',
          ledger: line(state, {
            kind: 'epoch',
            time: clock(event.at),
            text: 'chain view rebuilt · notes recovered',
          }),
          notice: null,
        },
        [],
      ];
    case 'paused': {
      const minutes = Math.max(1, Math.round((event.until - now(event.at)) / 60_000));
      const notice: Notice = {
        kind: 'paused',
        title: 'claims paused',
        body: `The reset did not unblock this account. It can claim again once the reverted claim finalizes on L1, in about ${minutes} min. Mining resumes by itself.`,
        until: event.until,
      };
      return [{ ...state, phase: 'idle', notice }, []];
    }
    case 'offline':
      return [
        {
          ...state,
          notice: {
            kind: 'offline',
            title: 'node unreachable',
            body: `No answer from the node since ${clock(event.since)}. Mining is paused; it resumes when the node answers.`,
          },
        },
        [],
      ];
    case 'online':
      return [state.notice?.kind === 'offline' ? { ...state, notice: null } : state, []];
  }
}
