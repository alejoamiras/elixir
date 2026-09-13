// Send ahead: the amount (the whole balance by default) → the review (a burn here, held on Ethereum
// under this passkey's key, landing on the next version as a tap on the arrival card) → sent. No
// switch, no consent line: nothing sends or lands by itself.
import { useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  KvRow,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../ui/src/index.ts';
import { reviewAmount } from '../bridge/forms';
import { amount as fmt } from '../lib/format';
import type { Session } from '../session';

type Step =
  | { kind: 'form' }
  | { kind: 'review'; amount: bigint; display: string }
  | { kind: 'sent'; display: string };

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
      await session.bridge?.sendAhead(amount);
      setStep({ kind: 'sent', display });
    } catch (e) {
      setError(e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
    } finally {
      setBusy(false);
    }
  };
  const version = import.meta.env.VITE_ROLLUP_VERSION;
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent data-testid="send-ahead-sheet">
        <SheetTitle>Send ahead</SheetTitle>
        <SheetDescription>
          From this account's private balance of {fmt(balance, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} on V
          {version}
          to the next version, for this same passkey.
        </SheetDescription>
        {error && (
          <Alert variant="bad" data-testid="send-ahead-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step.kind === 'form' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ahead-amount">Amount</Label>
              <Input
                id="ahead-amount"
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                className="font-mono"
                data-testid="ahead-amount"
              />
              <span className="text-2xs text-ink-3">the whole balance by default</span>
            </div>
            <Button variant="primary" onClick={toReview} data-testid="ahead-review">
              Review
            </Button>
          </div>
        )}
        {step.kind === 'review' && (
          <div className="flex flex-col gap-4">
            <p className="label-mono">send ahead · step 2 of 2</p>
            <div>
              <KvRow label="amount" value={`${step.display} ${PARAMS.TOKEN_SYMBOL}`} />
              <KvRow label="leaves" value={`V${version}, now (a burn, proved in your browser, about 20 s)`} />
              <KvRow
                label="waits"
                value={`on Ethereum, held for this account alone, out of V${version}’s reach`}
              />
              <KvRow
                label="lands"
                value="on the next version: a tap on the arrival card, with this passkey"
              />
            </div>
            <Alert variant="warn" data-testid="ahead-privacy">
              <AlertTitle>The amount is public on Ethereum.</AlertTitle>
              <AlertDescription>
                Ethereum sees the amount and when it crossed, not who: the send is held under a one-time
                secret of this account. Anyone matching amounts and times across the two sides could still
                link them.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button
                variant="uv"
                disabled={busy}
                onClick={() => void send(step.amount, step.display)}
                data-testid="ahead-send"
              >
                {busy ? 'Proving and sending…' : 'Send ahead'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setStep({ kind: 'form' })}>
                Back
              </Button>
            </div>
          </div>
        )}
        {step.kind === 'sent' && (
          <div className="flex flex-col gap-4" data-testid="ahead-sent">
            <p className="text-lg font-semibold">Sent ahead.</p>
            <p className="text-sm text-ink-2">
              {step.display} {PARAMS.TOKEN_SYMBOL} left V{version}. Ethereum learns of it when V{version}{' '}
              proves the epoch; the migration card follows it, and the next version’s arrival card claims it.
            </p>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
