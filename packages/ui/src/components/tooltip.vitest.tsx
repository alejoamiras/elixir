import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tip } from './tooltip.tsx';

afterEach(cleanup);

test('the word is dotted and focusable; focus opens the tip, blur closes it; no provider needed', async () => {
  render(
    <p>
      the <Tip tip="The score a proof must reach to win.">bar</Tip> is 38.4
    </p>,
  );
  const word = screen.getByText('bar');
  expect(word.getAttribute('data-slot')).toBe('tip-trigger');
  expect(word.tabIndex).toBe(0);
  expect(word.className).toContain('decoration-dotted');
  expect(screen.queryByRole('tooltip')).toBeNull();
  await act(async () => word.focus());
  expect(screen.getByRole('tooltip').textContent).toBe('The score a proof must reach to win.');
  await act(async () => word.blur());
  expect(screen.queryByRole('tooltip')).toBeNull();
});
