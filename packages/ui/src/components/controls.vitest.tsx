import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useTweenedNumber } from '../hooks/use-tweened-number.ts';
import { ExternalLink } from './external-link.tsx';
import { HoldButton } from './hold-button.tsx';
import { RadioCards } from './radio-cards.tsx';

const mockMatchMedia = (reduced: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

/** A hand-driven animation clock: each `tick(ms)` runs the pending frames with that timestamp. */
const fakeFrames = () => {
  let now = 1000;
  let pending: FrameRequestCallback[] = [];
  // jsdom's window is not the module's globalThis: stub on both, so whichever the code resolves is ours.
  const raf = (cb: FrameRequestCallback) => {
    pending.push(cb);
    return pending.length;
  };
  const caf = () => {
    pending = [];
  };
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  window.requestAnimationFrame = raf as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = caf as typeof window.cancelAnimationFrame;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  const run = () => {
    const cbs = pending;
    pending = [];
    act(() => {
      for (const cb of cbs) cb(now);
    });
  };
  return {
    /** Runs a first frame at the current time (the clock's origin), then one `ms` later. */
    tick(ms: number) {
      run();
      now += ms;
      run();
    },
  };
};

beforeEach(() => mockMatchMedia(false));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HoldButton', () => {
  test('nothing at timer expiry while held; exactly one confirm on the release after a completed fill', () => {
    const frames = fakeFrames();
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Hold to sign out</HoldButton>);
    const button = screen.getByRole('button', { name: /hold to sign out/i });
    (button as HTMLButtonElement & { setPointerCapture: () => void }).setPointerCapture = () => {};
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 0, clientY: 0 });
    frames.tick(600);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    frames.tick(700);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('an early release, a leave, a blur or a disabled change cancels; key repeat is ignored', () => {
    const frames = fakeFrames();
    const onConfirm = vi.fn();
    const { rerender } = render(<HoldButton onConfirm={onConfirm}>Hold</HoldButton>);
    const button = screen.getByRole('button', { name: /hold/i });
    (button as HTMLButtonElement & { setPointerCapture: () => void }).setPointerCapture = () => {};
    fireEvent.pointerDown(button, { pointerId: 1 });
    frames.tick(500);
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');

    fireEvent.keyDown(button, { key: ' ' });
    frames.tick(1300);
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    fireEvent.blur(button);
    fireEvent.keyUp(button, { key: ' ' });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(button, { key: 'Enter' });
    frames.tick(1300);
    rerender(
      <HoldButton onConfirm={onConfirm} disabled>
        Hold
      </HoldButton>,
    );
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('a captured pointer that drags off the button cancels; a release off the button never confirms', () => {
    const frames = fakeFrames();
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Hold</HoldButton>);
    const button = screen.getByRole('button', { name: /hold/i });
    button.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 40,
      width: 100,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 50, clientY: 20 });
    frames.tick(1300);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 300, clientY: 20 });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 300, clientY: 20 });
    expect(onConfirm).not.toHaveBeenCalled();
    // A second pointer cannot release a hold the first began.
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 50, clientY: 20 });
    frames.tick(1300);
    fireEvent.pointerUp(button, { pointerId: 2, clientX: 50, clientY: 20 });
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 50, clientY: 20 });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('the keyboard path commits on keyup after the fill', () => {
    const frames = fakeFrames();
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Hold</HoldButton>);
    const button = screen.getByRole('button', { name: /hold/i });
    fireEvent.keyDown(button, { key: 'Enter' });
    frames.tick(1300);
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
  });
});

describe('RadioCards', () => {
  test('one checked card, each stating its consequence; choosing another reports it', () => {
    const onChange = vi.fn();
    render(
      <RadioCards
        aria-label="how"
        value="private"
        onChange={onChange}
        options={[
          { value: 'private', label: 'Privately', description: 'The recipient gets notes.' },
          { value: 'public', label: 'Publicly', description: 'Readable by anyone.' },
        ]}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.getAttribute('data-state')).toBe('checked');
    expect(screen.getByText('Readable by anyone.')).toBeInTheDocument();
    fireEvent.click(radios[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('public');
  });
});

describe('ExternalLink', () => {
  test('a new-tab anchor with no opener and the full value as its title; plain text without an href', () => {
    render(
      <ExternalLink href="https://x.example/blocks/5" full="0xabc…">
        block 5
      </ExternalLink>,
    );
    const a = screen.getByRole('link', { name: /block 5/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('rel')).toContain('noreferrer');
    expect(a).toHaveAttribute('title', '0xabc…');
    render(<ExternalLink full="0xdef">0xde…ef</ExternalLink>);
    expect(screen.queryByRole('link', { name: /0xde/ })).toBeNull();
    expect(screen.getByTitle('0xdef')).toBeInTheDocument();
  });
});

describe('useTweenedNumber', () => {
  test('glides to the target on the animation clock and jumps under reduced motion', () => {
    const frames = fakeFrames();
    const { result, rerender } = renderHook(({ v }) => useTweenedNumber(v, 300), { initialProps: { v: 10 } });
    expect(result.current).toBe(10);
    rerender({ v: 20 });
    frames.tick(150);
    expect(result.current).toBeGreaterThan(10);
    expect(result.current).toBeLessThan(20);
    frames.tick(300);
    expect(result.current).toBe(20);

    mockMatchMedia(true);
    const still = renderHook(({ v }) => useTweenedNumber(v, 300), { initialProps: { v: 1 } });
    still.rerender({ v: 5 });
    expect(still.result.current).toBe(5);
  });
});
