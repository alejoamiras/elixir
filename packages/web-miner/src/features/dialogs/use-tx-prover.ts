import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { PROVING, type ProverKind, prestoAtom, prestoProvesTx, txProvingAtom } from '../../presto';
import { provingCrossingAtom } from '../../state';

/** Who the next transaction's proof is allowed: a form's promise, never another transaction's answer. */
export function usePromisedTxProver(): ProverKind {
  return prestoProvesTx(useAtomValue(prestoAtom)) ? 'presto' : 'wasm';
}

/** The miner's own claim: the proof in flight when it is no crossing's, else the promise. */
export function useTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const crossing = useAtomValue(provingCrossingAtom);
  const promised = usePromisedTxProver();
  return crossing === null ? (on ?? promised) : promised;
}

export type ProvingWords = (typeof PROVING)[ProverKind];

export const useProvingWords = () => PROVING[usePromisedTxProver()];

/**
 * A dialog's own transaction: `said` goes to the session with the operation and hears that
 * operation's proof alone, so the progress screen keeps its answer through submission, whatever
 * else proves meanwhile; the promise until then, and again after `reset`.
 */
export function useOwnProvingWords() {
  const [own, said] = useState<ProverKind | null>(null);
  const promised = usePromisedTxProver();
  return { words: PROVING[own ?? promised], said, reset: () => said(null) };
}
