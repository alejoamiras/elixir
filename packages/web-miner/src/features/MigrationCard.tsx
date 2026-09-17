// The upgrade card over the cockpit. Nothing on it says "safe": a send is held, comes back, or cannot leave.
import { useAtomValue } from 'jotai';
import { dayOf } from '../../../bridge/src/exit-deadline.ts';
import { type Crossing, inFlight, type RowState } from '../../../bridge/src/journal.ts';
import type { MigrationRecord } from '../../../bridge/src/record.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { ownVersionName } from '../../../site/src/browser/version-name.ts';
import { Button, HeroCard, StatusChip, type TrailItem } from '../../../ui/src/index.ts';
import { proofChip } from '../bridge/copy';
import { lifecycleRecord, migrationRecord, nextVersionName } from '../bridge/env';
import { amount as fmt } from '../lib/format';
import { navigate } from '../routes';
import { type BridgeView, balanceAtom, bridgeAtom, journalAtom, nowAtom, rowStatesAtom } from '../state';

export type MigrationMoment = 'quiet' | 'announced' | 'flipped';

const LEFT_THE_ROAD: ReadonlySet<RowState> = new Set([
  'dropped',
  'never-proven',
  'unfinished',
  'minted-l1',
  'closed',
]);

export const moment = (announced: MigrationRecord | null, flipped: boolean): MigrationMoment =>
  flipped ? 'flipped' : announced ? 'announced' : 'quiet';

const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL}`;
const hhmm = (unix: bigint) => new Date(Number(unix) * 1000).toISOString().slice(11, 16);

/** How far a send-ahead got, as a station of the trail; a state the trail has no station for reads as held. */
const STAGE: Partial<Record<Crossing['state'], number>> = {
  proving: 1,
  sent: 1,
  'proven-pending': 1,
  held: 2,
  forwarded: 3,
  claimable: 4,
  'minted-l2': 5,
};

/** The stations of what was sent ahead, the least advanced send lighting the one it is at. */
export const sentTrail = (ahead: Crossing[], next: string): TrailItem[] => {
  const at = Math.min(...ahead.map((c) => STAGE[c.state] ?? 2));
  return ['sent', 'reaching Ethereum', `held for ${next}`, `forwarded to ${next}`, `claim on ${next}`].map(
    (label, i) => ({ label, state: i < at ? 'done' : i === at ? 'on' : 'todo' }),
  );
};

interface Props {
  onSendAhead: () => void;
  onHow: () => void;
  className?: string;
}

interface Facts extends Props {
  version: string;
  next: string;
  ahead: Crossing[];
  balance: bigint | null;
  view: BridgeView;
}

function SendButton({
  balance,
  view,
  onSendAhead,
  plain = false,
}: Pick<Facts, 'balance' | 'view' | 'onSendAhead'> & { plain?: boolean }) {
  return (
    <Button
      variant="uv"
      disabled={!balance || view.rpcFailing}
      onClick={onSendAhead}
      data-testid="send-ahead"
    >
      Send{balance && !plain ? ` ${money(balance)}` : ''} ahead
    </Button>
  );
}

const How = ({ onHow }: Pick<Props, 'onHow'>) => (
  <Button variant="link" className="text-ink-2" onClick={onHow} data-testid="send-ahead-how">
    How it works
  </Button>
);

function Announced({
  version,
  next,
  expectedFlipAt,
  balance,
  view,
  onSendAhead,
  onHow,
  className,
}: Facts & { expectedFlipAt: bigint }) {
  const day = dayOf(expectedFlipAt);
  return (
    <HeroCard
      className={className}
      eyebrow={`aztec ${next.toLowerCase()} · expected around ${day.toLowerCase()}`}
      title={`Aztec upgrades to ${next} around ${day}.`}
      actions={
        <>
          <SendButton balance={balance} view={view} onSendAhead={onSendAhead} plain />
          <How onHow={onHow} />
        </>
      }
      data-testid="migration-card"
      data-moment="announced"
    >
      Mining continues here until then. Send your balance ahead when you’re ready: {version} proves it out,
      it’s held on Ethereum for {next}, and you claim it on {next} with one tap. After the upgrade {version}{' '}
      keeps proving for a while, then stops without notice; send ahead before it does.
    </HeroCard>
  );
}

function Sent({
  version,
  next,
  expectedFlipAt,
  ahead,
  balance,
  view,
  onSendAhead,
  className,
}: Facts & { expectedFlipAt: bigint }) {
  const sum = ahead.reduce((a, c) => a + BigInt(c.amount), 0n);
  const mined = balance !== null && balance > 0n;
  return (
    <HeroCard
      className={className}
      eyebrow={`aztec ${next.toLowerCase()} · expected around ${dayOf(expectedFlipAt).toLowerCase()}`}
      title={<span data-testid="sent-ahead-status">{money(sum)} sent ahead.</span>}
      trail={sentTrail(ahead, next)}
      actions={
        <>
          {mined && <SendButton balance={balance} view={view} onSendAhead={onSendAhead} />}
          {mined && <span className="text-sm text-ink-2">{money(balance)} mined since</span>}
          <Button variant="link" className="text-ink-2" onClick={() => navigate('wallet')}>
            Wallet · details
          </Button>
        </>
      }
      data-testid="migration-card"
      data-moment="announced"
    >
      Held on Ethereum for {next} once {version} proves it; you claim it on {next} with one tap. Wins mined
      since then stay here until you send them too.
    </HeroCard>
  );
}

/** A held send is still crossing: it lands only once forwarded and claimed. */
function SentLine({ ahead }: { ahead: Crossing[] }) {
  if (ahead.length === 0) return null;
  const crossing = ahead.filter(inFlight).length;
  const sum = ahead.reduce((a, c) => a + BigInt(c.amount), 0n);
  return (
    <p className="mt-2 text-xs text-ink-3" data-testid="sent-ahead-status">
      {money(sum)} sent ahead{crossing > 0 ? ` · ${crossing} still crossing` : ' · held or landed'}
    </p>
  );
}

function Flipped({ version, next, ahead, balance, view, onSendAhead, onHow, className }: Facts) {
  const now = useAtomValue(nowAtom);
  const chip = proofChip(view.proof, lifecycleRecord()?.stoppedProvingAt, Math.floor(now / 1000), version);
  const flipAt = view.standing && view.standing.flipAt > 0n ? view.standing.flipAt : undefined;
  return (
    <HeroCard
      className={className}
      tone="warn"
      eyebrow={`aztec ${next.toLowerCase()} is live${flipAt ? ` · ${dayOf(flipAt).toLowerCase()} ${hhmm(flipAt)}` : ''}`}
      aside={
        <StatusChip tone={chip.tone} data-testid="proof-chip">
          {chip.word}
        </StatusChip>
      }
      title={<span data-testid="flipped-alert">Mining has ended on {version}. Send what’s left ahead.</span>}
      actions={
        <>
          <SendButton balance={balance} view={view} onSendAhead={onSendAhead} />
          <How onHow={onHow} />
        </>
      }
      data-testid="migration-card"
      data-moment="flipped"
    >
      {version} keeps proving for a while after an upgrade, then stops without notice. A send it proves is
      held on Ethereum for {next}; one it never proves comes back here; what’s still here when it stops can’t
      leave.
      <SentLine ahead={ahead} />
    </HeroCard>
  );
}

export function MigrationCard(props: Props) {
  const view = useAtomValue(bridgeAtom);
  const journal = useAtomValue(journalAtom);
  const states = useAtomValue(rowStatesAtom);
  const balance = useAtomValue(balanceAtom);
  const announced = migrationRecord();
  const m = moment(announced, view.verdict.kind === 'flipped');
  if (m === 'quiet') return null;
  const facts: Facts = {
    ...props,
    version: ownVersionName(),
    next: nextVersionName(view.canonical),
    // What went ahead from this version and is still ahead: an earlier upgrade's send-aheads arrived
    // here, they are not leaving; a send undone by a missed proof (or never sent) is the balance
    // again, a redeemed one went to Ethereum, and one the last day closed on is not on its way.
    ahead: journal.filter(
      (c) =>
        c.kind === 2 &&
        c.version === import.meta.env.VITE_ROLLUP_VERSION &&
        !LEFT_THE_ROAD.has(states[c.id] ?? c.state),
    ),
    balance,
    view,
  };
  if (m === 'flipped') return <Flipped {...facts} />;
  const expectedFlipAt = BigInt((announced as MigrationRecord).expectedFlipAt);
  return facts.ahead.length > 0 ? (
    <Sent {...facts} expectedFlipAt={expectedFlipAt} />
  ) : (
    <Announced {...facts} expectedFlipAt={expectedFlipAt} />
  );
}
