// The guided path, one card: announced → "Send N ahead" (one button, one sheet); sent → a status
// while this version still holds something; the flip detected → mining ended here, what is left
// still crosses while this version proves; every screen says what is lost and when. It shows only
// with an announced migration or a detected flip, never on a quiet version.
import { useAtomValue } from 'jotai';
import { type Crossing, inFlight } from '../../../bridge/src/journal.ts';
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Alert, AlertDescription, AlertTitle, Button, Tile, TileHeader } from '../../../ui/src/index.ts';
import { migrationRecord } from '../bridge/env';
import { duration, amount as fmt } from '../lib/format';
import { balanceAtom, bridgeAtom, journalAtom, nowAtom } from '../state';

/** FAQ on the landing: served by the root SPA fallback of the same origin. */
export const FAQ_HREF = `${(import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/')}faq`;

export type MigrationMoment = 'quiet' | 'announced' | 'flipped';

export const moment = (announced: MigrationRecord | null, flipped: boolean): MigrationMoment =>
  flipped ? 'flipped' : announced ? 'announced' : 'quiet';

function Headline({
  m,
  version,
  next,
  expected,
}: {
  m: MigrationMoment;
  version: string;
  next?: number;
  expected: number | null;
}) {
  if (m === 'announced')
    return (
      <p className="text-sm text-ink-2">
        {expected !== null && expected > 0 ? `In about ${duration(expected)}, ` : 'Soon, '}
        Aztec starts a new rollup (V{next ?? '?'}) and this one stops. Send your balance ahead now: it waits
        on Ethereum, out of this version’s reach, and lands on the next one for this same passkey.
      </p>
    );
  return (
    <Alert variant="warn" data-testid="flipped-alert">
      <AlertTitle>Mining has ended on V{version}.</AlertTitle>
      <AlertDescription>
        Yacana’s next app arrives at this address within hours. Send what is left ahead while V{version} still
        proves — days at most. Anything still here when it goes quiet is lost, without notice.
      </AlertDescription>
    </Alert>
  );
}

/** What has been sent ahead so far, and what was mined since. */
function SentAhead({ ahead, balance }: { ahead: Crossing[]; balance: bigint | null }) {
  if (ahead.length === 0) return null;
  const crossing = ahead.filter(inFlight).length;
  const sum = ahead.reduce((a, c) => a + BigInt(c.amount), 0n);
  return (
    <p className="mt-3 text-xs text-ink-2" data-testid="sent-ahead-status">
      {fmt(sum, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} sent ahead
      {crossing > 0 ? ` · ${crossing} still crossing` : ' · all landed or held for you'}
      {balance && balance > 0n
        ? ` · ${fmt(balance, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} mined since — send those too`
        : ''}
    </p>
  );
}

export function MigrationCard({ onSendAhead }: { onSendAhead: () => void }) {
  const view = useAtomValue(bridgeAtom);
  const journal = useAtomValue(journalAtom);
  const balance = useAtomValue(balanceAtom);
  const now = useAtomValue(nowAtom);
  const announced = migrationRecord();
  const m = moment(announced, view.verdict.kind === 'flipped');
  if (m === 'quiet') return null;
  const version = import.meta.env.VITE_ROLLUP_VERSION;
  const ahead = journal.filter((c) => c.kind === 2 && c.state !== 'dropped' && c.state !== 'never-proven');
  const expected = announced ? Number(announced.expectedFlipAt) - Math.floor(now / 1000) : null;
  return (
    <Tile className="md:col-span-2 xl:col-span-4" data-testid="migration-card" data-moment={m}>
      <TileHeader aside={m === 'flipped' ? 'the upgrade happened' : 'upgrade announced'}>
        {m === 'flipped' ? `Aztec moved on from V${version}` : 'Aztec is moving on'}
      </TileHeader>
      <Headline
        m={m}
        version={version}
        next={announced ? Number(announced.toIndex) : undefined}
        expected={expected}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="uv"
          size="sm"
          disabled={!balance || view.rpcFailing}
          onClick={onSendAhead}
          data-testid="send-ahead"
        >
          Send {balance ? `${fmt(balance, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}` : ''} ahead
        </Button>
        <a
          href={FAQ_HREF}
          className="text-xs text-ink-2 underline underline-offset-4"
          target="_blank"
          rel="noopener noreferrer"
        >
          what happens →
        </a>
      </div>
      <SentAhead ahead={ahead} balance={balance} />
      <p className="mt-2 text-xs text-ink-3">
        Anything still on V{version} when it goes quiet is lost. V{version} goes quiet days after the upgrade,
        without notice.
      </p>
    </Tile>
  );
}
