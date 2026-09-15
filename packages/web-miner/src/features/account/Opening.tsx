import { useAtomValue } from 'jotai';
import { loadConnection } from '../../../../site/src/browser/connection.ts';
import { Button, Note, Progress, Stepper } from '../../../../ui/src/index.ts';
import {
  barShown,
  bytesDetail,
  elapsed,
  type OpeningStep,
  progressOf,
  type StepId,
} from '../../opening-steps';
import { useSettings } from '../../settings';
import { type AccountError, mineIntentAtom, nowAtom } from '../../state';
import { Screen } from './Screen';

/** The right column: the bytes while they land, the elapsed time where no count is known, the reason when failed. */
const rightOf = (s: OpeningStep, now: number): string | undefined => {
  if (s.state === 'failed') return s.reason;
  if (s.state !== 'active') return s.id === 'crs' && s.state === 'done' ? 'first time only' : undefined;
  if (s.id === 'crs') return s.bytes && s.bytes.total > 0 ? bytesDetail(s.bytes) : 'first time only';
  if (s.id === 'notes' && s.since !== undefined) return elapsed(s.since, now);
  return undefined;
};

const shown = (s: OpeningStep, now: number): OpeningStep => ({
  ...s,
  detail: undefined,
  ms: undefined,
  right: rightOf(s, now),
});

const SUB: Partial<Record<StepId, string>> = {
  crs: 'Kept on this device; next time this step is skipped.',
  notes: 'Reading your notes from the chain. Usually under a minute; the first time takes longer.',
};

function Checklist({ steps }: { steps: OpeningStep[] }) {
  const now = useAtomValue(nowAtom);
  const active = steps.find((s) => s.state === 'active');
  return (
    <>
      <Stepper steps={steps.map((s) => shown(s, now))} data-testid="opening-steps" />
      {barShown(steps) && <Progress value={progressOf(steps)} data-testid="opening-bar" />}
      {active && SUB[active.id] && <p className="text-sm text-ink-3">{SUB[active.id]}</p>}
    </>
  );
}

/** The opening body: the checklist, the bar under the keys step, and Cancel once the ceremony is over. */
export function Opening({ steps, onCancel }: { steps: OpeningStep[]; onCancel: () => void }) {
  const [settings] = useSettings();
  const intent = useAtomValue(mineIntentAtom);
  // The first step done means the ceremony (its OS prompt) is over: Cancel is safe from here.
  const canCancel = steps.find((s) => s.id === 'key')?.state === 'done';
  const starts = intent || settings.resumeOnOpen;
  return (
    <Screen eyebrow="account" title="Opening your account." data-testid="opening">
      <Checklist steps={steps} />
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3.5">
        <span className="text-xs text-ink-3">
          {starts ? 'Mining starts when this finishes.' : 'You can start mining when this finishes.'} Cancel
          keeps you watching the chain.
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canCancel}
          onClick={onCancel}
          data-testid="opening-cancel"
        >
          Cancel
        </Button>
      </div>
    </Screen>
  );
}

interface FailedCopy {
  title: string;
  body: string;
  tone: 'bad' | 'warn';
  changeNode?: boolean;
}

/** The node in use, by host; the setting as typed when it is not a URL. */
const nodeHost = (): string => {
  const url = loadConnection().nodeUrl;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const failedCopy = (error: AccountError, steps: OpeningStep[]): FailedCopy => {
  const failed = steps.find((s) => s.state === 'failed');
  if (failed?.id === 'crs') {
    const at = failed.bytes && failed.bytes.total > 0 ? ` at ${bytesDetail(failed.bytes)}` : '';
    return {
      title: "The miner's files didn't download.",
      body: `The connection dropped${at}. Retry keeps what arrived.`,
      tone: 'bad',
    };
  }
  if (error.kind === 'held-tab')
    return {
      title: 'Another tab has this account open.',
      body: 'Close that tab, then retry here.',
      tone: 'warn',
    };
  if (error.kind === 'node')
    return {
      title: "The Aztec node isn't answering.",
      body: `${nodeHost()} stopped answering, or is rate-limiting this page. Retry, or use another node.`,
      tone: 'bad',
      changeNode: true,
    };
  return { title: "That didn't work.", body: error.message, tone: 'bad' };
};

/** A step failed after the ceremony: the checklist stays, with the reason, a note and the ways on. */
export function OpeningFailed({
  steps,
  error,
  onRetry,
  onChangeNode,
  onCancel,
}: {
  steps: OpeningStep[];
  error: AccountError;
  onRetry: () => void;
  onChangeNode: () => void;
  onCancel: () => void;
}) {
  const c = failedCopy(error, steps);
  return (
    <Screen eyebrow="account" title="Opening your account." data-testid="opening-failed">
      <Checklist steps={steps} />
      <Note tone={c.tone} title={c.title} data-testid="key-error" data-kind={error.kind}>
        {c.body}
      </Note>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="uv" onClick={onRetry} data-testid="opening-retry">
          Retry
        </Button>
        {c.changeNode && (
          <Button variant="ghost" onClick={onChangeNode} data-testid="opening-change-node">
            Change node
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel} data-testid="opening-cancel">
          Cancel
        </Button>
      </div>
    </Screen>
  );
}
