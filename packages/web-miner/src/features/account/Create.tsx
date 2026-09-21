import { Icon } from '@yacana/ui';
import { useState } from 'react';
import type { AccountError } from '../../state';
import { AccountNote, noteFor, PasskeyNote } from './Notes';
import { Consent, Primary, Quiet, QuietRow, Screen } from './Screen';

/** Consent, then the passkey; the words one link away, or the primary when a passkey cannot work here. */
export function Create({
  error,
  busy,
  onPasskey,
  onWords,
  onBack,
}: {
  error?: AccountError;
  busy: boolean;
  onPasskey: () => void;
  onWords: () => void;
  onBack: () => void;
}) {
  // A failed attempt keeps the consent ticked: the retry is one tap.
  const [consent, setConsent] = useState(error !== undefined);
  const wordsOnly = error !== undefined && noteFor(error, 'create').primary === 'Use 12 words';
  return (
    <Screen
      eyebrow="create account"
      title="Create your account."
      body="A passkey signs you in with your face, fingerprint or device PIN. Nothing to write down."
      onBack={onBack}
    >
      <PasskeyNote />
      <Consent checked={consent} onChange={setConsent} testId="consent">
        I understand my passkey is the only way into this account.
      </Consent>
      {error && <AccountNote error={error} context="create" />}
      {wordsOnly ? (
        <Primary onClick={onWords} data-testid="use-words">
          Use 12 words
        </Primary>
      ) : (
        <>
          <Primary disabled={!consent || busy} onClick={onPasskey} data-testid="create-passkey">
            <Icon name="finger" size={15} />
            Continue with passkey
          </Primary>
          <QuietRow>
            <Quiet disabled={busy} onClick={onWords} data-testid="use-words">
              Use 12 words instead
            </Quiet>
          </QuietRow>
        </>
      )}
    </Screen>
  );
}
