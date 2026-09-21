import { difficulty } from '@yacana/miner-core/metrics';
import { ProofLedger, type ProofLine, Tile, TileHeader } from '@yacana/ui';
import { useAtomValue } from 'jotai';
import type { MinerController } from '../controller';
import { ledgerLinks } from '../explorer';
import { settlementSuffix, winNote } from '../lib/claim-copy';
import type { LedgerLine } from '../lib/reducer';
import type { ProverKind } from '../presto';
import { type ClaimRecord, claimsAtom, epochAtom, minerAtom, nowAtom } from '../state';
import { useTxProver } from './dialogs/use-tx-prover';

/** The lines as the ledger draws them: the win's note as of `now`, the minted line's settlement by its transaction. */
export const shownLines = (
  lines: readonly LedgerLine[],
  claims: readonly ClaimRecord[],
  nowMs: number,
  prover: ProverKind = 'wasm',
): (ProofLine & { id: number })[] =>
  lines.map((l) => {
    if (l.kind === 'win') return { ...l, note: winNote(l.claim, nowMs, prover) };
    if (l.kind === 'minted' && l.links) {
      const suffix = settlementSuffix(claims.find((c) => c.txHash === l.links?.tx)?.settled);
      return suffix ? { ...l, suffix } : l;
    }
    return l;
  });

export function LedgerTile({
  controller,
  className,
}: {
  controller: () => MinerController | undefined;
  className?: string;
}) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const claims = useAtomValue(claimsAtom);
  const now = useAtomValue(nowAtom);
  const txProver = useTxProver();
  // Before any proof the ledger still has one true line: when the open epoch opened.
  const lines: LedgerLine[] = miner.ledger.length
    ? miner.ledger
    : epoch
      ? [
          {
            id: 0,
            kind: 'epoch',
            time: new Date(Number(epoch.openedAt) * 1000).toISOString().slice(11, 19),
            text: `epoch ${epoch.epoch} opened · bar ${difficulty(epoch.target).toFixed(1)}`,
          },
        ]
      : [];
  return (
    <Tile className={className}>
      <TileHeader aside="★ win · claiming · ✓ minted, final once its epoch is proven · ✗ failed · ── epoch">
        proofs, newest first
      </TileHeader>
      {lines.length ? (
        <ProofLedger
          lines={shownLines(lines, claims, now, txProver)}
          linkFor={ledgerLinks}
          onAction={() => void controller()?.retryPendingClaim()}
          className="max-h-80 overflow-y-auto"
          data-testid="ledger"
        />
      ) : (
        <p className="text-xs text-ink-2">nothing yet</p>
      )}
    </Tile>
  );
}
