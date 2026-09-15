import { Icon } from '../../../../ui/src/index.ts';
import type { AccountError } from '../../state';
import { AccountNote, noteFor, OldOriginNote } from './Notes';
import { Primary, Quiet, QuietRow, Screen } from './Screen';

/** Log in on a device that holds no account: a discoverable passkey, or the words. */
export function LogIn({
  error,
  busy,
  oldOrigin,
  onPasskey,
  onWords,
  onBack,
}: {
  error?: AccountError;
  busy: boolean;
  /** The versioned origin restores and never creates: the note says so, and there is no Start to go back to. */
  oldOrigin: boolean;
  onPasskey: () => void;
  onWords: () => void;
  onBack?: () => void;
}) {
  const primary = error && noteFor(error, 'login').primary;
  return (
    <Screen
      eyebrow="log in"
      title="Welcome back."
      body="Log in with the passkey you created, or your 12 words."
      onBack={onBack}
    >
      {oldOrigin && <OldOriginNote />}
      {error && <AccountNote error={error} context="login" />}
      {primary === 'Use 12 words' ? (
        <Primary onClick={onWords} data-testid="restore-words">
          Use 12 words
        </Primary>
      ) : (
        <>
          <Primary disabled={busy} onClick={onPasskey} data-testid="restore-passkey">
            <Icon name="finger" size={15} />
            {busy ? 'Logging in…' : (primary ?? 'Continue with passkey')}
          </Primary>
          {error?.kind !== 'no-prf' && (
            <QuietRow>
              <Quiet disabled={busy} onClick={onWords} data-testid="restore-words">
                Use 12 words instead
              </Quiet>
            </QuietRow>
          )}
        </>
      )}
    </Screen>
  );
}
