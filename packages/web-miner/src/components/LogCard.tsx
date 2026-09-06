import { useAtomValue } from 'jotai';
import { Tile, TileHeader } from '../../../ui/src/index.ts';
import { logAtom } from '../state';

export function LogCard() {
  const log = useAtomValue(logAtom);
  return (
    <Tile>
      <TileHeader>Log</TileHeader>
      <pre className="max-h-64 overflow-auto font-mono text-xs" data-testid="log">
        {log.length ? log.join('\n') : 'nothing yet'}
      </pre>
    </Tile>
  );
}
