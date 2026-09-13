// The one-line announcement the stats pages carry while a migration is announced: the build's
// record says which Registry index comes next and when the flip is expected; miners are pointed
// at the FAQ and the miner.
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { Alert, AlertDescription } from '../../../ui/src/index.ts';
import { FAQ_HREF } from '../routes';

const migration = (): MigrationRecord | null =>
  import.meta.env.VITE_MIGRATION ? (JSON.parse(import.meta.env.VITE_MIGRATION) as MigrationRecord) : null;

/** "Aztec's next version arrives around <day>": the one sentence, from the record's migration block. */
export const announcementLine = (m: MigrationRecord, version: string): string =>
  `Aztec's next version arrives around ${new Date(Number(m.expectedFlipAt) * 1000).toISOString().slice(0, 10)}. Mining on V${version} ends at the flip; send what you hold ahead from the miner before then.`;

export function Announcement() {
  const m = migration();
  if (!m) return null;
  return (
    <Alert variant="warn" data-testid="announcement">
      <AlertDescription>
        {announcementLine(m, import.meta.env.VITE_ROLLUP_VERSION)}{' '}
        <a href={FAQ_HREF} className="underline underline-offset-3">
          what happens →
        </a>
      </AlertDescription>
    </Alert>
  );
}
