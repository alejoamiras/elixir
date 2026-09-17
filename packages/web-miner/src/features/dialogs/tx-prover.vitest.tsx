// Who a transaction's screens say proves it: a form promises the allowed prover, whatever another
// transaction's proof answers meanwhile; a progress screen keeps the answer its own proof gave; a
// row keeps the answer of the proof the session named it for.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, test } from 'vitest';
import { initialPresto, prestoAtom, txProvingAtom } from '../../presto';
import { provingCrossingAtom } from '../../state';
import { useRowProvers } from '../ActivityList';
import { useHeldTxProver, usePromisedTxProver, useTxProver } from './use-tx-prover';

afterEach(cleanup);

const Form = () => <span data-testid="form">{usePromisedTxProver()}</span>;
const Ledger = () => <span data-testid="ledger">{useTxProver()}</span>;
const Progress = () => <span data-testid="progress">{useHeldTxProver()}</span>;
const Rows = ({ live }: { live: readonly string[] }) => (
  <span data-testid="rows">{JSON.stringify([...useRowProvers((id) => live.includes(id))])}</span>
);

const serving = () => {
  const store = createStore();
  store.set(prestoAtom, {
    ...initialPresto,
    selected: 'presto',
    status: { available: true, needsDownload: false, schemes: ['ultra_honk', 'chonk'], protocol: 'http' },
  });
  return store;
};
const text = (id: string) => screen.getByTestId(id).textContent;

describe('the transaction’s prover on its screens', () => {
  test('a fallback stays with the screen it answered; the next form promises Presto again', () => {
    const store = serving();
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

  test('another transaction’s proof reaches neither a form nor a progress screen mounted under it', () => {
    const store = serving();
    store.set(txProvingAtom, 'wasm');
    render(
      <Provider store={store}>
        <Form />
        <Progress />
      </Provider>,
    );
    expect(text('form')).toBe('presto');
    expect(text('progress')).toBe('presto');
    // That proof ends; this screen's own then falls back.
    act(() => store.set(txProvingAtom, null));
    act(() => store.set(txProvingAtom, 'wasm'));
    expect(text('form')).toBe('presto');
    expect(text('progress')).toBe('wasm');
  });

  test('a row holds the answer of the proof the session named it for, while it still proves or claims', () => {
    const store = serving();
    // A was tapped first and refused: still claiming, never named. B's proof falls back.
    store.set(provingCrossingAtom, 'B');
    store.set(txProvingAtom, 'wasm');
    const tree = (live: readonly string[]) => (
      <Provider store={store}>
        <Rows live={live} />
        <Ledger />
      </Provider>
    );
    const { rerender } = render(tree(['A', 'B']));
    expect(text('rows')).toBe('[["B","wasm"]]');
    // A crossing's proof is not the miner's claim's.
    expect(text('ledger')).toBe('presto');
    // Proof over, the operation still submitting: B keeps its answer. Once the row stops: gone.
    act(() => store.set(txProvingAtom, null));
    expect(text('rows')).toBe('[["B","wasm"]]');
    act(() => store.set(provingCrossingAtom, null));
    rerender(tree(['A']));
    expect(text('rows')).toBe('[]');
    // The miner's own claim, no crossing named: the ledger's line, no row's.
    act(() => store.set(txProvingAtom, 'wasm'));
    expect(text('rows')).toBe('[]');
    expect(text('ledger')).toBe('wasm');
  });
});
