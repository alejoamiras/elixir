import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { type Step, Stepper, showsDetail } from './stepper.tsx';

const steps: Step[] = [
  { id: 'sent', label: 'Deposit sent', state: 'done', detail: 'It left your wallet.' },
  { id: 'cross', label: 'Crossing to Aztec', state: 'active', detail: 'About 12 minutes.' },
  { id: 'claim', label: 'Claim here', state: 'pending', detail: 'One tap, no fee.', right: 'one tap' },
];

describe('Stepper', () => {
  test('only the step that is running, failed or warned speaks; a finished last step keeps its outcome', () => {
    const said = (list: Step[], explain = false) => list.map((s, i) => showsDetail(s, i, list, explain));
    expect(said(steps)).toEqual([false, true, false]);
    expect(said(steps.map((s) => ({ ...s, state: 'failed' as const })))).toEqual([true, true, true]);
    expect(said(steps.map((s) => ({ ...s, state: 'warn' as const })))).toEqual([true, true, true]);
    // A flow that ended: the last step's line is what happened, and it stays.
    expect(said(steps.map((s) => ({ ...s, state: 'done' as const })))).toEqual([false, false, true]);
    // An explainer is all-pending by nature: every step speaks.
    expect(
      said(
        steps.map((s) => ({ ...s, state: 'pending' as const })),
        true,
      ),
    ).toEqual([true, true, true]);
  });

  test('the rendered list follows the rule, and explain overrides it', () => {
    const { rerender } = render(<Stepper steps={steps} />);
    expect(screen.queryByText('About 12 minutes.')).toBeInTheDocument();
    expect(screen.queryByText('It left your wallet.')).not.toBeInTheDocument();
    expect(screen.queryByText('One tap, no fee.')).not.toBeInTheDocument();
    // The right column is not a paragraph: it shows at any state.
    expect(screen.getByText('one tap')).toBeInTheDocument();
    rerender(<Stepper steps={steps} explain />);
    expect(screen.getByText('It left your wallet.')).toBeInTheDocument();
    expect(screen.getByText('One tap, no fee.')).toBeInTheDocument();
  });

  test('every step but the last draws a rail; a finished step says so on it', () => {
    render(<Stepper steps={steps} />);
    const rails = [...document.querySelectorAll('[data-slot=step-rail]')];
    expect(rails).toHaveLength(2);
    expect(rails.map((r) => r.getAttribute('data-done'))).toEqual(['true', 'false']);
  });
});
