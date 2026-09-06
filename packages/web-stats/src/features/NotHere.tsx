import { Tile, TileHeader } from '../../../ui/src/index.ts';

/** The closing block: what a stats page for this token cannot show, and why. */
export function NotHere() {
  return (
    <Tile data-testid="not-here">
      <TileHeader>what is not here, because it is not anywhere</TileHeader>
      <p className="text-pretty text-sm text-ink-2">
        How many miners there are. How fast any of them is. Who claimed which epoch. Anyone's balance. The
        chain records a nullifier, a note hash and a counter per claim, and the sponsor paid the fee. A site
        that shows a miner count or a leaderboard is guessing.
      </p>
    </Tile>
  );
}
