import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button, Preflight, Tile } from '../../../ui/src/index.ts';
import { keysAllowed } from '../host';
import type { MasterRecord } from '../keys/store';
import { shortAddress } from '../lib/format';
import type { Session } from '../session';
import { bootAtom } from '../state';
import { WordsBackup, WordsRestore } from './WordsScreens';

function Fingerprint() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden className="shrink-0 text-uv-2">
      <title>passkey</title>
      <path
        d="M20 6c-7.7 0-14 6.3-14 14M9 20c0-6.1 4.9-11 11-11s11 4.9 11 11v3M13 20a7 7 0 0 1 14 0v6M17 20a3 3 0 0 1 6 0v9M20 20v14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Words = { mode: 'none' } | { mode: 'create'; phrase: string } | { mode: 'restore' };

/** One card, one consent, one button; the twelve words are a small link under it. */
function CreateKey({ session, error }: { session: Session; error?: string }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState<Words>({ mode: 'none' });
  const allowed = keysAllowed(location.hostname);
  const go = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };
  if (words.mode === 'create')
    return (
      <WordsBackup
        phrase={words.phrase}
        error={error}
        onDone={() => session.createWithWords(words.phrase, true)}
        onSkip={() => session.createWithWords(words.phrase, false)}
      />
    );
  if (words.mode === 'restore')
    return (
      <WordsRestore
        error={error}
        onOpen={(phrase) => session.restoreWithWords(phrase)}
        onBack={() => setWords({ mode: 'none' })}
      />
    );
  return (
    <div className="flex flex-col gap-5" data-testid="key-screen">
      <div>
        <h1 className="text-2xl">Create your key.</h1>
        <p className="mt-2 text-ink-2">
          A passkey signs you in with Face ID, Touch ID, Windows Hello or your device PIN. There's nothing to
          write down.
        </p>
      </div>
      {error && (
        <Alert variant="bad" data-testid="key-error">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4 rounded-lg border border-uv/55 bg-uv-dim p-5">
        <div className="flex items-start gap-4">
          <Fingerprint />
          <div>
            <h3 className="text-lg">Passkey</h3>
            <p className="text-sm text-ink-2">
              Your key is derived from the passkey and never leaves this device. It follows your passkeys to
              your other devices.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            data-testid="consent"
            className="mt-1 accent-uv"
          />
          I understand my passkey is the only way back into this key. There is no backup of a passkey key.
        </label>
        <Button
          variant="uv"
          size="lg"
          disabled={!consent || busy || !allowed}
          onClick={() => go(() => session.createWithPasskey())}
          data-testid="create-passkey"
        >
          {busy ? 'Waiting for your device…' : 'Create with passkey'}
        </Button>
        <p className="text-xs text-warn">
          Keep the passkey synced. If it isn't synced and you lose this device, the key and its balance can't
          be recovered.
        </p>
      </div>
      <div className="flex gap-5 text-sm">
        <Button
          variant="link"
          disabled={busy || !allowed}
          onClick={() => setWords({ mode: 'create', phrase: session.newWords() })}
          data-testid="use-words"
        >
          Use twelve words instead
        </Button>
        <Button
          variant="link"
          disabled={busy || !allowed}
          onClick={() => go(() => session.restoreWithPasskey())}
          data-testid="restore-passkey"
        >
          I already have a key
        </Button>
      </div>
      <p className="text-xs text-ink-2">
        This key is not an address to share: whoever knows it can link its first claim to it.
      </p>
    </div>
  );
}

const howToOpen = (r: MasterRecord): string => {
  if (r.sealed) return 'stays open on this device';
  return r.method === 'passkey' ? 'one touch to open' : 'words to open';
};

function KnownKey({ record, busy, onOpen }: { record: MasterRecord; busy: boolean; onOpen: () => void }) {
  return (
    <Tile className="flex items-center justify-between gap-4">
      <div>
        <div className="font-mono text-sm" data-testid="key-address">
          {shortAddress(record.account.address)}
        </div>
        <div className="text-xs text-ink-2">
          {record.method === 'passkey' ? 'passkey' : 'twelve words'} · {howToOpen(record)}
        </div>
      </div>
      <Button variant="uv" disabled={busy} onClick={onOpen} data-testid="open-key">
        {busy ? 'Opening…' : record.method === 'passkey' && !record.sealed ? 'Open with passkey' : 'Open'}
      </Button>
    </Tile>
  );
}

function WelcomeBack({
  session,
  records,
  error,
}: {
  session: Session;
  records: MasterRecord[];
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState(false);
  const [create, setCreate] = useState(false);
  if (create) return <CreateKey session={session} error={error} />;
  const open = (r: MasterRecord) => {
    setBusy(true);
    void session.open(r).finally(() => setBusy(false));
  };
  if (restore)
    return (
      <WordsRestore
        error={error}
        onOpen={(phrase) => session.restoreWithWords(phrase)}
        onBack={() => setRestore(false)}
      />
    );
  return (
    <div className="flex flex-col gap-5" data-testid="key-screen">
      <div>
        <h1 className="text-2xl">Welcome back.</h1>
        <p className="mt-2 text-ink-2">Your balance follows the key, not the browser.</p>
      </div>
      {error && (
        <Alert variant="bad" data-testid="key-error">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {records.map((r) => (
        <KnownKey key={r.id} record={r} busy={busy} onOpen={() => open(r)} />
      ))}
      <div className="flex gap-5 text-sm">
        <Button variant="link" disabled={busy} onClick={() => void session.restoreWithPasskey()}>
          Use another passkey
        </Button>
        <Button variant="link" disabled={busy} onClick={() => setRestore(true)} data-testid="restore-words">
          Enter twelve words instead
        </Button>
        <Button variant="link" disabled={busy} onClick={() => setCreate(true)} data-testid="create-new-key">
          Create a new key
        </Button>
      </div>
    </div>
  );
}

export function KeyScreen({ session }: { session: Session }) {
  const boot = useAtomValue(bootAtom);
  if (boot.phase === 'preflight')
    return (
      <Tile>
        <h2 className="label-mono mb-3">preflight</h2>
        <Preflight rows={boot.rows} />
        <p className="mt-4 text-xs text-ink-2">
          First visit downloads 20 MB of proving keys once and checks them against the pinned hashes. Whoever
          serves this page controls it: run your own build if that matters.
        </p>
      </Tile>
    );
  if (boot.phase === 'opening')
    return (
      <Tile>
        <p className="text-sm text-ink-2" data-testid="boot-step">
          {boot.step}…
        </p>
      </Tile>
    );
  if (boot.phase !== 'key') return null;
  return boot.records.length ? (
    <WelcomeBack session={session} records={boot.records} error={boot.error} />
  ) : (
    <CreateKey session={session} error={boot.error} />
  );
}
