// The journal as a file the holder keeps: the Wallet's download, and the send-ahead's once it sent.
import type { Session } from '../session';

/** Downloads the recovery file; the note says how many crossings it holds. */
export async function saveRecoveryFile(session: Session, account: string): Promise<string> {
  const file = await session.bridge?.exportRecovery();
  if (!file) return 'nothing to save';
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yacana-bridge-${file.chainId}-${account.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  return `${file.crossings.length} crossings saved`;
}
