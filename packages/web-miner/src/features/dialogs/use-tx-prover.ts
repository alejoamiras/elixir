import { useAtomValue } from 'jotai';
import { PROVING, type ProverKind, prestoAtom, prestoProvesTx, txProvingAtom } from '../../presto';

/** Who proves the transaction: the one proving now, else the one the next proof will go to. */
export function useTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const presto = useAtomValue(prestoAtom);
  return on ?? (prestoProvesTx(presto) ? 'presto' : 'wasm');
}

/** The proving step's words for that prover. */
export const useProvingWords = () => PROVING[useTxProver()];
