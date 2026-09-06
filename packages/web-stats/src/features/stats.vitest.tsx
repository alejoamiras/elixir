import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { type EpochRow, rowsFromJson } from '../../../miner-core/src/reader.ts';
import { Difficulty, Duration, Emission, Retarget } from '../charts/index.tsx';
import { selectedFromSearch } from '../routes';
import { Strip, step } from './Strip';

const fixture = await import('../../../miner-core/fixtures/epochs.testnet.json?raw');
const rows: EpochRow[] = rowsFromJson(fixture.default);
const RULES = {
  N: PARAMS.N,
  EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS,
  T_MAX: PARAMS.T_MAX,
  REWARD: PARAMS.REWARD,
  DECIMALS: PARAMS.DECIMALS,
  TOKEN_SYMBOL: PARAMS.TOKEN_SYMBOL,
};

afterEach(cleanup);

describe('charts on the captured history', () => {
  test('duration bars: one per closed epoch, the roll amber, the selection haloed', () => {
    const { container } = render(<Duration rows={rows} selected={3} rules={RULES} />);
    const bars = container.querySelectorAll('[data-slot=bar]');
    expect(bars).toHaveLength(8);
    expect(bars[0]?.getAttribute('class')).toContain('fill-warn');
    expect(bars[1]?.getAttribute('class')).not.toContain('fill-warn');
    expect(container.querySelectorAll('[data-slot=halo]')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /8 closed epochs/ })).toBeTruthy();
  });

  test('retarget bars: violet below 1, grey above; emission and difficulty draw one line each', () => {
    const { container } = render(<Retarget rows={rows} selected={null} rules={RULES} />);
    const bars = Array.from(container.querySelectorAll('[data-slot=bar]'));
    expect(bars[0]?.getAttribute('class')).toContain('fill-ink-3'); // ×4 easier
    expect(bars[1]?.getAttribute('class')).toContain('fill-uv'); // ×0.48 harder
    const emission = render(<Emission rows={rows} selected={null} rules={RULES} />).container;
    expect(emission.querySelectorAll('[data-slot=line]')).toHaveLength(1);
    expect(emission.querySelector('svg')?.getAttribute('data-testid')).toBe('chart-emission');
    const difficulty = render(<Difficulty rows={rows} selected={8} rules={RULES} />).container;
    expect(difficulty.querySelectorAll('[data-slot=point]')).toHaveLength(9);
    expect(difficulty.querySelectorAll('[data-slot=halo]')).toHaveLength(1);
  });
});

describe('the strip', () => {
  test('one option per epoch, the open one on the right and selected by default; a click selects', () => {
    const onSelect = vi.fn();
    render(<Strip rows={rows} selected={null} onSelect={onSelect} now={rows[8]?.openedAt ?? 0} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(9);
    expect(options[8]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(options[2] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(2);
    // Clicking the open epoch clears the selection (null = "follow the open one").
    fireEvent.click(options[8] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test('← → step through the loaded rows; past the left edge asks for older rows', () => {
    expect(step(rows, 3, -1)).toBe(2);
    expect(step(rows, 3, 1)).toBe(4);
    expect(step(rows, 7, 1)).toBeNull();
    expect(step(rows, 8, 1)).toBeNull();
    expect(step(rows, 0, -1)).toBe('older');
    const onSelect = vi.fn();
    const onOlder = vi.fn();
    render(<Strip rows={rows} selected={0} onSelect={onSelect} onOlder={onOlder} now={0} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onOlder).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('the URL selection', () => {
  test('?epoch=N selects; anything else follows the open epoch', () => {
    expect(selectedFromSearch('?epoch=14')).toBe(14);
    expect(selectedFromSearch('?epoch=0')).toBe(0);
    expect(selectedFromSearch('')).toBeNull();
    expect(selectedFromSearch('?epoch=-1')).toBeNull();
    expect(selectedFromSearch('?epoch=abc')).toBeNull();
  });
});
