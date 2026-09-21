import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PrestoCard, type PrestoStanding } from './presto-card.tsx';

afterEach(cleanup);

const SITE = 'https://presto.build';

describe('PrestoCard', () => {
  test('each standing has its words; the look button appears only where a look is the next step', () => {
    const table: Array<[PrestoStanding, string, string | null]> = [
      ['ask', 'Have Presto?', 'Look for Presto'],
      ['checking', 'Presto', null],
      ['found', 'Presto · found', null],
      ['remembered', 'Presto · used last time', null],
      ['proving', 'Presto · native prover', null],
      ['absent', 'Presto didn’t answer.', 'Look again'],
      ['blocked', 'Your browser blocked it.', 'Look again'],
    ];
    for (const [standing, title, look] of table) {
      const { getByTestId, queryByTestId, unmount } = render(
        <PrestoCard standing={standing} onLook={() => {}} site={SITE} />,
      );
      expect(getByTestId('presto-card').dataset.standing).toBe(standing);
      expect(getByTestId('presto-title').textContent).toBe(title);
      expect(queryByTestId('presto-look')?.textContent ?? null).toBe(look);
      unmount();
    }
  });

  test('remembered under a browser that will ask again offers the look; the way back shows only with a handler', () => {
    const onLook = vi.fn();
    const onUseBrowser = vi.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <PrestoCard standing="remembered" needsLook onLook={onLook} onUseBrowser={onUseBrowser} site={SITE} />,
    );
    expect(getByTestId('presto-card').textContent).toContain('your browser will ask');
    fireEvent.click(getByTestId('presto-look'));
    fireEvent.click(getByTestId('presto-use-browser'));
    expect(onLook).toHaveBeenCalledTimes(1);
    expect(onUseBrowser).toHaveBeenCalledTimes(1);
    rerender(<PrestoCard standing="ask" onLook={onLook} site={SITE} />);
    expect(queryByTestId('presto-use-browser')).toBeNull();
    expect(getByTestId('presto-get').getAttribute('href')).toBe(SITE);
    expect(getByTestId('presto-card').textContent).toContain('Your browser will ask first.');
  });
});
