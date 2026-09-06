import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { type Status, StatusPill } from './status-pill.tsx';

const CASES: [Status, string][] = [
  ['idle', 'idle'],
  ['mining', 'mining'],
  ['claiming', 'claiming'],
  ['minted', 'minted'],
  ['not-backed-up', 'not backed up'],
  ['paused', 'paused'],
];

describe('StatusPill', () => {
  test.each(CASES)('%s renders its label and state light', (status, label) => {
    render(<StatusPill status={status} />);
    const pill = screen.getByText(label).closest('[data-slot=status-pill]');
    expect(pill).toHaveAttribute('data-status', status);
    expect(pill?.querySelector('i')).toHaveClass('size-[5px]');
  });

  test('only mining pulses', () => {
    render(
      <>
        <StatusPill status="mining" />
        <StatusPill status="claiming" />
      </>,
    );
    expect(screen.getByText('mining').closest('span')).toHaveClass('[&>i]:animate-pulse');
    expect(screen.getByText('claiming').closest('span')).not.toHaveClass('[&>i]:animate-pulse');
  });

  test('custom text overrides the label', () => {
    render(<StatusPill status="mining">18/min</StatusPill>);
    expect(screen.getByText('18/min')).toBeInTheDocument();
  });
});
