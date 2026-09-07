import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Kpi } from './kpi.tsx';
import { Tile, TileHeader } from './tile.tsx';

afterEach(cleanup);

describe('tile geometry and label tones', () => {
  test('the tile carries the binder padding and radius; the header label and its aside are dim', () => {
    const { container } = render(
      <Tile>
        <TileHeader aside="opened 03:31:12">epoch 22</TileHeader>
      </Tile>,
    );
    const tile = container.querySelector('[data-slot=tile]') as HTMLElement;
    expect(tile.className).toContain('px-[18px]');
    expect(tile.className).toContain('py-4');
    expect(tile.className).toContain('rounded-[8px]');
    const header = container.querySelector('[data-slot=tile-header]') as HTMLElement;
    expect(header.className).toContain('label-mono');
    expect(header.lastElementChild?.className).toContain('text-ink-3');
  });

  test('the KPI unit takes the dim ink and the md value the binder line-height', () => {
    const { container } = render(<Kpi label="minted" value="344" unit="YACA" />);
    const value = container.querySelector('[data-slot=kpi] > span:nth-child(2)') as HTMLElement;
    expect(value.className).toContain('leading-[1.1]');
    expect(value.lastElementChild?.className).toContain('text-ink-3');
  });
});
