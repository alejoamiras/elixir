// The miner's state machine, kept pure so the epoch-switch and secret-rotation rules are unit
// tested without a Worker or a chain: the controller feeds it events, it says what to do next.
export interface EpochInfo {
  epoch: bigint;
  seed: bigint;
  target: bigint;
  openedAt: bigint;
  claims: number;
}

export type Phase = 'idle' | 'mining' | 'claiming';

export interface MinerState {
  phase: Phase;
  /** The epoch the Worker is (or was last) mining, with the secret generated for it. */
  job: { epoch: bigint; seed: bigint; target: bigint; secretId: number } | null;
  /** Monotonic id of the current secret; a new epoch always gets a new one. */
  secretId: number;
  tickets: number;
  /** Prove durations of the last attempts, newest last, for the proofs/s readout. */
  recent: number[];
  lastError: string | null;
}

export const initial: MinerState = {
  phase: 'idle',
  job: null,
  secretId: 0,
  tickets: 0,
  recent: [],
  lastError: null,
};

export type Event =
  | { type: 'start'; epoch: EpochInfo }
  | { type: 'stop' }
  | { type: 'epoch'; epoch: EpochInfo }
  | { type: 'attempt'; proveMs: number }
  | { type: 'winner'; epoch: bigint; secretId: number }
  | { type: 'claimed' }
  | { type: 'failed'; error: string };

export type Command =
  | { type: 'mine'; epoch: bigint; seed: bigint; target: bigint; secretId: number }
  | { type: 'halt' }
  | { type: 'submit' }
  | { type: 'discard'; reason: string };

const RECENT = 20;

function startJob(state: MinerState, epoch: EpochInfo): [MinerState, Command[]] {
  const secretId = state.secretId + 1;
  const job = { epoch: epoch.epoch, seed: epoch.seed, target: epoch.target, secretId };
  return [{ ...state, phase: 'mining', job, secretId, lastError: null }, [{ type: 'mine', ...job }]];
}

export function reduce(state: MinerState, event: Event): [MinerState, Command[]] {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' ? startJob(state, event.epoch) : [state, []];
    case 'stop':
      return [{ ...state, phase: 'idle', job: null }, state.phase === 'idle' ? [] : [{ type: 'halt' }]];
    case 'epoch': {
      // A new epoch while mining: the in-flight nonce is worthless and the secret rotates with it.
      // The running job is halted first; the Worker starts the replacement once it has stopped.
      if (state.phase !== 'mining' || state.job?.epoch === event.epoch.epoch) return [state, []];
      const [next, commands] = startJob({ ...state, tickets: 0 }, event.epoch);
      return [next, [{ type: 'halt' }, ...commands]];
    }
    case 'attempt':
      return [
        { ...state, tickets: state.tickets + 1, recent: [...state.recent, event.proveMs].slice(-RECENT) },
        [],
      ];
    case 'winner':
      // Only a winner for the job that is still current gets submitted; a stale one is discarded.
      if (state.phase !== 'mining' || !state.job) return [state, []];
      if (event.epoch !== state.job.epoch || event.secretId !== state.job.secretId)
        return [state, [{ type: 'discard', reason: 'won against a closed epoch' }]];
      return [{ ...state, phase: 'claiming' }, [{ type: 'submit' }]];
    case 'claimed':
      return [{ ...state, phase: 'idle', job: null }, []];
    case 'failed':
      return [{ ...state, phase: 'idle', job: null, lastError: event.error }, [{ type: 'halt' }]];
  }
}

/** Proofs per second over the recent window. */
export const proofsPerSecond = (recent: number[]): number =>
  recent.length ? 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
