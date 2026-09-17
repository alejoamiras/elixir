import { useAtomValue } from 'jotai';
import { PROVING, type ProverKind, prestoAtom, prestoProvesTx, txProvingAtom } from '../../presto';

/** Who proves the transaction: the last proof's answer while its transaction is under way, else who the next is allowed. */
export function useTxProver(): ProverKind {
  const on = useAtomValue(txProvingAtom);
  const presto = useAtomValue(prestoAtom);
  return on ?? (prestoProvesTx(presto) ? 'presto' : 'wasm');
}

export const useProvingWords = () => PROVING[useTxProver()];
