// The guided path, one card, as drawn: announced → the moment's title, the trail of what a send
// goes through, one large button; sent → the same card as a status while this version still holds
// something; the flip detected → mining ended here, what is left still crosses while this version
// proves. Every moment says what is lost and when. Nothing on a quiet version.
import { useAtomValue } from 'jotai';
import { type Crossing, inFlight } from '../../../bridge/src/journal.ts';
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Button, HeroCard, type HeroTone, Stepper, type TrailItem } from '../../../ui/src/index.ts';
import { migrationRecord } from '../bridge/env';
import { duration, amount as fmt } from '../lib/format';
import { type BridgeView, balanceAtom, bridgeAtom, journalAtom, nowAtom } from '../state';

/** FAQ on the landing: served by the root SPA fallback of the same origin. */
export const FAQ_HREF = `${(import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/')}faq`;

export type MigrationMoment = 'quiet' | 'announced' | 'flipped';

export const moment = (announced: MigrationRecord | null, flipped: boolean): MigrationMoment =>
  flipped ? 'flipped' : announced ? 'announced' : 'quiet';

const day = (unix: string | bigint): string => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;
const PAST = new Set<Crossing['state']>(['proving', 'sent', 'proven-pending']);

/** What has been sent ahead so far, and what was mined since; the line the tests and the eye read. */
function SentAhead({ ahead, balance }: { ahead: Crossing[]; balance: bigint | null }) {
  if (ahead.length === 0) return null;
  const crossing = ahead.filter(inFlight).length;
  const sum = ahead.reduce((a, c) => a + BigInt(c.amount), 0n);
  return (
    <p className="text-xs text-ink-2" data-testid="sent-ahead-status">
      {money(sum)} sent ahead
      {crossing > 0 ? ` · ${crossing} still crossing` : ' · all landed or held for you'}
      {balance && balance > 0n ? ` · ${money(balance)} mined since — send those too` : ''}
    </p>
  );
}

function SendButton({
  balance,
  view,
  onSendAhead,
  now = false,
}: {
  balance: bigint | null;
  view: BridgeView;
  onSendAhead: () => void;
  now?: boolean;
}) {
  return (
    <Button
      variant="uv"
      size="lg"
      disabled={!balance || view.rpcFailing}
      onClick={onSendAhead}
      data-testid="send-ahead"
    >
      Send {balance ? money(balance) : ''} ahead{now ? ' now' : ''}
    </Button>
  );
}

const Faq = () => (
  <a href={FAQ_HREF} className="text-xs text-uv-2 hover:underline" target="_blank" rel="noopener noreferrer">
    what happens, step by step →
  </a>
);

/** The send's stations before anything was sent, and once something was: what is behind, what is on. */
const announcedTrail = (sent: boolean, proven: boolean, version: string, next: string): TrailItem[] => [
  sent ? { label: `left V${version}`, state: 'done' } : { label: `leaves V${version} · now`, state: 'on' },
  { label: 'proven to Ethereum · safe', state: !sent ? 'todo' : proven ? 'done' : 'on' },
  { label: `waits for V${next}`, state: sent && proven ? 'on' : 'todo' },
  { label: `lands with a tap on V${next}`, state: 'todo' },
];

const announcedTitle = (sent: boolean, sum: bigint, balance: bigint | null, version: string): string => {
  if (!sent) return `V${version} ends soon. Send your balance ahead.`;
  const since = balance && balance > 0n ? ` ${money(balance)} mined since.` : '';
  return `${money(sum)} sent ahead.${since}`;
};

function Announced({
  version,
  next,
  expected,
  ahead,
  balance,
  view,
  onSendAhead,
  loss,
}: {
  version: string;
  next: string;
  expected: number;
  ahead: Crossing[];
  balance: bigint | null;
  view: BridgeView;
  onSendAhead: () => void;
  loss: string;
}) {
  const sent = ahead.length > 0;
  const proven = sent && ahead.some((c) => !PAST.has(c.state));
  const sum = ahead.reduce((a, c) => a + BigInt(c.amount), 0n);
  const when = expected > 0 ? `In about ${duration(expected)}` : 'Soon';
  const offer = !sent || (balance !== null && balance > 0n);
  return (
    <HeroCard
      eyebrow={`aztec v${next} · ${expected > 0 ? `expected in about ${duration(expected)}` : 'expected any time'}`}
      title={announcedTitle(sent, sum, balance, version)}
      trail={announcedTrail(sent, proven, version, next)}
      tone={sent ? 'ok' : 'uv'}
      side={
        <>
          {offer && <SendButton balance={balance} view={view} onSendAhead={onSendAhead} now={sent} />}
          <Faq />
          <span className="text-xs text-ink-3">
            Mining continues here until the upgrade. Wins after this need sending ahead too.
          </span>
        </>
      }
      data-testid="migration-card"
      data-moment="announced"
    >
      {sent ? (
        <>
          Held on Ethereum once V{version} proves each epoch, out of V{version}’s reach; it lands on V{next}{' '}
          with a tap on the arrival card, same passkey. {loss}
        </>
      ) : (
        <>
          {when}, Aztec starts V{next} and V{version} stops. Sent ahead, your balance waits on Ethereum, out
          of V{version}’s reach, once V{version} proves the epoch; it lands on V{next} with a tap on the
          arrival card, same passkey. The amount is public on Ethereum; the account is not. {loss}
        </>
      )}
      <SentAhead ahead={ahead} balance={balance} />
    </HeroCard>
  );
}

function Flipped({
  version,
  next,
  ahead,
  balance,
  view,
  onSendAhead,
  loss,
}: {
  version: string;
  next: string;
  ahead: Crossing[];
  balance: bigint | null;
  view: BridgeView;
  onSendAhead: () => void;
  loss: string;
}) {
  const retired = view.verdict.kind === 'flipped' && view.verdict.by.includes('retired');
  const flipDay = view.standing && view.standing.flipAt > 0n ? day(view.standing.flipAt) : undefined;
  return (
    <HeroCard
      eyebrow={`aztec v${next} is canonical${flipDay ? ` · ${flipDay}` : ''}`}
      title={
        <span data-testid="flipped-alert">Mining has ended on V{version}. Send what is left ahead now.</span>
      }
      tone="warn"
      side={
        <>
          <SendButton balance={balance} view={view} onSendAhead={onSendAhead} />
          <Stepper
            className="w-full text-left"
            steps={[
              { id: 'canonical', label: `V${next} canonical`, state: 'done', right: flipDay },
              {
                id: 'retired',
                label: `V${version} retired · claims refused`,
                state: retired ? 'done' : 'active',
                right: retired ? undefined : 'soon',
              },
              { id: 'opens', label: `Yacana opens on V${next}`, state: 'active', right: 'next' },
              { id: 'app', label: `the V${next} app here`, state: 'pending' },
            ]}
          />
        </>
      }
      data-testid="migration-card"
      data-moment="flipped"
    >
      V{version}’s contract refuses mining claims{' '}
      {retired ? 'since the retire message landed' : 'once the retire message lands'}.{' '}
      <b>
        {balance && balance > 0n
          ? `${money(balance)} still on V${version}.`
          : `Nothing is left on V${version}.`}
      </b>{' '}
      Sending it ahead now is a bet that V{version} proves one more epoch; leaving it is a sure loss. Yacana’s
      next app takes this address once V{next}’s contract is deployed; each send shows its own proof deadline.{' '}
      {loss}
      <SentAhead ahead={ahead} balance={balance} />
    </HeroCard>
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
  const next = announced ? announced.toIndex : (view.canonical?.version.toString() ?? '?');
  const ahead = journal.filter((c) => c.kind === 2 && c.state !== 'dropped' && c.state !== 'never-proven');
  const expected = announced ? Number(announced.expectedFlipAt) - Math.floor(now / 1000) : 0;
  const loss = `Anything still on V${version} when it goes quiet is lost. V${version} goes quiet after the upgrade, without notice.`;
  const props = { version, next, ahead, balance, view, onSendAhead, loss };
  return m === 'flipped' ? <Flipped {...props} /> : <Announced {...props} expected={expected} />;
}

export type { HeroTone };
