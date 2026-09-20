import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { ClaimChip } from './claim-chip.tsx';
import { StatusChip } from './status-chip.tsx';

afterEach(cleanup);

describe('StatusChip', () => {
  test('a tone is a light, done is a ✓, never a button', () => {
    render(
      <>
        <StatusChip tone="on" data-testid="on">
          held for V6
        </StatusChip>
        <StatusChip tone="done" data-testid="done">
          reached Ethereum
        </StatusChip>
      </>,
    );
    expect(screen.getByTestId('on').querySelector('i')).toBeTruthy();
    expect(screen.getByTestId('done').querySelector('i')).toBeNull();
    expect(screen.getByTestId('done')).toHaveTextContent('✓ reached Ethereum');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ClaimChip', () => {
  test('the step and one clock from the win; Stop pressed turns it into the wait', () => {
    const { rerender } = render(<ClaimChip step="proving" seconds={12.7} data-testid="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent('claiming · proving · 12 s');
    expect(screen.getByTestId('chip')).toHaveAttribute('data-step', 'proving');
    rerender(<ClaimChip step="in a block" seconds={58} data-testid="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent('claiming · in a block · 58 s');
    rerender(<ClaimChip step="in a block" seconds={61} stopping data-testid="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent('stopping · claim finishing · 61 s');
    expect(screen.getByTestId('chip')).toHaveAttribute('data-step', 'finishing');
  });
});
