import { act, cleanup, render } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PipHost } from './features/PipHost';
import { openPip, type PipApi, pipWindowAtom } from './pip';
import { epochAtom } from './state';

// The strip is a canvas, tested in `ui`.
vi.mock('@yacana/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yacana/ui')>()),
  ScoreLoop: () => null,
}));

beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);
afterEach(cleanup);

/** Another document to render into, standing in for the Picture-in-Picture window. */
function frame(): Window {
  const f = document.createElement('iframe');
  document.body.append(f);
  return f.contentWindow as Window;
}

describe('PipHost', () => {
  test('renders into the window the atom holds, and its pagehide clears the atom and the body', () => {
    const store = createStore();
    store.set(epochAtom, { epoch: 57n, seed: 7n, target: 1n << 122n, openedAt: 0n, claims: 1 });
    render(
      <Provider store={store}>
        <PipHost controller={() => undefined} onStart={() => {}} />
      </Provider>,
    );
    const pip = frame();
    act(() => store.set(pipWindowAtom, pip));
    const footer = pip.document.querySelector('[data-testid=pip-footer]');
    expect(footer?.children).toHaveLength(2);
    expect(footer?.children[1]?.textContent).toBe('epoch 57 · 1 of 4 wins · difficulty 64.0');
    act(() => {
      pip.dispatchEvent(new Event('pagehide'));
    });
    expect(store.get(pipWindowAtom)).toBeNull();
    expect(pip.document.body.children).toHaveLength(0);
  });
});

describe('openPip', () => {
  const host = (requestWindow: PipApi['requestWindow'], isActive = true) =>
    ({
      documentPictureInPicture: { requestWindow },
      navigator: { userActivation: { isActive } },
      document,
    }) as unknown as Window;

  test('one window: a second call while the first is pending gets the same promise, then the open window', async () => {
    const store = createStore();
    const pip = frame();
    const requestWindow = vi.fn(async () => pip);
    const w = host(requestWindow);
    const first = openPip(store, w);
    expect(openPip(store, w)).toBe(first);
    expect(await first).toBe(pip);
    expect(store.get(pipWindowAtom)).toBe(pip);
    expect(await openPip(store, w)).toBe(pip);
    expect(requestWindow).toHaveBeenCalledTimes(1);
  });

  test('outside a user activation nothing is asked; a refusal resolves to null and leaves no window', async () => {
    const store = createStore();
    const requestWindow = vi.fn(() => Promise.reject(new DOMException('no', 'NotAllowedError')));
    expect(await openPip(store, host(requestWindow, false))).toBeNull();
    expect(requestWindow).not.toHaveBeenCalled();
    expect(await openPip(store, host(requestWindow))).toBeNull();
    expect(store.get(pipWindowAtom)).toBeNull();
    // The refused request is not left pending: the next click asks again.
    await openPip(store, host(requestWindow));
    expect(requestWindow).toHaveBeenCalledTimes(2);
  });
});
