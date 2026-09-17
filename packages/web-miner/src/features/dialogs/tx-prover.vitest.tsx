// Who a transaction's screens say proves it: the form promises the allowed prover; a progress
// screen keeps the answer its own proof gave after the proof ends; the next form is not told it.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, test } from 'vitest';
import { initialPresto, prestoAtom, txProvingAtom } from '../../presto';
import { useHeldTxProver, useTxProver } from './use-tx-prover';

afterEach(cleanup);

const Form = () => <span data-testid="form">{useTxProver()}</span>;
const Progress = () => <span data-testid="progress">{useHeldTxProver()}</span>;

describe('the transaction’s prover on its screens', () => {
  test('a fallback stays with the screen it answered; the next form promises Presto again', () => {
    const store = createStore();
    store.set(prestoAtom, {
      ...initialPresto,
      selected: 'presto',
      status: { available: true, needsDownload: false, schemes: ['ultra_honk', 'chonk'], protocol: 'http' },
    });
    const { rerender } = render(
      <Provider store={store}>
        <Progress key="first" />
      </Provider>,
    );
    expect(screen.getByTestId('progress').textContent).toBe('presto');
    // The proof falls back mid-way, then ends: the screen keeps the browser's answer.
    act(() => store.set(txProvingAtom, 'wasm'));
    expect(screen.getByTestId('progress').textContent).toBe('wasm');
    act(() => store.set(txProvingAtom, null));
    expect(screen.getByTestId('progress').textContent).toBe('wasm');
    // The next transaction's form, and its own progress screen once it proves: the promise, not the last answer.
    rerender(
      <Provider store={store}>
        <Form />
        <Progress key="second" />
      </Provider>,
    );
    expect(screen.getByTestId('form').textContent).toBe('presto');
    expect(screen.getByTestId('progress').textContent).toBe('presto');
    act(() => store.set(txProvingAtom, 'presto'));
    expect(screen.getByTestId('form').textContent).toBe('presto');
    expect(screen.getByTestId('progress').textContent).toBe('presto');
  });
});
