import { useAtom, useAtomValue } from 'jotai';
import { Button, Dialog, DialogContent, DialogTitle, Progress, Stepper } from '../../../ui/src/index.ts';
import {
  bytesDetail,
  NOTES_SPAN,
  type OpeningStep,
  openingIndeterminate,
  progressOf,
} from '../opening-steps';
import type { Session } from '../session';
import { useSettings } from '../settings';
import { bootAtom, signInAtom } from '../state';
import { CreateKey, WelcomeBack } from './KeyScreen';

/**
 * The sign-in over the dull cockpit. Signed out, Escape, the veil and "Not now" are one action:
 * dismiss (either sign-in button on the cockpit reopens it). Opening, nothing dismisses it — a click
 * on the veil must not abort an account open — and it closes when the account is ready. Cancel inside
 * it aborts once the ceremony is over.
 */
export function SignInDialog({ session }: { session: Session }) {
  const boot = useAtomValue(bootAtom);
  const [wanted, setWanted] = useAtom(signInAtom);
  const opening = boot.phase === 'opening';
  const open = opening || (boot.phase === 'signedOut' && wanted);
  const dismiss = (e: Event) => {
    if (opening) e.preventDefault();
    else setWanted(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !opening && setWanted(false)}>
      <DialogContent
        hideClose
        overlayClassName="bg-[rgba(10,10,11,.42)]"
        className="top-[clamp(24px,20vh,180px)] max-h-[calc(100vh_-_clamp(24px,20vh,180px)_-_24px)] w-[480px] max-w-[calc(100vw_-_32px)] translate-y-0 gap-4 overflow-y-auto rounded-[10px] px-[26px] pt-[26px] pb-[22px] shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onEscapeKeyDown={dismiss}
        onInteractOutside={dismiss}
        aria-describedby={undefined}
        data-testid="sign-in"
      >
        <DialogTitle className="sr-only">{opening ? 'Opening your account' : 'Sign in to mine'}</DialogTitle>
        {opening ? (
          <Opening steps={boot.steps} onCancel={() => void session.cancelOpening()} />
        ) : boot.phase !== 'signedOut' ? null : boot.records.length ? (
          <WelcomeBack
            session={session}
            records={boot.records}
            error={boot.error}
            onNotNow={() => setWanted(false)}
          />
        ) : (
          <CreateKey session={session} error={boot.error} onNotNow={() => setWanted(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A step as the canvas draws it: done ones in `ok` with a ✓, the keys step's bytes in the right column. */
const shown = (s: OpeningStep): OpeningStep => ({
  ...s,
  label: s.state === 'done' ? <span className="text-ok">✓ {s.label}</span> : s.label,
  detail: undefined,
  right: s.state === 'active' && s.bytes ? bytesDetail(s.bytes) : undefined,
});

/** The opening body: the step list, the bar, and Cancel once the ceremony is over. */
function Opening({ steps, onCancel }: { steps: OpeningStep[]; onCancel: () => void }) {
  const [settings] = useSettings();
  // The first step done means the ceremony (its OS prompt) is over: Cancel is safe from here.
  const canCancel = steps.find((s) => s.id === 'key')?.state === 'done';
  const footer = settings.resumeOnOpen
    ? 'Mining resumes when it is done.'
    : 'You can watch the chain behind this; press Start when it is done.';
  return (
    <div className="flex flex-col gap-4" data-testid="opening">
      <div>
        <span className="label-mono">opening your account</span>
        <h2 className="mt-1 text-[24px] leading-tight">A minute the first time.</h2>
        <p className="mt-2 text-sm text-ink-2">
          The proving keys are 20 MB, fetched once and kept. After that, opening takes a few seconds.
        </p>
      </div>
      <Progress
        value={progressOf(steps)}
        indeterminate={openingIndeterminate(steps)}
        indeterminateSpan={NOTES_SPAN}
        data-testid="opening-bar"
      />
      <Stepper steps={steps.map(shown)} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">{footer}</span>
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
    </div>
  );
}
