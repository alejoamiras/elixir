// The Send dialog's one screen: each refusal under its field the moment it is known, the button
// waiting meanwhile; the unknown-recipient probe on leaving the address; what a public send says;
// the receipt. The address parser itself runs Grumpkin through bb.js, which jsdom cannot host, so
// the refusal function is stubbed here and proven in the bun test.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PARAMS } from '@yacana/miner-core/generated/params';
import { createStore, Provider } from 'jotai';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SendDialog } from './features/dialogs/Send';
import { initialPresto, prestoAtom } from './presto';
import type { Session } from './session';

const ONE = 10n ** BigInt(PARAMS.DECIMALS);
const SELF = `0x${'22'.repeat(32)}`;
const OTHER = `0x${'1a'.repeat(32)}`;

vi.mock('./features/withdraw-form', async (importOriginal) => {
  const real = await importOriginal<typeof import('./features/withdraw-form')>();
  return {
    ...real,
    recipientRefusal: async (text: string, self: string) => {
      const t = text.trim();
      if (t === '' || t === OTHER) return null;
      if (t === self) return "That's this account.";
      return 'Not an Aztec address: 66 characters, starting with 0x.';
    },
    review: async (d: { to: string; amount: string; mode: 'private' | 'public' }) => ({
      to: { toString: () => d.to.trim() },
      amount: real.parseAmount(d.amount, PARAMS.DECIMALS),
      mode: d.mode,
      display: d.amount.trim(),
    }),
  };
});

/** The dialog under a host that owns `open`, as the Wallet does: Cancel and Done close it for real. */
const mount = (session: Session) => {
  const store = createStore();
  let setOpen: (open: boolean) => void = () => {};
  function Host() {
    const [open, set] = useState(true);
    setOpen = set;
    return (
      <Provider store={store}>
        <SendDialog session={session} self={SELF} balance={3n * ONE} open={open} onOpenChange={set} />
      </Provider>
    );
  }
  render(<Host />);
  const reopen = () => {
    act(() => setOpen(false));
    act(() => setOpen(true));
  };
  return { reopen, store };
};

const stub = (known: boolean) => {
  const session = {
    recipientKnown: vi.fn(async () => known),
    withdraw: vi.fn(async () => ({ block: 83_140, txHash: `0x${'ab'.repeat(32)}` })),
  };
  return { session: session as unknown as Session, calls: session };
};

afterEach(cleanup);
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

describe('the proving line', () => {
  test('says where the proof will go: the page, or Presto once the Worker keeps it and it serves chonk', () => {
    const { store } = mount(stub(false).session);
    expect(screen.getByText('proves in your browser, about 20 s · mining pauses meanwhile')).toBeTruthy();
    act(() =>
      store.set(prestoAtom, {
        ...initialPresto,
        selected: 'presto',
        status: { available: true, needsDownload: false, schemes: ['ultra_honk', 'chonk'], protocol: 'http' },
      }),
    );
    expect(screen.getByText('proves through Presto ✦, about 5 s · mining pauses meanwhile')).toBeTruthy();
  });
});

describe('the send form', () => {
  test('the refusals sit under their fields; the button waits; leaving an unknown address says so', async () => {
    mount(stub(false).session);
    const send = () => screen.getByTestId('withdraw-send') as HTMLButtonElement;
    const amount = screen.getByTestId('withdraw-amount');
    const to = screen.getByTestId('withdraw-to');
    // Nothing typed: a click asks for the amount and nothing is sent.
    fireEvent.click(send());
    await waitFor(() => expect(screen.getByTestId('amount-refusal').textContent).toBe('Enter an amount.'));
    expect(send().disabled).toBe(true);
    fireEvent.change(amount, { target: { value: '5' } });
    expect(screen.getByTestId('amount-refusal').textContent).toBe('More than your balance.');
    fireEvent.change(amount, { target: { value: '1' } });
    expect(screen.queryByTestId('amount-refusal')).toBeNull();
    expect(send().textContent).toBe(`Send 1 ${PARAMS.TOKEN_SYMBOL} privately`);
    // The address is judged when the field is left, not on every keystroke.
    fireEvent.change(to, { target: { value: SELF } });
    expect(screen.queryByTestId('to-refusal')).toBeNull();
    fireEvent.blur(to);
    await waitFor(() => expect(screen.getByTestId('to-refusal').textContent).toBe("That's this account."));
    expect(send().disabled).toBe(true);
    fireEvent.change(to, { target: { value: '0x1a2b' } });
    fireEvent.blur(to);
    await waitFor(() =>
      expect(screen.getByTestId('to-refusal').textContent).toBe(
        'Not an Aztec address: 66 characters, starting with 0x.',
      ),
    );
    // A good address nothing on the chain knows: the note, and the button still offers the send.
    fireEvent.change(to, { target: { value: OTHER } });
    fireEvent.blur(to);
    await waitFor(() => expect(screen.getByTestId('unknown-recipient')).toBeDefined());
    expect(screen.getByTestId('unknown-recipient').textContent).toContain(
      'Confirm the address with the recipient',
    );
    expect(send().disabled).toBe(false);
  });

  test('public says what becomes readable; the send uses the exact values and the receipt names the block; a reopen starts clean', async () => {
    const { session, calls } = stub(true);
    const { reopen } = mount(session);
    fireEvent.change(screen.getByTestId('withdraw-amount'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('withdraw-to'), { target: { value: OTHER } });
    fireEvent.click(screen.getByRole('radio', { name: /Publicly/ }));
    expect(screen.getByTestId('public-warning').textContent).toContain('This will be public.');
    expect(screen.getByTestId('withdraw-send').textContent).toBe(`Send 1 ${PARAMS.TOKEN_SYMBOL} publicly`);
    expect(screen.queryByTestId('unknown-recipient')).toBeNull();
    fireEvent.click(screen.getByTestId('withdraw-send'));
    await waitFor(() => expect(screen.getByTestId('withdraw-sent')).toBeDefined());
    expect(calls.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({ amount: ONE, mode: 'public', display: '1' }),
      expect.any(Function),
    );
    expect(screen.getByTestId('withdraw-sent').textContent).toContain('block 83,140');
    expect(screen.getByTestId('withdraw-sent').textContent).toContain(
      `1 ${PARAMS.TOKEN_SYMBOL} to 0x1a1a1a…1a1a, publicly.`,
    );
    expect(screen.getByTestId('sent-block').getAttribute('href')).toContain('/blocks/83140');
    // Closed and opened again: a fresh form, not the receipt or the last draft.
    reopen();
    expect(screen.queryByTestId('withdraw-sent')).toBeNull();
    expect((screen.getByTestId('withdraw-to') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByTestId('withdraw-send').textContent).toBe('Send privately');
  });

  test('the click validates once at a time, and a send whose validation outlives Cancel never goes out', async () => {
    const { session, calls } = stub(true);
    const { reopen } = mount(session);
    fireEvent.change(screen.getByTestId('withdraw-amount'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('withdraw-to'), { target: { value: OTHER } });
    // Two clicks while the address is still being checked: one send.
    fireEvent.click(screen.getByTestId('withdraw-send'));
    expect((screen.getByTestId('withdraw-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('withdraw-send'));
    await waitFor(() => expect(screen.getByTestId('withdraw-sent')).toBeDefined());
    expect(calls.withdraw).toHaveBeenCalledTimes(1);
    // A fresh run: the click, then Cancel before the check answers — nothing is sent.
    reopen();
    fireEvent.change(screen.getByTestId('withdraw-amount'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('withdraw-to'), { target: { value: OTHER } });
    fireEvent.click(screen.getByTestId('withdraw-send'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.withdraw).toHaveBeenCalledTimes(1);
  });
});
