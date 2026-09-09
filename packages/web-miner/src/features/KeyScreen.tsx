import { useState } from 'react';
import { keysAllowed } from '../../../site/src/browser/host.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ExternalLink,
  Preflight,
  type PreflightRow,
  Tile,
} from '../../../ui/src/index.ts';
import { links } from '../explorer';
import type { MasterRecord } from '../keys/store';
import { shortAddress } from '../lib/format';
import type { Session } from '../session';
import { WordsBackup, WordsRestore } from './WordsScreens';

type Words = { mode: 'none' } | { mode: 'create'; phrase: string } | { mode: 'restore' };

/** The dialog's way out without an account: the cockpit stays, dull, with a way back in. */
const NotNow = ({ onNotNow }: { onNotNow?: () => void }) =>
  onNotNow ? (
    <Button variant="link" className="ml-auto text-ink-3" onClick={onNotNow} data-testid="not-now">
      Not now — just watch
    </Button>
  ) : null;

const HOST_WARNING = 'Whoever serves this page controls it: run your own build if that matters.';

/** One card, one consent, one button; the other ways in are small links under it. */
export function CreateKey({
  session,
  error,
  onNotNow,
}: {
  session: Session;
  error?: string;
  onNotNow?: () => void;
}) {
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
        <span className="label-mono">mine</span>
        <h2 className="mt-1 text-[24px] leading-tight">Sign in to mine.</h2>
        <p className="mt-2 text-ink-2">
          Your account lives in a passkey on this device, synced by your platform. Your balance follows the
          account, not the browser; nothing is written down.
        </p>
      </div>
      {error && (
        <Alert variant="bad" data-testid="key-error">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            data-testid="consent"
            className="mt-1 accent-uv"
          />
          I understand my passkey is the only way back into this account. There is no backup of a passkey.
        </label>
        <Button
          variant="uv"
          size="lg"
          disabled={!consent || busy || !allowed}
          onClick={() => go(() => session.createWithPasskey())}
          data-testid="create-passkey"
        >
          {busy ? 'Waiting for your device…' : 'Sign up with a passkey'}
        </Button>
        <p className="text-xs text-warn">
          Keep the passkey synced. Lose every copy of the passkey and the account and its balance are lost
          with it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
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
          I already have a passkey
        </Button>
        <Button
          variant="link"
          disabled={busy || !allowed}
          onClick={() => setWords({ mode: 'restore' })}
          data-testid="restore-words"
        >
          I have twelve words
        </Button>
        <NotNow onNotNow={onNotNow} />
      </div>
      <p className="text-xs text-ink-3">
        This account is not an address to share: whoever knows it can link its first claim to it.{' '}
        {HOST_WARNING}
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
        <ExternalLink
          href={links.address(record.account.address)}
          full={record.account.address}
          className="text-sm text-ink"
          data-testid="key-address"
        >
          {shortAddress(record.account.address)}
        </ExternalLink>
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

export function WelcomeBack({
  session,
  records,
  error,
  onNotNow,
}: {
  session: Session;
  records: MasterRecord[];
  error?: string;
  onNotNow?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState(false);
  const [create, setCreate] = useState(false);
  if (create) return <CreateKey session={session} error={error} onNotNow={onNotNow} />;
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
        <span className="label-mono">mine</span>
        <h2 className="mt-1 text-[24px] leading-tight">Welcome back.</h2>
        <p className="mt-2 text-ink-2">Your balance follows the account, not the browser.</p>
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Button variant="link" disabled={busy} onClick={() => void session.restoreWithPasskey()}>
          Use another passkey
        </Button>
        <Button variant="link" disabled={busy} onClick={() => setRestore(true)} data-testid="restore-words">
          Enter twelve words instead
        </Button>
        <Button variant="link" disabled={busy} onClick={() => setCreate(true)} data-testid="create-new-key">
          Create a new account
        </Button>
        <NotNow onNotNow={onNotNow} />
      </div>
      <p className="text-xs text-ink-3">{HOST_WARNING}</p>
    </div>
  );
}

/** The preflight's rows while it runs: the cockpit takes over the moment it passes. */
export function PreflightTile({ rows }: { rows: PreflightRow[] }) {
  return (
    <Tile>
      <h2 className="label-mono mb-3">preflight</h2>
      <Preflight rows={rows} />
      <p className="mt-4 text-xs text-ink-2">
        The proving keys (20 MB) download in the background and are checked against their pinned hashes.{' '}
        {HOST_WARNING}
      </p>
    </Tile>
  );
}
