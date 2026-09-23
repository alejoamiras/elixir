import { useStore } from 'jotai';
import { useCallback } from 'react';
import { openPip } from '../pip';
import { settingsAtom } from '../settings';
import { bootAtom, mineIntentAtom, signInAtom } from '../state';

/**
 * What every Start button's click does. Signed in: the mini window first when the setting asks for it
 * (synchronously, while the click's activation lasts), then mining whatever became of the window.
 * Signed out: the intent to mine, the sign-in, and Presto's probe; mining begins after the ceremony,
 * outside the click, so that first Start cannot open the window. The keys and the resume on open call
 * `onStart` directly.
 */
export function useStartClick(onStart: () => void): () => void {
  const store = useStore();
  return useCallback(() => {
    if (store.get(bootAtom).phase !== 'ready') {
      store.set(mineIntentAtom, true);
      store.set(signInAtom, true);
      onStart();
      return;
    }
    if (store.get(settingsAtom).pipOnStart) void openPip(store);
    onStart();
  }, [store, onStart]);
}
