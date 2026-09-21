import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './popover.tsx';

afterEach(cleanup);

test('a click opens the panel, Escape closes it', async () => {
  render(
    <Popover>
      <PopoverTrigger aria-label="How to read this">?</PopoverTrigger>
      <PopoverContent>
        <b>How to read this</b>
        <span>Each tick is one proof.</span>
      </PopoverContent>
    </Popover>,
  );
  const trigger = screen.getByRole('button', { name: 'How to read this' });
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => fireEvent.click(trigger));
  const panel = screen.getByRole('dialog');
  expect(panel.getAttribute('data-slot')).toBe('popover-content');
  expect(panel.textContent).toContain('Each tick is one proof.');
  await act(async () => fireEvent.keyDown(panel, { key: 'Escape' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
