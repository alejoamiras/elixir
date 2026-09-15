import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { keysAllowed } from '../../../site/src/browser/host.ts';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/src/index.ts';
import type { MasterRecord } from '../keys/store';
import type { Session } from '../session';
import { type AccountError, type Boot, bootAtom, signInAtom } from '../state';
import { Create } from './account/Create';
import { LogIn } from './account/LogIn';
import { Opening } from './account/Opening';
import { Start } from './account/Start';
import { Welcome } from './account/Welcome';
import { WordsBackup } from './account/Words';
import { WordsLogIn } from './account/WordsLogIn';
import { SignOutDialog } from './SignOutDialog';

type Screen = 'start' | 'create' | 'login' | 'words' | 'words-login' | 'welcome';

interface Flow {
  session: Session;
  error?: AccountError;
  busy: boolean;
  canCreate: boolean;
  go: (s: Screen) => void;
  attempt: (from: Screen, run: () => Promise<void>) => void;
  notNow: () => void;
}

/** Welcome, with "Use a different account" as the sign-out dialog over it. */
function Stored({ record, flow }: { record: MasterRecord; flow: Flow }) {
  const [other, setOther] = useState(false);
  return (
    <>
      <Welcome
        record={record}
        error={flow.error}
        busy={flow.busy}
        onOpen={() => flow.attempt('welcome', () => flow.session.open(record))}
        onNotNow={flow.notNow}
        onOther={() => setOther(true)}
      />
      <SignOutDialog
        record={record}
        open={other}
        onOpenChange={setOther}
        onSignOut={() => flow.session.forget(record)}
        onBackUp={() => {
          setOther(false);
          flow.attempt('welcome', () => flow.session.open(record));
        }}
      />
    </>
  );
}

function Screens({ current, flow }: { current: Screen; flow: Flow }) {
  const { session, error, busy, canCreate, go, attempt, notNow } = flow;
  const [phrase, setPhrase] = useState('');
  switch (current) {
    case 'create':
      return (
        <Create
          error={error}
          busy={busy}
          onPasskey={() => attempt('create', () => session.createWithPasskey())}
          onWords={() => {
            setPhrase(session.newWords());
            go('words');
          }}
          onBack={() => go('start')}
        />
      );
    case 'login':
      return (
        <LogIn
          error={error}
          busy={busy}
          oldOrigin={!canCreate}
          onPasskey={() => attempt('login', () => session.restoreWithPasskey())}
          onWords={() => go('words-login')}
          onBack={canCreate ? () => go('start') : undefined}
        />
      );
    case 'words':
      return (
        <WordsBackup
          phrase={phrase}
          error={error}
          onDone={() => session.createWithWords(phrase, true)}
          onSkip={() => session.createWithWords(phrase, false)}
          onBack={() => go('create')}
        />
      );
    case 'words-login':
      return (
        <WordsLogIn
          error={error}
          busy={busy}
          onOpen={(text) => attempt('words-login', () => session.restoreWithWords(text))}
          onBack={() => go('login')}
        />
      );
    default:
      return <Start onCreate={() => go('create')} onLogIn={() => go('login')} onNotNow={notNow} />;
  }
}

/** A device with an account gets Welcome whatever screen was open; without one, the screen chosen, else the first. */
const screenFor = (stored: MasterRecord | null, chosen: Screen | null, canCreate: boolean): Screen =>
  stored ? 'welcome' : (chosen ?? (canCreate ? 'start' : 'login'));

/** The note belongs to the screen whose attempt failed; Welcome also shows a create's that staged its record. */
const errorFor = (boot: Boot, errorOn: Screen | null, current: Screen): AccountError | undefined =>
  boot.phase === 'signedOut' && (errorOn === current || current === 'welcome') ? boot.error : undefined;

/**
 * The account dialog over the cockpit. Signed out, Escape, the veil and "Just watch for now" are one
 * action: dismiss (the cockpit's buttons reopen it). A device with an account gets Welcome, whatever
 * screen was open: a create that staged its record and failed is finished from there, never
 * repeated. Opening, nothing dismisses it — a click on the veil must not abort an account open —
 * and it closes when the account is ready. Cancel inside it aborts once the ceremony is over.
 */
export function SignInDialog({ session }: { session: Session }) {
  const boot = useAtomValue(bootAtom);
  const [wanted, setWanted] = useAtom(signInAtom);
  const opening = boot.phase === 'opening';
  const signedOut = boot.phase === 'signedOut';
  const open = opening || (signedOut && wanted);
  const [screen, setScreen] = useState<Screen | null>(null);
  /** The screen whose attempt failed: its note stays there and nowhere else. */
  const [errorOn, setErrorOn] = useState<Screen | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) return;
    setScreen(null);
    setErrorOn(null);
  }, [open]);
  const canCreate = keysAllowed(location.hostname, 'create');
  const stored = signedOut ? (boot.slot.record ?? boot.slot.staged) : null;
  const current = screenFor(stored, screen, canCreate);
  const flow: Flow = {
    session,
    error: errorFor(boot, errorOn, current),
    busy,
    canCreate,
    go: (s) => {
      setScreen(s);
      setErrorOn(null);
    },
    attempt: (from, run) => {
      setErrorOn(from);
      setBusy(true);
      void run().finally(() => setBusy(false));
    },
    notNow: () => setWanted(false),
  };
  const dismiss = (e: Event) => (opening ? e.preventDefault() : setWanted(false));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !opening && setWanted(false)}>
      <DialogContent
        hideClose
        size="tx"
        overlayClassName="bg-[rgba(10,10,11,.42)]"
        className="top-[clamp(24px,20vh,180px)] max-h-[calc(100vh_-_clamp(24px,20vh,180px)_-_24px)] translate-y-0 overflow-y-auto shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onEscapeKeyDown={dismiss}
        onInteractOutside={dismiss}
        aria-describedby={undefined}
        data-testid="sign-in"
      >
        <DialogTitle className="sr-only">{opening ? 'Opening your account' : 'Account'}</DialogTitle>
        {opening ? (
          <Opening steps={boot.steps} onCancel={() => void session.cancelOpening()} />
        ) : !signedOut ? null : stored ? (
          <Stored record={stored} flow={flow} />
        ) : (
          <Screens current={current} flow={flow} />
        )}
      </DialogContent>
    </Dialog>
  );
}
