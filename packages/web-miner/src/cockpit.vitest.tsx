import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Mine } from './routes/Mine';

afterEach(cleanup);
// jsdom has no matchMedia; the score loop's reduced-motion hook reads it.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

// The M1 frame's placement, as classes: the computed grid is asserted in the browser (miner.e2e.ts).
describe('the cockpit grid', () => {
  test('loop and ledger over three columns, the rail two rows, the KPIs a row of three tiles', () => {
    const { container } = render(<Mine controller={() => undefined} />);
    const cockpit = container.querySelector('[data-testid=cockpit]') as HTMLElement;
    expect(cockpit.className).toContain('xl:grid-cols-[1fr_1fr_1fr_300px]');
    expect(cockpit.className).toContain('gap-[14px]');
    expect(cockpit.className).toContain('items-start');
    const tiles = Array.from(cockpit.children) as HTMLElement[];
    expect(tiles).toHaveLength(4);
    expect(tiles[0]?.className).toContain('xl:col-span-3');
    expect(tiles[1]?.className).toContain('xl:row-span-2');
    expect(tiles[2]?.getAttribute('data-testid')).toBe('kpi-tiles');
    expect(tiles[2]?.querySelectorAll('[data-slot=tile]')).toHaveLength(3);
    // The last cell is a stack below xl and dissolves into the grid at xl (`contents`).
    expect(tiles[3]?.className).toContain('xl:contents');
    expect(tiles[3]?.firstElementChild?.className).toContain('xl:col-span-3');
    expect(tiles[3]?.lastElementChild?.textContent).toContain('your key');
  });
});
