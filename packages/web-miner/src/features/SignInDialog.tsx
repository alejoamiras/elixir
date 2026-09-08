import { useAtom, useAtomValue } from 'jotai';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/src/index.ts';
import type { Session } from '../session';
import { bootAtom, signInAtom } from '../state';
import { CreateKey, WelcomeBack } from './KeyScreen';

/**
 * The sign-in over the dull cockpit. Signed out, Escape, the veil and "Not now" are one action:
 * dismiss (either sign-in button on the cockpit reopens it). Opening, nothing dismisses it — a click
 * on the veil must not abort an account open — and it closes when the account is ready.
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
          <Opening step={boot.step} />
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

/** The step while the account comes up; the bar and the step list come with the opening's own work. */
function Opening({ step }: { step: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-mono">opening your account</span>
      <p className="text-sm text-ink-2" data-testid="boot-step">
        {step}…
      </p>
    </div>
  );
}
