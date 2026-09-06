import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { type EpochRow, rowsFromJson } from '../../../miner-core/src/reader.ts';
import { Difficulty, Duration, Emission, Retarget } from '../charts/index.tsx';
import { selectedFromSearch } from '../routes';
import type { Chain } from '../state';
import { Detail } from './Detail';
import { Observatory } from './Observatory';
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
    render(<Strip rows={rows} open={8} selected={null} onSelect={onSelect} now={rows[8]?.openedAt ?? 0} />);
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
    render(<Strip rows={rows} open={8} selected={0} onSelect={onSelect} onOlder={onOlder} now={0} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onOlder).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('the observatory', () => {
  const last = rows[rows.length - 1] as EpochRow;
  const chain = (open: number): Chain => ({
    rows,
    open,
    supply: 0n,
    genesis: { target: 0n, seed: 0n, launchAt: 0 },
    lottery: { mix: 0n, reveals: 0 },
    block: { number: 1, timestamp: last.openedAt + 60 },
    readAt: 0,
  });

  test('the open epoch tile shows the row of the open epoch, or a dash when a close outran the history', () => {
    render(<Observatory chain={chain(last.epoch)} now={(last.openedAt + 60) * 1000} />);
    expect(screen.getByTestId('open-claims').textContent).toBe(`${last.claims} of ${PARAMS.N}`);
    cleanup();
    render(<Observatory chain={chain(last.epoch + 1)} now={(last.openedAt + 60) * 1000} />);
    expect(screen.getByTestId('open-claims').textContent).toBe(`— of ${PARAMS.N}`);
    expect(screen.getByText(/this epoch not read yet/)).toBeTruthy();
    expect((screen.getByTestId('calculator') as HTMLButtonElement).disabled).toBe(true);
  });

  test('a row without closing facts is "open" only when it is the open epoch', () => {
    render(<Detail row={last} open now={last.openedAt + 60} />);
    expect(screen.getByTestId('detail-closed-by').textContent).toBe('open');
    expect(screen.getByTestId('sentence').textContent).toMatch(/^Open with/);
    cleanup();
    render(<Detail row={last} open={false} now={last.openedAt + 60} />);
    expect(screen.getByTestId('detail-closed-by').textContent).toBe('closed · not read yet');
    expect(screen.getByTestId('sentence').textContent).toMatch(/not been read yet/);
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
