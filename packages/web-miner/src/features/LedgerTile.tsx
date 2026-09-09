import { useAtomValue } from 'jotai';
import { ProofLedger, Tile, TileHeader } from '../../../ui/src/index.ts';
import { ledgerLinks } from '../explorer';
import type { LedgerLine } from '../lib/reducer';
import { epochAtom, minerAtom } from '../state';

export function LedgerTile({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  // Before any proof the ledger still has one true line: when the open epoch opened.
  const lines: LedgerLine[] = miner.ledger.length
    ? miner.ledger
    : epoch
      ? [
          {
            id: 0,
            kind: 'epoch',
            time: new Date(Number(epoch.openedAt) * 1000).toISOString().slice(11, 19),
            text: `epoch ${epoch.epoch} opened`,
          },
        ]
      : [];
  return (
    <Tile className={className}>
      <TileHeader aside="★ win · ✓ minted · ✗ failed · ── epoch">proofs, newest first</TileHeader>
      {lines.length ? (
        <ProofLedger
          lines={lines}
          linkFor={ledgerLinks}
          className="max-h-80 overflow-y-auto"
          data-testid="ledger"
        />
      ) : (
        <p className="text-xs text-ink-2">nothing yet</p>
      )}
    </Tile>
  );
}
