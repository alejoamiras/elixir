// Send ahead: the whole balance by default, because anything still on this version when it stops
// proving cannot leave. The recovery file is offered under Done: the journal is the only record of
// the crossing.
import { useAtomValue } from 'jotai';
import { type ComponentProps, useState } from 'react';
import { deadlinePhrase } from '../../../../bridge/src/exit-deadline.ts';
import type { Crossing } from '../../../../bridge/src/journal.ts';
import { PARAMS } from '../../../../miner-core/src/generated/params.ts';
import { ownVersionName } from '../../../../site/src/browser/version-name.ts';
import { Alert, AlertDescription, AmountField, Note, Stepper } from '../../../../ui/src/index.ts';
import { isOldRole, nextVersionName } from '../../bridge/env';
import { reviewAmount } from '../../bridge/forms';
import { FAQ_HREF } from '../../lib/apex';
import { amount as fmt } from '../../lib/format';
import type { Session } from '../../session';
import { bootAtom, bridgeAtom, journalAtom } from '../../state';
import { saveRecoveryFile } from '../recovery';
import { amountRefusal } from '../withdraw-form';
import {
  Actions,
  AmountBelow,
  Back,
  Foot,
  firstLine,
  hhmm,
  Primary,
  Quiet,
  Row,
  Rows,
  seconds,
  TxDialog,
  useElapsed,
  useLive,
  useOpening,
} from './Frame';
import { useProvingWords } from './use-tx-prover';

const SYM = PARAMS.TOKEN_SYMBOL;
const money = (raw: bigint) => `${fmt(raw, PARAMS.DECIMALS)} ${SYM}`;

type Step =
  | { kind: 'form' }
  | { kind: 'how'; display?: string }
  | { kind: 'proving'; amount: bigint; display: string; since: number }
  | { kind: 'sent'; display: string; crossing?: Crossing };

function Form({
  balance,
  next,
  onSend,
  onHow,
}: {
  balance: bigint;
  next: string;
  onSend: (amount: bigint, display: string) => void;
  onHow: (display?: string) => void;
}) {
  const whole = fmt(balance, PARAMS.DECIMALS, PARAMS.DECIMALS);
  const [text, setText] = useState(whole);
  const [error, setError] = useState<string>();
  const v = ownVersionName();
  const line = amountRefusal(text, balance, PARAMS.DECIMALS);
  const submit = () => {
    setError(undefined);
    if (line !== null) return;
    try {
      const { amount, display } = reviewAmount(text, balance, PARAMS.DECIMALS);
      onSend(amount, display);
    } catch (e) {
      setError(firstLine(e));
    }
  };
  return (
    <>
      {error && (
        <Alert variant="bad" data-testid="send-ahead-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AmountField
        id="ahead-amount"
        value={text}
        onChange={setText}
        unit={SYM}
        max={whole}
        invalid={line !== null}
        below={<AmountBelow line={line} balance={money(balance)} />}
        data-testid="ahead-amount"
      />
      <Rows>
        <Row label={`Leaves ${v}`}>usually within the hour</Row>
        <Row label="Then" sub={`or you do, from ${next}`}>
          held on Ethereum; Yacana forwards it into {next}
        </Row>
        <Row label={`On ${next}`}>you claim it, one tap</Row>
        <Row label="Visible on Ethereum" data-testid="ahead-privacy">
          the amount, not the account
        </Row>
      </Rows>
      <Actions
        quiet={<Quiet onClick={() => onHow(line === null ? text.trim() : undefined)}>How it works</Quiet>}
      >
        <Primary disabled={line !== null} onClick={submit} data-testid="ahead-send">
          Send{line === null ? ` ${text.trim()} ${SYM}` : ''} ahead
        </Primary>
      </Actions>
    </>
  );
}

/** The five stations with their times, and the day the next version never opens. */
function How({ next, onBack }: { next: string; onBack: () => void }) {
  const words = useProvingWords();
  const v = ownVersionName();
  const view = useAtomValue(bridgeAtom);
  return (
    <>
      <Back onBack={onBack} />
      <Stepper
        data-testid="ahead-how"
        steps={[
          {
            id: 'leave',
            label: `Leaves ${v}, privately`,
            state: 'pending',
            right: words.about,
            detail: words.how,
          },
          {
            id: 'reach',
            label: 'Reaches Ethereum with its epoch',
            state: 'pending',
            right: 'usually within the hour',
            detail: `${v} must prove the epoch within its deadline, about 40 min after the send. If it doesn't, the balance comes back here.`,
          },
          {
            id: 'held',
            label: `Held on Ethereum for ${next}`,
            state: 'pending',
            right: `until ${next} opens`,
            detail: `Out of ${v}'s reach, held for this account alone. The amount is visible there; the account is not.`,
          },
          {
            id: 'forward',
            label: `Forwarded into ${next}`,
            state: 'pending',
            right: 'by Yacana, or by you',
            detail: `Yacana runs a relayer (an address its multisig lists) that forwards held sends once ${next} opens. You can forward yours from ${next} with an Ethereum wallet paying gas. Forwarding ends the option below.`,
          },
          {
            id: 'claim',
            label: `You claim it on ${next}`,
            state: 'pending',
            right: 'one tap',
            detail: 'A private claim this page makes, no fee, about 20 s. Same passkey.',
          },
        ]}
      />
      <Note title={`If ${next} never opens, or Yacana is late`}>
        This account can redeem it on Ethereum as YACA instead, {deadlinePhrase(view.deadline, next)}. A pause
        or the exit limit can delay it.
      </Note>
      <a
        href={`${FAQ_HREF}#rules`}
        className="font-mono text-2xs text-uv-2 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        the rules, on /faq ↗
      </a>
    </>
  );
}

function Proving({ next, since }: { next: string; since: number }) {
  const elapsed = useElapsed(since);
  const words = useProvingWords();
  return (
    <>
      <Stepper
        data-testid="ahead-proving"
        steps={[
          {
            id: 'prove',
            label: 'Proving privately',
            state: 'active',
            right: elapsed === undefined ? undefined : seconds(elapsed),
            detail: words.detail,
          },
          { id: 'send', label: 'Sent', state: 'pending' },
          { id: 'reach', label: 'Reaching Ethereum', state: 'pending', right: 'usually within the hour' },
          { id: 'held', label: `Held on Ethereum for ${next}`, state: 'pending' },
        ]}
      />
      <Foot>{words.foot}</Foot>
    </>
  );
}

function Sent({
  session,
  next,
  crossing,
  onDone,
}: {
  session: Session;
  next: string;
  crossing?: Crossing;
  onDone: () => void;
}) {
  const journal = useAtomValue(journalAtom);
  const boot = useAtomValue(bootAtom);
  const [note, setNote] = useState<string>();
  const live = (crossing && journal.find((c) => c.id === crossing.id)) ?? crossing;
  const v = ownVersionName();
  const save = async () => {
    try {
      setNote(await saveRecoveryFile(session, boot.phase === 'ready' ? boot.account : 'account'));
    } catch (e) {
      setNote(firstLine(e));
    }
  };
  return (
    <div className="flex flex-col gap-4" data-testid="ahead-sent">
      <Stepper
        steps={[
          {
            id: 'sent',
            label: 'Proved and sent',
            state: 'done',
            right: live?.block ? `block ${live.block.toLocaleString('en-US')}` : 'waiting for a block',
          },
          {
            id: 'reach',
            label: 'Reaching Ethereum',
            state: 'active',
            right: live?.proofDeadline ? `by ${hhmm(live.proofDeadline)}` : 'usually within the hour',
            detail: `If ${v} misses it, the balance comes back here.`,
          },
          { id: 'held', label: `Held on Ethereum for ${next}`, state: 'pending' },
          {
            id: 'forward',
            label: `Forwarded into ${next}`,
            state: 'pending',
            detail: `By Yacana once ${next} opens, or by you from ${next}.`,
          },
          { id: 'claim', label: `You claim it on ${next}`, state: 'pending', right: 'one tap' },
        ]}
      />
      <Foot>
        You can close this. {isOldRole() ? 'Activity' : 'Wallet'} follows it here, and on {next} once you log
        in there.
      </Foot>
      <Actions
        quiet={
          <Quiet onClick={() => void save()} data-testid="ahead-save">
            Save a recovery file
          </Quiet>
        }
        below={note ?? 'a recovery file lets another device pick this send up'}
      >
        <Primary variant="primary" onClick={onDone}>
          Done
        </Primary>
      </Actions>
    </div>
  );
}

const titleOf = (step: Step, next: string): string => {
  if (step.kind === 'form') return `Send ahead to ${next}.`;
  if (step.kind === 'how')
    return `What happens to ${step.display ? `${step.display} ${SYM}` : 'what you send ahead'}.`;
  return step.kind === 'proving'
    ? `Sending ${step.display} ${SYM} ahead.`
    : `${step.display} ${SYM} sent ahead.`;
};

function SendAheadRun({
  session,
  balance,
  open,
  onOpenChange,
  initial = 'form',
}: {
  session: Session;
  balance: bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The step the dialog opens on: the form, or How it works from the card's quiet link (Back leads to the form). */
  initial?: 'form' | 'how';
}) {
  const view = useAtomValue(bridgeAtom);
  const next = nextVersionName(view.canonical);
  const [step, setStep] = useState<Step>({ kind: initial });
  const [error, setError] = useState<string>();
  const live = useLive(open);
  const close = () => onOpenChange(false);
  const send = async (amount: bigint, display: string) => {
    if (!live()) return;
    setError(undefined);
    setStep({ kind: 'proving', amount, display, since: Date.now() });
    try {
      const crossing = (await session.bridge?.sendAhead(amount)) ?? undefined;
      setStep({ kind: 'sent', display, crossing });
    } catch (e) {
      setError(firstLine(e));
      setStep({ kind: 'form' });
    }
  };
  const title = titleOf(step, next);
  return (
    <TxDialog
      open={open}
      onOpenChange={(o) => !o && close()}
      eyebrow={step.kind === 'how' ? 'send ahead · how it works' : 'send ahead'}
      title={title}
      locked={step.kind === 'proving'}
      data-testid="send-ahead-dialog"
    >
      {error && step.kind === 'form' && (
        <Alert variant="bad" data-testid="send-ahead-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {(step.kind === 'form' || step.kind === 'how') && (
        // The form stays mounted under "How it works": its draft comes back untouched on Back.
        <div className={step.kind === 'form' ? 'contents' : 'hidden'}>
          <Form
            balance={balance}
            next={next}
            onSend={(a, d) => void send(a, d)}
            onHow={(display) => setStep({ kind: 'how', display })}
          />
        </div>
      )}
      {step.kind === 'how' && <How next={next} onBack={() => setStep({ kind: 'form' })} />}
      {step.kind === 'proving' && <Proving next={next} since={step.since} />}
      {step.kind === 'sent' && <Sent session={session} next={next} crossing={step.crossing} onDone={close} />}
    </TxDialog>
  );
}

/** Send ahead, one run per opening. */
export function SendAheadDialog(props: ComponentProps<typeof SendAheadRun>) {
  return <SendAheadRun key={useOpening(props.open)} {...props} />;
}
