// Send ahead: the amount (the whole balance by default) → the sheet that says what the
// send goes through, station by station, with the note for the day the next version never opens
// → "Sent ahead." with the burn's block. No switch, no consent line: nothing sends or lands by
// itself; landing is a tap on the arrival card.
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import type { Crossing } from '../../../bridge/src/journal.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AmountBlock,
  Button,
  Note,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Stepper,
} from '../../../ui/src/index.ts';
import { migrationRecord } from '../bridge/env';
import { reviewAmount } from '../bridge/forms';
import { amount as fmt } from '../lib/format';
import type { Session } from '../session';
import { bootAtom, journalAtom } from '../state';
import { AmountInput } from './AmountInput';
import { saveRecoveryFile } from './recovery';

type Step =
  | { kind: 'form' }
  | { kind: 'review'; amount: bigint; display: string }
  | { kind: 'sent'; display: string; crossing?: Crossing };

const version = () => import.meta.env.VITE_ROLLUP_VERSION;
const nextVersion = () => migrationRecord()?.toIndex ?? 'the next version';
const nextDay = () => {
  const m = migrationRecord();
  return m ? `~${new Date(Number(m.expectedFlipAt) * 1000).toISOString().slice(5, 10)}` : undefined;
};
const hhmm = (unix: string) => new Date(Number(unix) * 1000).toISOString().slice(11, 16);

function Head({ title }: { title: string }) {
  return (
    <div>
      <span className="label-mono">send ahead to aztec v{nextVersion()}</span>
      <SheetTitle className="mt-1.5 text-[22px] leading-[1.2] tracking-[-0.02em]">{title}</SheetTitle>
      <SheetDescription className="sr-only">
        The balance leaves V{version()} once its epoch is proven and lands on the next version with a tap.
      </SheetDescription>
    </div>
  );
}

function Review({
  display,
  busy,
  onSend,
  onEdit,
  onNotNow,
}: {
  display: string;
  busy: boolean;
  onSend: () => void;
  onEdit: () => void;
  onNotNow: () => void;
}) {
  const v = version();
  const n = nextVersion();
  return (
    <>
      <AmountBlock
        value={display}
        unit={PARAMS.TOKEN_SYMBOL}
        tone="quiet"
        aside={
          <button
            type="button"
            className="text-uv-2 hover:underline"
            onClick={onEdit}
            data-testid="ahead-edit"
          >
            some of it →
          </button>
        }
      />
      <Stepper
        steps={[
          {
            id: 'leave',
            label: 'leaves this account, privately',
            state: 'pending',
            right: 'about 20 s',
            detail: 'Mining pauses while your browser proves it.',
          },
          {
            id: 'prove',
            label: 'proven to Ethereum with its epoch',
            state: 'pending',
            right: 'a few epochs',
            detail: `V${v} must prove the epoch by its deadline. If it does not, the send is undone and the balance is back here.`,
          },
          {
            id: 'held',
            label: `held on Ethereum until V${n} opens`,
            state: 'pending',
            right: nextDay(),
            detail:
              'Out of reach meanwhile, held for this account alone. The amount is visible there, nothing else.',
          },
          {
            id: 'land',
            label: `lands on V${n}: a tap on the arrival card`,
            state: 'pending',
            detail: 'A private claim this page makes when you tap, fee sponsored, about 20 s. Same passkey.',
          },
        ]}
      />
      <Note title="The amount is public on Ethereum." tone="warn" data-testid="ahead-privacy">
        The account is not: the send is held under a one-time secret of this account. Round amounts blend in.
      </Note>
      <Note title={`If V${n} never opens`}>
        A send Yacana could not forward can be redeemed on Ethereum as YACA at any time, by this account. The
        passkey or words are the only thing to keep.
      </Note>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="uv" disabled={busy} onClick={onSend} data-testid="ahead-send">
          {busy ? 'Proving and sending…' : `Send ${display} ahead`}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onNotNow}>
          Not now
        </Button>
      </div>
      <p className="text-xs text-ink-3">
        Anything still on V{v} when it stops proving is lost. V{v} stops hours or days after the upgrade,
        without notice.
      </p>
    </>
  );
}

function Sent({
  display,
  sent,
  session,
  onDone,
}: {
  display: string;
  sent?: Crossing;
  session: Session;
  onDone: () => void;
}) {
  const journal = useAtomValue(journalAtom);
  const boot = useAtomValue(bootAtom);
  const [note, setNote] = useState<string>();
  const live = (sent && journal.find((c) => c.id === sent.id)) ?? sent;
  const v = version();
  const n = nextVersion();
  const block = live?.block
    ? `✓ burned in block ${live.block.toLocaleString('en-US')}`
    : '✓ burned · waiting for a block';
  const save = async () => {
    try {
      setNote(await saveRecoveryFile(session, boot.phase === 'ready' ? boot.account : 'account'));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="flex flex-col gap-4" data-testid="ahead-sent">
      <AmountBlock
        value={display}
        unit={PARAMS.TOKEN_SYMBOL}
        tone="ok"
        aside={<span className="text-ok">{block}</span>}
      />
      <Stepper
        steps={[
          { id: 'leave', label: 'burned here, privately', state: 'done' },
          {
            id: 'prove',
            label: 'being proven to Ethereum',
            state: 'active',
            right: live?.proofDeadline ? `by ${hhmm(live.proofDeadline)}` : undefined,
            detail: `${live?.epoch ? `Epoch ${live.epoch}. ` : ''}Usually within a few epochs; safe from then on. If V${v} misses the deadline the send is undone and the balance is back here.`,
          },
          { id: 'held', label: `held on Ethereum until V${n} opens`, state: 'pending', right: nextDay() },
          {
            id: 'land',
            label: `lands on V${n} with a tap`,
            state: 'pending',
            detail: 'Same passkey. The arrival card there claims it when you tap.',
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
        <Button
          variant="link"
          size="sm"
          className="text-uv-2"
          onClick={() => void save()}
          data-testid="ahead-save"
        >
          save a recovery file ⤓
        </Button>
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </div>
      <p className="text-xs text-ink-3">You can close this; the card on Mine follows it. Mining resumed.</p>
    </div>
  );
}

export function SendAheadSheet({
  session,
  balance,
  open,
  onOpenChange,
}: {
  session: Session;
  balance: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const whole = fmt(balance, PARAMS.DECIMALS, PARAMS.DECIMALS);
  const [text, setText] = useState(whole);
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const close = () => {
    setStep({ kind: 'form' });
    setError(undefined);
    setText(whole);
    onOpenChange(false);
  };
  const toReview = () => {
    setError(undefined);
    try {
      setStep({ kind: 'review', ...reviewAmount(text, balance, PARAMS.DECIMALS) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const send = async (amount: bigint, display: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const crossing = (await session.bridge?.sendAhead(amount)) ?? undefined;
      setStep({ kind: 'sent', display, crossing });
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  const v = version();
  const n = nextVersion();
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="send-ahead-sheet">
        <Head
          title={
            step.kind === 'sent'
              ? 'Sent ahead.'
              : `Leaves V${v} once its epoch is proven. Lands on V${n} with a tap.`
          }
        />
        {error && (
          <Alert variant="bad" data-testid="send-ahead-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <>
            <AmountInput
              id="ahead-amount"
              value={text}
              onChange={setText}
              unit={PARAMS.TOKEN_SYMBOL}
              max={whole}
              aside={<span>all · {whole}</span>}
              data-testid="ahead-amount"
            />
            <p className="text-xs text-ink-3">the whole balance by default</p>
            <div>
              <Button variant="primary" onClick={toReview} data-testid="ahead-review">
                Review
              </Button>
            </div>
          </>
        )}
        {step.kind === 'review' && (
          <Review
            display={step.display}
            busy={busy}
            onSend={() => void send(step.amount, step.display)}
            onEdit={() => setStep({ kind: 'form' })}
            onNotNow={close}
          />
        )}
        {step.kind === 'sent' && (
          <Sent display={step.display} sent={step.crossing} session={session} onDone={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}
