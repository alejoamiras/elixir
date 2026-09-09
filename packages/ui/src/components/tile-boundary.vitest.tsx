import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TileBoundary } from './tile-boundary.tsx';

afterEach(cleanup);

function Fragile({ boom }: { boom: boolean }) {
  if (boom) throw new Error(`the tile blew up ${'x'.repeat(400)}`);
  return <p>fine</p>;
}

describe('TileBoundary', () => {
  test('a throwing child shows the fixed sentence, a sibling survives, the error goes to onError cut short', () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <TileBoundary name="loop" onError={(m) => errors.push(m)}>
          <Fragile boom />
        </TileBoundary>
        <TileBoundary name="rail">
          <p>neighbour</p>
        </TileBoundary>
      </>,
    );
    expect(screen.getByText('This tile hit an error. Try again, or reload the page.')).toBeTruthy();
    expect(screen.getByText('neighbour')).toBeTruthy();
    expect(screen.queryByText(/blew up/)).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.startsWith('loop: the tile blew up')).toBe(true);
    expect(errors[0]?.length).toBe(300);
    spy.mockRestore();
  });

  test('Try again remounts the child', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Host() {
      const [boom, setBoom] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setBoom(false)}>
            fix
          </button>
          <TileBoundary name="loop">
            <Fragile boom={boom} />
          </TileBoundary>
        </>
      );
    }
    render(<Host />);
    expect(screen.getByTestId('tile-retry')).toBeTruthy();
    fireEvent.click(screen.getByText('fix'));
    fireEvent.click(screen.getByTestId('tile-retry'));
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByTestId('tile-retry')).toBeNull();
    spy.mockRestore();
  });
});
