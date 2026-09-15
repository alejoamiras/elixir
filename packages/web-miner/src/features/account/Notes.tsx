// The notes of the account dialog: the passkey warning, the old origin's, and one per way an
// opening fails — a line on what happened, a line on what to do; the button stays.
import { Note } from '../../../../ui/src/index.ts';
import type { AccountError } from '../../state';

export const PasskeyNote = () => (
  <Note tone="warn" title="Your passkey is the only key.">
    Keep it in a password manager that syncs (iCloud Keychain, Google Password Manager, 1Password) and it
    opens this account on the devices that manager syncs to. Lose every copy and the account is lost; Yacana
    can't recover it.
  </Note>
);

export const OldOriginNote = () => (
  <Note tone="uv" title="Accounts are restored here, not created." data-testid="host-note">
    The passkey or 12 words from {import.meta.env.VITE_RP_ID} open it.
  </Note>
);

/** Where the attempt began: the same failure reads differently on a create, a log in and an open. */
export type NoteContext = 'create' | 'login' | 'open';

interface Copy {
  title: string;
  body: string;
  tone: 'bad' | 'warn';
  /** What the primary reads under this note; the screen's own label when absent. */
  primary?: string;
}

const DISMISSED: Copy = {
  title: "That didn't work.",
  body: 'The passkey prompt was dismissed or timed out. Try again, or use 12 words.',
  tone: 'bad',
};
const NO_WEBAUTHN: Copy = {
  title: 'This browser has no passkeys.',
  body: 'Use a current Chrome, Safari, Edge or Firefox; or use 12 words.',
  tone: 'bad',
  primary: 'Use 12 words',
};

/** The drawn notes by failure and context; anything else keeps the failure's own sentence. */
export function noteFor(error: AccountError, context: NoteContext): Copy {
  switch (error.kind) {
    case 'dismissed':
      return context === 'login'
        ? {
            title: "Sign-in didn't complete.",
            body: 'No passkey was used. If this device has none for Yacana, log in where you created it, or enter your 12 words.',
            tone: 'bad',
          }
        : DISMISSED;
    case 'no-prf':
      return context === 'create'
        ? {
            title: "This device can't make a Yacana passkey.",
            body: "Its passkeys can't derive a key. Use 12 words instead; they work everywhere.",
            tone: 'bad',
            primary: 'Use 12 words',
          }
        : {
            title: "This device can't open your passkey.",
            body: "Its passkeys can't derive the key. Open the account on the device or browser where it works; the balance is unchanged.",
            tone: 'bad',
            primary: 'Try again',
          };
    case 'no-webauthn':
      return NO_WEBAUTHN;
    case 'held-tab':
      return {
        title: 'Another tab has this account open.',
        body: 'Close that tab, then retry here.',
        tone: 'warn',
        primary: 'Retry',
      };
    default:
      return { title: "That didn't work.", body: error.message, tone: 'bad' };
  }
}

export function AccountNote({ error, context }: { error: AccountError; context: NoteContext }) {
  const c = noteFor(error, context);
  return (
    <Note tone={c.tone} title={c.title} data-testid="key-error" data-kind={error.kind}>
      {c.body}
    </Note>
  );
}
