import { useAtomValue } from 'jotai';
import { ProofLedger, Tile, TileHeader } from '../../../ui/src/index.ts';
import { minerAtom } from '../state';

export function LedgerTile() {
  const miner = useAtomValue(minerAtom);
  return (
    <Tile>
      <TileHeader aside="★ win · ✓ minted · ✗ failed · ── epoch">proofs, newest first</TileHeader>
      {miner.ledger.length ? (
        <ProofLedger lines={miner.ledger} className="max-h-80 overflow-y-auto" data-testid="ledger" />
      ) : (
        <p className="text-xs text-ink-2">nothing yet</p>
      )}
    </Tile>
  );
}
