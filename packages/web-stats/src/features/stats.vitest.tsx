import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { type EpochRow, rowsFromJson } from '../../../miner-core/src/reader.ts';
import { Difficulty, Duration, Emission, Retarget } from '../charts/index.tsx';
import { selectedFromSearch } from '../routes';
import { Stats } from '../routes/Stats';
import { type Chain, chainAtom } from '../state';
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
  test('duration: one bar per closed epoch from the 10 s floor, the roll amber and apart, the selection haloed', () => {
    const { container } = render(<Duration rows={rows} selected={3} rules={RULES} />);
    expect(container.querySelectorAll('g.claims rect[aria-label]')).toHaveLength(7);
    const roll = container.querySelectorAll('g.roll rect[aria-label]');
    expect(roll).toHaveLength(1);
    expect(roll[0]?.getAttribute('aria-label')).toBe('epoch 0: 26136 s, closed by roll()');
    // A constant fill sits on the mark's group; the theme's variable reaches every rect from there.
    expect(container.querySelector('g.roll')?.getAttribute('fill')).toBe('var(--warn)');
    expect(container.querySelectorAll('g.halo rect')).toHaveLength(1);
    expect(container.querySelectorAll('g.rule line')).toHaveLength(2);
    expect(screen.getByRole('figure', { name: /8 closed epochs/ })).toBeTruthy();
    cleanup();
    // The open epoch has no duration: nothing to halo on a closed-only chart.
    const open = render(<Duration rows={rows} selected={8} rules={RULES} />).container;
    expect(open.querySelectorAll('g.halo rect')).toHaveLength(0);
  });

  test('retarget bars grow from 1, violet harder and grey easier; emission and difficulty count their marks', () => {
    const { container } = render(<Retarget rows={rows} selected={null} rules={RULES} />);
    const easier = container.querySelectorAll('g.easier rect[aria-label]');
    const harder = container.querySelectorAll('g.harder rect[aria-label]');
    expect(easier.length + harder.length).toBe(8);
    expect(easier[0]?.getAttribute('aria-label')).toBe('epoch 0: retarget ×4.00');
    expect(container.querySelector('g.easier')?.getAttribute('fill')).toBe('var(--ink-3)');
    expect(container.querySelector('g.harder')?.getAttribute('fill')).toBe('var(--uv)');
    // A ratio outside the contract's clamp is a node lying or a wrong slot: marked at the baseline, never a bar.
    const bad = [...rows.slice(0, 2).map((r, i) => ({ ...r, retarget: i ? 100 : 0 })), ...rows.slice(2)];
    const guarded = render(<Retarget rows={bad} selected={null} rules={RULES} />).container;
    expect(guarded.querySelectorAll('g.invalid circle[aria-label]')).toHaveLength(2);
    expect(guarded.querySelectorAll('g.harder rect, g.easier rect')).toHaveLength(6);
    const emission = render(<Emission rows={rows} selected={null} rules={RULES} />).container;
    expect(emission.querySelectorAll('g.point circle[aria-label]')).toHaveLength(8);
    expect(emission.querySelectorAll('g.minted path')).toHaveLength(1);
    expect(emission.querySelector('[data-testid=chart-emission]')).toBeTruthy();
    const difficulty = render(<Difficulty rows={rows} selected={8} rules={RULES} />).container;
    expect(difficulty.querySelectorAll('g.point circle[aria-label]')).toHaveLength(9);
    expect(difficulty.querySelectorAll('g.halo rect')).toHaveLength(1);
    // Epoch 0 closed by roll(): one annotation at its close.
    expect(difficulty.querySelectorAll('g.roll line')).toHaveLength(1);
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
    expect(screen.getByTestId('open-claims').textContent).toBe(String(last.claims));
    cleanup();
    render(<Observatory chain={chain(last.epoch + 1)} now={(last.openedAt + 60) * 1000} />);
    expect(screen.getByTestId('open-claims').textContent).toBe('—');
    expect(screen.getByText(/this epoch not read yet/)).toBeTruthy();
    expect((screen.getByTestId('calculator') as HTMLButtonElement).disabled).toBe(true);
  });

  test('the A1 grid: six KPI cells, the strip beside the detail, four chart tiles, the table, not-here beside verify', () => {
    const store = createStore();
    store.set(chainAtom, chain(last.epoch));
    const { container } = render(
      <Provider store={store}>
        <Stats onOlder={() => {}} nodeUrl="http://node.test" />
      </Provider>,
    );
    const grid = container.querySelector('[data-testid=stats]') as HTMLElement;
    expect(grid.className).toContain('md:grid-cols-6');
    const cells = Array.from(
      grid.querySelectorAll(
        ':scope > [data-slot=tile], :scope > [data-testid=observatory] > [data-slot=tile]',
      ),
    );
    const spans = cells.map((c) => c.className.match(/(?:md|xl):col-span-\d/g)?.join(' '));
    expect(spans.slice(0, 6).every((s) => s === 'md:col-span-2 xl:col-span-1')).toBe(true);
    expect(spans[6]).toBe('md:col-span-6 xl:col-span-4');
    expect(spans[7]).toBe('md:col-span-6 xl:col-span-2');
    expect(spans.slice(8, 12).every((s) => s === 'md:col-span-3')).toBe(true);
    expect(spans[12]).toBe('md:col-span-6');
    expect(spans.slice(13)).toEqual(['md:col-span-3', 'md:col-span-3']);
    expect(grid.querySelectorAll('[data-slot=chart]')).toHaveLength(4);
    expect(screen.getByTestId('strip-selected').textContent).toBe(`epoch ${last.epoch}`);
    expect(screen.getByTestId('reproduce-command').textContent).toContain(
      "AZTEC_NODE_URL='http://node.test'",
    );
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
