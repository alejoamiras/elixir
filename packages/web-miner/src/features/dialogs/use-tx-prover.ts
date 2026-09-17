import { useAtomValue } from 'jotai';
import { PROVING, type ProverKind, prestoAtom, prestoProvesTx, txProvingAtom } from '../../presto';

/** Who proves the transaction: the one proving now, else the one the next proof is allowed. */
export function useTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const presto = useAtomValue(prestoAtom);
  return on ?? (prestoProvesTx(presto) ? 'presto' : 'wasm');
}

export const useProvingWords = () => PROVING[useTxProver()];
