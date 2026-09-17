import { useAtomValue } from 'jotai';
import { useRef } from 'react';
import { PROVING, type ProverKind, prestoAtom, prestoProvesTx, txProvingAtom } from '../../presto';

/** Who proves the transaction: the one proving now, else the one the next proof is allowed. */
export function useTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const presto = useAtomValue(prestoAtom);
  return on ?? (prestoProvesTx(presto) ? 'presto' : 'wasm');
}

/**
 * For a transaction's own progress screen, mounted for it alone: the answer its proof gave, kept
 * through submission and inclusion after the proof ended; the allowed prover until the proof says.
 */
export function useHeldTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const next = useTxProver();
  const held = useRef<ProverKind | null>(null);
  if (on !== null) held.current = on;
  return held.current ?? next;
}

export const useProvingWords = () => PROVING[useTxProver()];
export const useHeldProvingWords = () => PROVING[useHeldTxProver()];
