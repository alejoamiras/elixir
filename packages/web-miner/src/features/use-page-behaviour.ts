// What the page does on its own: keyboard, the battery and hidden-tab pauses, resume on open.
import { useAtomValue, useStore } from 'jotai';
import { useEffect } from 'react';
import { clampThreads } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { prestoAtom } from '../presto';
import { navigate } from '../routes';
import { type Settings, settingsAtom } from '../settings';
import { bootAtom, minerAtom } from '../state';

type Battery = {
  charging: boolean;
  addEventListener(t: 'chargingchange', l: () => void): void;
  removeEventListener(t: 'chargingchange', l: () => void): void;
};

/** A focused control keeps its own keys: Space on a button is that button's click, not the page's Start. */
const interactive = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable ||
    t.closest('input, textarea, select, button, a, [role="button"], [contenteditable]') !== null);

/** Space is the Start button's own action (`onStart`: it also re-asks Presto), Stop when mining. */
export function useHotkeys(
  controller: () => MinerController | undefined,
  onStart: () => void,
  enabled = true,
) {
  const store = useStore();
  useEffect(() => {
    // Off while the sign-in dialog shows: its own keys (Escape, Enter) must not reach the page.
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || interactive(e.target))
        return;
      const c = controller();
      const miner = store.get(minerAtom);
      const settings = store.get(settingsAtom);
      const cores = navigator.hardwareConcurrency || 2;
      const threads = settings.threads ?? Math.max(1, cores - 1);
      const power = (delta: number) => {
        // Under native proving the slider is disabled: Presto's Speed setting governs, not the page's threads.
        if (store.get(prestoAtom).active === 'presto') return;
        const next = clampThreads(threads + delta, cores);
        store.set(settingsAtom, { threads: next });
        c?.reconfigure(next);
      };
      switch (e.key) {
        case ' ':
          e.preventDefault();
          miner.phase === 'mining' ? c?.stop() : onStart();
          return;
        case '[':
          return power(-1);
        case ']':
          return power(1);
        case 'w':
          return navigate('wallet');
        case ',':
          return navigate('settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, onStart, store, enabled]);
}

/** Battery and hidden-tab pauses; both clear by themselves. */
export function usePauses(controller: () => MinerController | undefined, settings: Settings) {
  useEffect(() => {
    if (settings.backgroundProving) {
      controller()?.release('hidden');
      return;
    }
    const onVisibility = () =>
      document.hidden ? controller()?.pause('hidden') : controller()?.release('hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [controller, settings.backgroundProving]);

  useEffect(() => {
    const getBattery = (navigator as { getBattery?: () => Promise<Battery> }).getBattery;
    if (!settings.pauseOnBattery || !getBattery) {
      controller()?.release('battery');
      return;
    }
    let battery: Battery | undefined;
    const apply = () =>
      battery?.charging === false ? controller()?.pause('battery') : controller()?.release('battery');
    void getBattery.call(navigator).then((b) => {
      battery = b;
      apply();
      b.addEventListener('chargingchange', apply);
    });
    return () => battery?.removeEventListener('chargingchange', apply);
  }, [controller, settings.pauseOnBattery]);
}

/** After the first Start the page may resume by itself; never on a first visit. */
export function useResumeOnOpen(controller: () => MinerController | undefined) {
  const boot = useAtomValue(bootAtom);
  const store = useStore();
  useEffect(() => {
    if (boot.phase !== 'ready' || !store.get(settingsAtom).resumeOnOpen) return;
    controller()?.start();
  }, [boot.phase, controller, store]);
}
