import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { AmountBlock, MaxChip } from './amount-block.tsx';
import { HeroCard } from './hero-card.tsx';
import { JournalCard } from './journal-card.tsx';
import { Note } from './note.tsx';
import { StackedBar } from './stacked-bar.tsx';
import { Stepper } from './stepper.tsx';
import { Timeline } from './timeline.tsx';
import { Trail } from './trail.tsx';

afterEach(cleanup);

describe('the bridge primitives', () => {
  test('an amount block shows the figure, its unit and the aside; its tone is the border', () => {
    const { container } = render(
      <AmountBlock value="48.00" unit="tYACA" aside={<MaxChip onClick={() => {}} />} tone="ok" />,
    );
    const block = container.querySelector('[data-slot="amount"]') as HTMLElement;
    expect(block.dataset.tone).toBe('ok');
    expect(block.textContent).toContain('48.00');
    expect(block.textContent).toContain('tYACA');
    expect(screen.getByRole('button', { name: 'max' })).toBeTruthy();
  });

  test('a trail keeps its stations in order with their states, as chips or inline', () => {
    const items = [
      { label: 'left V5', state: 'done' as const },
      { label: 'proving · by 22:40', state: 'on' as const },
      { label: 'waits for V6', state: 'todo' as const },
    ];
    const { container } = render(<Trail items={items} />);
    const states = [...container.querySelectorAll('[data-state]')].map((e) => e.getAttribute('data-state'));
    expect(states).toEqual(['done', 'on', 'todo']);
    expect(container.textContent).toContain('›');
    expect(container.querySelector('[data-variant="chips"]')).toBeTruthy();
    // A done station carries ✓ where the others carry their light.
    expect(container.querySelector('[data-state="done"]')?.textContent).toMatch(/^✓/);
    expect(container.querySelector('[data-state="done"] i')).toBeNull();
    expect(container.querySelector('[data-state="on"] i')).toBeTruthy();
    render(<Trail items={items} variant="inline" data-testid="inline" />);
    expect(screen.getByTestId('inline').getAttribute('data-variant')).toBe('inline');
  });

  test('a hero card: eyebrow, title, body, trail and the side column, with its tone', () => {
    render(
      <HeroCard
        eyebrow="aztec v6 · expected around sep 18"
        title="V5 ends around Sep 18. Send your balance ahead."
        trail={[{ label: 'leaves V5 · now', state: 'on' }]}
        side={<button type="button">Send 48 tYACA ahead</button>}
        tone="warn"
        data-testid="card"
      >
        Sent ahead, 48 tYACA leaves V5 <b>within the hour</b>.
      </HeroCard>,
    );
    const card = screen.getByTestId('card');
    expect(card.getAttribute('data-tone')).toBe('warn');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/Send your balance ahead/);
    expect(screen.getByRole('button', { name: /Send 48/ })).toBeTruthy();
    expect(card.querySelector('[data-slot="trail"]')).toBeTruthy();
  });

  test('a journal card: the amount and its unit, who, when, the inline trail, the line and the actions', () => {
    render(
      <ul>
        <JournalCard
          amount="8.00"
          unit="tYACA"
          who="to Ethereum · 0x9f3a…21c0"
          when="18:52 · Sep 11"
          trail={[
            { label: 'burned', state: 'done' },
            { label: 'proven to Ethereum', state: 'on' },
          ]}
          line={
            <>
              Being proven to Ethereum with epoch 412. <b>Nothing to do.</b>
            </>
          }
          actions={<a href="#e">Etherscan ↗</a>}
          tone="on"
          data-testid="jc"
        />
      </ul>,
    );
    const card = screen.getByTestId('jc');
    expect(card.getAttribute('data-tone')).toBe('on');
    expect(card.textContent).toContain('8.00');
    expect(card.textContent).toContain('18:52 · Sep 11');
    expect(card.querySelector('[data-variant="inline"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Etherscan/ })).toBeTruthy();
  });
});

describe('the stats primitives', () => {
  test('a timeline marks the current phase and keeps the order; a stacked bar scales to its sum', () => {
    render(
      <Timeline
        items={[
          { id: 'launched', label: 'launched', detail: 'Sep 5 · epoch 0 opened', state: 'done' },
          { id: 'announced', label: 'V6 announced', detail: 'Sep 11', state: 'on' },
          { id: 'closes', label: 'exits close', state: 'todo' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'on', 'todo']);
    expect(items[1]?.getAttribute('aria-current')).toBe('step');
    const { container } = render(
      <StackedBar
        segments={[
          { id: 'here', label: 'still on V5', figure: '324', value: 324, color: 'var(--uv)' },
          { id: 'eth', label: 'left to Ethereum', figure: '108', value: 108, color: 'var(--ink-3)' },
          { id: 'none', label: 'moved on', figure: '0', value: 0, color: 'var(--uv-2)' },
        ]}
      />,
    );
    const widths = [...container.querySelectorAll('[data-segment]')].map(
      (e) => (e as HTMLElement).style.width,
    );
    expect(widths[0]).toBe('75%');
    expect(widths[1]).toBe('25%');
    expect(widths[2]).toBe('0%');
    expect(container.textContent).toContain('left to Ethereum');
  });

  test('a note carries its title and tone; the stepper knows a warn state', () => {
    render(
      <Note title="If V6 never opens" tone="warn" data-testid="note">
        Redeem on Ethereum as YACA instead.
      </Note>,
    );
    expect(screen.getByTestId('note').getAttribute('data-tone')).toBe('warn');
    expect(screen.getByTestId('note').textContent).toContain('If V6 never opens');
    const { container } = render(
      <Stepper steps={[{ id: 'a', label: 'paused', state: 'warn', right: 'Sep 20' }]} />,
    );
    expect(container.querySelector('[data-state="warn"]')).toBeTruthy();
  });
});
