// Who a transaction's screens say proves it: a form promises the allowed prover, whatever another
// transaction's proof answers meanwhile; a progress screen hears its own operation alone; the
// ledger's claim line reads the miner's own claim.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, test } from 'vitest';
import { initialPresto, type ProverKind, prestoAtom, txProvingAtom } from '../../presto';
import { useOwnProvingWords, usePromisedTxProver, useTxProver } from './use-tx-prover';

afterEach(cleanup);

let own: { said: (p: ProverKind) => void; reset: () => void };
const Form = () => <span data-testid="form">{usePromisedTxProver()}</span>;
const Ledger = () => <span data-testid="ledger">{useTxProver()}</span>;
const Progress = () => {
  const proving = useOwnProvingWords();
  own = proving;
  return <span data-testid="progress">{proving.words.detail}</span>;
};

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
  test('a screen hears its own operation alone, keeps the answer, and promises again after a reset', () => {
    const store = serving();
    render(
      <Provider store={store}>
        <Form />
        <Progress />
      </Provider>,
    );
    const promised = text('progress');
    // Another transaction proves in the browser while this one waits its turn: neither is told.
    act(() => store.set(txProvingAtom, 'wasm'));
    expect(text('form')).toBe('presto');
    expect(text('progress')).toBe(promised);
    // Its own proof falls back, then ends: the screen keeps the browser's answer.
    act(() => own.said('wasm'));
    act(() => store.set(txProvingAtom, null));
    expect(text('progress')).not.toBe(promised);
    // The next transaction from the same dialog starts from the promise.
    act(() => own.reset());
    expect(text('progress')).toBe(promised);
  });

  test('the ledger’s claim line reads its own claim’s answer, the promise until it has one', () => {
    const store = serving();
    render(
      <Provider store={store}>
        <Ledger />
      </Provider>,
    );
    expect(text('ledger')).toBe('presto');
    act(() => store.set(txProvingAtom, 'wasm'));
    expect(text('ledger')).toBe('wasm');
  });
});
