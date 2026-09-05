import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Sample } from '../score-loop-model.ts';
import { EpochRail } from './epoch-rail.tsx';
import { Marks } from './marks.tsx';
import { clampThreads, PowerSlider, powerLabels } from './power-slider.tsx';
import { Preflight } from './preflight.tsx';
import { ProofLedger, type ProofLine } from './proof-line.tsx';
import { ScoreLoop } from './score-loop.tsx';
import { Stepper } from './stepper.tsx';

const mockMatchMedia = (reduced: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

afterEach(() => vi.restoreAllMocks());

describe('ProofLedger', () => {
  test('renders the four line kinds with their glyphs', () => {
    const lines: (ProofLine & { id: number })[] = [
      { id: 1, kind: 'attempt', time: '03:34:07', n: 1302, score: 3.9, proveMs: 3260, best: true },
      { id: 2, kind: 'win', time: '03:34:04', n: 1301, score: 51.4, proveMs: 3240 },
      {
        id: 3,
        kind: 'minted',
        time: '03:33:20',
        text: 'claim in block 184,209 · 4 YACA minted',
        chain: 'chain saw: nullifier',
      },
      { id: 4, kind: 'failed', time: '03:33:10', text: 'claim reverted' },
      { id: 5, kind: 'epoch', time: '03:33:51', text: 'epoch 22 opened · difficulty 33.1' },
    ];
    render(<ProofLedger lines={lines} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-kind'))).toEqual([
      'attempt',
      'win',
      'minted',
      'failed',
      'epoch',
    ]);
    expect(items[0]).toHaveTextContent(/#1302.*score 3\.9.*3\.26 s.*best this epoch/);
    expect(items[1]).toHaveTextContent('★');
    expect(items[2]).toHaveTextContent('✓');
    expect(items[2]).toHaveTextContent('chain saw: nullifier');
    expect(items[3]).toHaveTextContent('✗');
    expect(items[4]).toHaveTextContent(/──.*epoch 22 opened · difficulty 33\.1.*──/);
  });
});

describe('Preflight', () => {
  test('a failed row shows its evidence and error, and the action appears', () => {
    render(
      <Preflight
        rows={[
          { id: 'iso', label: 'cross-origin isolated', evidence: 'threads available', state: 'ok', ms: 12 },
          {
            id: 'node',
            label: 'node',
            evidence: 'v5.testnet.rpc.aztec-labs.com',
            state: 'failed',
            error: 'unreachable after 10 s',
          },
          { id: 'key', label: 'your key', state: 'pending' },
        ]}
        action={<button type="button">Retry now</button>}
      />,
    );
    expect(screen.getByText('unreachable after 10 s')).toHaveAttribute('data-slot', 'preflight-error');
    expect(screen.getByText('v5.testnet.rpc.aztec-labs.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry now' })).toBeInTheDocument();
    expect(screen.getByText('cross-origin isolated').closest('li')).toHaveAttribute('data-state', 'ok');
  });
});

describe('Stepper', () => {
  test('shows real times and the active detail', () => {
    render(
      <Stepper
        steps={[
          { id: 'prove', label: 'proving the claim in your browser', state: 'done', ms: 21_400 },
          {
            id: 'sent',
            label: 'sent',
            state: 'active',
            detail: 'dropped in 9 min 38 s if no block takes it',
          },
          { id: 'wait', label: 'waiting for a block', state: 'pending' },
        ]}
      />,
    );
    expect(screen.getByText('21.4 s')).toBeInTheDocument();
    expect(screen.getByText('sent').closest('li')).toHaveAttribute('data-state', 'active');
    expect(screen.getByText(/dropped in 9 min 38 s/)).toBeInTheDocument();
  });
});

describe('EpochRail', () => {
  const rows = [{ label: 'difficulty', value: '33.1' }];
  test('marks claims and this key’s brighter; the close button appears only at T_MAX', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <EpochRail
        epoch={22}
        claims={2}
        n={4}
        mine={[1]}
        progress={0.64}
        rows={rows}
        hatchSeconds={1008}
        onClose={onClose}
      />,
    );
    const segments = document.querySelectorAll('[data-slot=segment]');
    expect(segments).toHaveLength(4);
    expect(segments[0]).toHaveAttribute('data-filled');
    expect(segments[1]).toHaveAttribute('data-mine');
    expect(segments[2]).not.toHaveAttribute('data-filled');
    expect(screen.queryByRole('button', { name: 'Close the epoch' })).toBeNull();
    rerender(
      <EpochRail
        epoch={22}
        claims={2}
        n={4}
        mine={[1]}
        progress={4.1}
        rows={rows}
        hatchSeconds={0}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close the epoch' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PowerSlider', () => {
  test('labels and clamp follow cores − 1; changes emit clamped threads', () => {
    expect(powerLabels(12)).toEqual({ eco: 3, balanced: 6, max: 11 });
    expect(powerLabels(2)).toEqual({ eco: 1, balanced: 1, max: 1 });
    expect(clampThreads(0, 12)).toBe(1);
    expect(clampThreads(40, 12)).toBe(11);
    const onChange = vi.fn();
    render(<PowerSlider cores={12} threads={99} onChange={onChange} readout="18.4 / min" />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('11');
    expect(screen.getByText(/11 threads/)).toHaveTextContent('18.4 / min');
    fireEvent.change(slider, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(3);
    expect(document.querySelector('[data-slot=power-label][data-on]')).toHaveTextContent('max · 11');
  });
});

describe('Marks', () => {
  test('shortens the hashes and shows the claim transition', () => {
    render(
      <Marks
        nullifier={`0x2f9a${'0'.repeat(56)}c41e`}
        noteHash={`0x77b0${'0'.repeat(56)}19d2`}
        claims={[3, 4]}
        suffix="epoch closed"
      />,
    );
    expect(screen.getByText('0x2f9a…c41e')).toBeInTheDocument();
    expect(screen.getByText(/3 → 4/)).toHaveTextContent('epoch closed');
  });
});

describe('ScoreLoop', () => {
  const samples: Sample[] = [{ t: 0, score: 3.9 }];
  test('does not schedule frames under reduced motion, and does otherwise', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    mockMatchMedia(true);
    const { unmount } = render(<ScoreLoop difficulty={33.1} samples={samples} />);
    expect(document.querySelector('[data-slot=score-loop]')).toHaveAttribute('data-reduced');
    expect(raf).not.toHaveBeenCalled();
    unmount();
    mockMatchMedia(false);
    render(<ScoreLoop difficulty={33.1} samples={samples} />);
    expect(raf).toHaveBeenCalled();
    expect(screen.getByRole('img')).toHaveAccessibleName(/1 proofs in the last 60 seconds/);
  });
});
