import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ActivityRow } from './activity-row.tsx';
import { AmountBlock, MaxChip } from './amount-block.tsx';
import { HeroCard } from './hero-card.tsx';
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
    expect(container.querySelector('[data-state="done"]')?.textContent).toMatch(/^✓/);
    expect(container.querySelector('[data-state="done"] i')).toBeNull();
    expect(container.querySelector('[data-state="on"] i')).toBeTruthy();
    render(<Trail items={items} variant="inline" data-testid="inline" />);
    expect(screen.getByTestId('inline').getAttribute('data-variant')).toBe('inline');
  });

  test('a hero card: eyebrow with its chip, title, body, trail, the actions under, with its tone', () => {
    render(
      <HeroCard
        eyebrow="aztec v6 · expected around sep 18"
        aside={<span data-testid="chip">V5 proved an epoch 12 min ago</span>}
        title="V5 ends around Sep 18. Send your balance ahead."
        trail={[{ label: 'leaves V5 · now', state: 'on' }]}
        actions={<button type="button">Send 48 tYACA ahead</button>}
        tone="warn"
        data-testid="card"
      >
        Sent ahead, 48 tYACA leaves V5 <b>within the hour</b>.
      </HeroCard>,
    );
    const card = screen.getByTestId('card');
    expect(card.getAttribute('data-tone')).toBe('warn');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/Send your balance ahead/);
    expect(card.querySelector('[data-slot="hero-actions"]')?.textContent).toBe('Send 48 tYACA ahead');
    expect(screen.getByTestId('chip').textContent).toContain('12 min ago');
    expect(card.querySelector('[data-slot="trail"]')).toBeTruthy();
  });
});

describe('the activity row', () => {
  test('the amount and where it goes, the chip and the time, the sentence, the trail, one action and Details', () => {
    const onAction = vi.fn();
    const line = {
      chip: { word: 'ready to claim', tone: 'ok' as const },
      sentence: 'Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH.',
      trail: [
        { label: 'sent', state: 'done' as const },
        { label: 'claim on Ethereum', state: 'on' as const },
      ],
      action: { kind: 'claim-l1' as const, label: 'Claim on Ethereum' },
    };
    render(
      <ul>
        <ActivityRow
          amount="8.00"
          unit="tYACA"
          direction="→ Ethereum · 0x9f3a…21c0"
          when="18:52 · Sep 11"
          line={line}
          onAction={onAction}
          details={<a href="#e">Etherscan ↗</a>}
          data-testid="row"
        />
      </ul>,
    );
    const row = screen.getByTestId('row');
    // A row that waits for the user is the one drawn in colour.
    expect(row.getAttribute('data-state')).toBe('ok');
    expect(row.textContent).toContain('8.00');
    expect(row.textContent).toContain('18:52 · Sep 11');
    expect(screen.getByTestId('crossing-word').textContent).toBe('ready to claim');
    expect(screen.getByTestId('row-line').textContent).toMatch(/^Ready\./);
    expect(row.querySelector('[data-variant="inline"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Claim on Ethereum' }));
    expect(onAction).toHaveBeenCalledWith('claim-l1');
    // Details is closed until asked, and the links are the disclosure's.
    expect(screen.queryByRole('link', { name: /Etherscan/ })).toBeNull();
    fireEvent.click(screen.getByTestId('row-details'));
    expect(screen.getByRole('link', { name: /Etherscan/ })).toBeTruthy();
  });

  test('an activity row with a reason keeps its button off and says why; a collapsed row keeps only its first line', () => {
    const line = {
      chip: { word: 'held for V6', tone: 'on' as const },
      sentence: 'Held on Ethereum for V6.',
      trail: [{ label: 'sent', state: 'done' as const }],
      action: {
        kind: 'forward' as const,
        label: 'Forward to V6',
        disabled: 'Connect a wallet on Sepolia first.',
      },
      also: { kind: 'redeem' as const, label: 'or redeem it on Ethereum' },
      note: 'while the bridge is open.',
    };
    const onAction = vi.fn();
    render(
      <ul>
        <ActivityRow
          amount="3.50"
          unit="tYACA"
          direction="→ V6"
          when="Sep 14"
          line={line}
          onAction={onAction}
          data-testid="row"
        />
        <ActivityRow
          amount="0.50"
          unit="YACA"
          direction="→ here"
          when="Sep 1"
          line={line}
          collapsed
          data-testid="old"
        />
      </ul>,
    );
    expect((screen.getByRole('button', { name: 'Forward to V6' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('row-disabled').textContent).toBe('Connect a wallet on Sepolia first.');
    expect(screen.getByTestId('row').textContent).toContain(
      'or redeem it on Ethereum while the bridge is open.',
    );
    fireEvent.click(screen.getByTestId('row-redeem'));
    expect(onAction).toHaveBeenCalledWith('redeem');
    const old = screen.getByTestId('old');
    expect(old.textContent).toContain('0.50');
    expect(old.textContent).not.toContain('Held on Ethereum');
    expect(old.querySelector('[data-slot="trail"]')).toBeNull();
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
