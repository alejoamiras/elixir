import { KvRow, Tile, TileHeader } from '../../../ui/src/index.ts';
import { ConnectionCard } from '../components/ConnectionCard';
import type { Connection } from '../config';

export function Settings({ connection }: { connection: Connection }) {
  return (
    <>
      <ConnectionCard connection={connection} />
      <Tile>
        <TileHeader>About</TileHeader>
        <KvRow label="source" value={import.meta.env.VITE_SOURCE_COMMIT.slice(0, 12)} />
        <KvRow label="build" value={import.meta.env.VITE_SITE_MODE} />
        <KvRow label="relying party" value={import.meta.env.VITE_RP_ID} />
      </Tile>
    </>
  );
}
