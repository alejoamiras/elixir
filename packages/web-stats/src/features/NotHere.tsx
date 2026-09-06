import { Tile, TileHeader } from '../../../ui/src/index.ts';

export function NotHere() {
  return (
    <Tile data-testid="not-here">
      <TileHeader>what is not here, because the chain does not have it</TileHeader>
      <p className="text-pretty text-sm text-ink-2">
        How many miners there are. How fast any of them is. Which key claimed which epoch. What a key holds in
        private notes. The chain records a nullifier, a note hash and a counter per claim (a key's first claim
        also carries Aztec's delivery handshake, which someone who already knows that address can match), and
        the sponsor paid the fee; a public withdraw shows its amount and address by choice. A site that shows
        a miner count or a leaderboard is guessing.
      </p>
    </Tile>
  );
}
