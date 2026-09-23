import { act, cleanup, render } from '@testing-library/react';
import type { ScoreLoopProps } from '@yacana/ui';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { barCaption, LoopTile, PipView } from './features/LoopTile';
import { initial } from './lib/reducer';
import { epochAtom, minerAtom } from './state';

// The chart itself is drawn on a canvas and tested in `ui`; here it only says what it was given.
const given: ScoreLoopProps[] = [];
vi.mock('@yacana/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yacana/ui')>()),
  ScoreLoop: (props: ScoreLoopProps) => {
    given.push(props);
    return null;
  },
}));

// jsdom has no matchMedia; the tile's tweened numbers read it.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

afterEach(() => {
  cleanup();
  given.length = 0;
});

describe("the claim's band reaches both charts", () => {
  const spans = [{ id: 1, t0: 1_000, t1: null }];
  const store = () => {
    const s = createStore();
    s.set(minerAtom, { ...initial, claimSpans: spans });
    s.set(epochAtom, { epoch: 12n, seed: 7n, target: 1n << 122n, openedAt: 0n, claims: 2 });
    return s;
  };
  const controls = { controller: () => undefined, onStart: () => {} };

  test('the tile names the axis and says what the bar means; the pop-out draws the same spans on its strip', () => {
    render(
      <Provider store={store()}>
        <LoopTile {...controls} />
        <PipView {...controls} win={window} />
      </Provider>,
    );
    const [tile, pip] = given;
    expect(tile?.spans).toBe(spans);
    expect(tile?.axisTitle).toBe('score · log scale');
    expect(tile?.barCaption).toMatch(/^the bar · reach it and you win · about 1 in \d+ do$/);
    expect(pip?.spans).toBe(spans);
    expect(pip?.height).toBe(48);
  });

  test('the pop-out is another document: its tip opens there, not in the opener', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const pip = frame.contentWindow as Window;
    render(
      <Provider store={store()}>
        <PipView {...controls} win={pip} />
      </Provider>,
      { container: pip.document.body.appendChild(pip.document.createElement('div')) },
    );
    const word = pip.document.querySelector('[data-slot=tip-trigger]') as HTMLElement;
    expect(word.textContent).toBe('bar');
    await act(async () => word.focus());
    expect(pip.document.querySelector('[role=tooltip]')?.textContent).toBe(
      'The score a proof must reach to win.',
    );
    expect(document.querySelector('[role=tooltip]')).toBeNull();
    // Unmounted while its document still exists: React removes the portal from that body.
    cleanup();
    frame.remove();
  });

  test('the odds are said only when they are odds', () => {
    expect(barCaption(null)).toBeUndefined();
    expect(barCaption(1.4)).toBe('the bar · reach it and you win');
    expect(barCaption(38.4)).toBe('the bar · reach it and you win · about 1 in 38 do');
  });
});
