// The explorer links the miner shows, from the build's configured base.
import { explorer, explorerBase } from '../../site/src/browser/explorer.ts';

export const links = explorer(explorerBase(import.meta.env.VITE_EXPLORER_URL));

/** The ledger's resolver: a minted line's block and transaction as explorer URLs. */
export const ledgerLinks = (l: { block: number; tx: string }) => ({
  block: links.block(l.block),
  tx: links.tx(l.tx),
});
