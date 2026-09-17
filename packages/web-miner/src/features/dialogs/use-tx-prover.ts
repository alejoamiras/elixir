import { useAtomValue } from 'jotai';
import { useRef } from 'react';
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

/**
 * For a transaction's own progress screen, mounted for it alone: the answer its proof gave, kept
 * through submission and inclusion after the proof ended; the promise until the proof says. A proof
 * already in flight at mount is another transaction's and is never taken.
 */
export function useHeldTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const promised = usePromisedTxProver();
  const armed = useRef(false);
  const held = useRef<ProverKind | null>(null);
  if (on === null) armed.current = true;
  else if (armed.current) held.current = on;
  return held.current ?? promised;
}

export const useProvingWords = () => PROVING[usePromisedTxProver()];
export const useHeldProvingWords = () => PROVING[useHeldTxProver()];
