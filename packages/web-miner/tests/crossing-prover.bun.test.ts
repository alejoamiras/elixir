// Whose a proof's answer is: the crossing its operation named, for as long as that row proves or
// claims — said by the session, so neither tap order nor a list mounted later changes it.
import { describe, expect, test } from 'bun:test';
import { createStore } from 'jotai';
import type { Crossing } from '../../bridge/src/journal.ts';
import { OperationQueue } from '../../bridge/src/queue.ts';
import { type BridgeContext, claimArrival } from '../src/bridge/flows.ts';
import { BridgeSession } from '../src/bridge/session.ts';
import type { ProverKind } from '../src/presto.ts';
import { claimingAtom, crossingProversAtom, provingCrossingAtom } from '../src/state.ts';

interface Attribution {
  proverSaid: (prover: ProverKind) => void;
  forgetProvers: (list: readonly Pick<Crossing, 'id' | 'state'>[]) => void;
}
const sessionOn = (store: ReturnType<typeof createStore>, said?: (p: ProverKind) => void): Attribution =>
  Object.assign(Object.create(BridgeSession.prototype), { d: { store }, said });

describe('a crossing’s prover', () => {
  test('an answer goes to the named crossing and its operation’s listener; an unnamed proof to neither', () => {
    const store = createStore();
    const heard: ProverKind[] = [];
    const s = sessionOn(store, (p) => heard.push(p));
    s.proverSaid('wasm');
    expect(store.get(crossingProversAtom).size).toBe(0);
    store.set(provingCrossingAtom, 'B');
    s.proverSaid('wasm');
    expect([...store.get(crossingProversAtom)]).toEqual([['B', 'wasm']]);
    expect(heard).toEqual(['wasm']);
  });

  test('an answer is kept while its crossing is named, proving or claiming, and no longer', () => {
    const store = createStore();
    const s = sessionOn(store);
    store.set(
      crossingProversAtom,
      new Map<string, ProverKind>([
        ['named', 'wasm'],
        ['proving', 'wasm'],
        ['claiming', 'presto'],
        ['sent', 'wasm'],
      ]),
    );
    store.set(provingCrossingAtom, 'named');
    store.set(claimingAtom, new Map([['claiming', 1]]));
    s.forgetProvers([
      { id: 'proving', state: 'proving' },
      { id: 'sent', state: 'sent' },
    ]);
    expect([...store.get(crossingProversAtom).keys()]).toEqual(['named', 'proving', 'claiming']);
  });

  test('a refused operation leaves no name behind for the next one’s proof', async () => {
    const names: (string | null)[] = [];
    const ctx = { queue: new OperationQueue(), proving: (id: string | null) => names.push(id) };
    const refused = claimArrival(ctx as unknown as BridgeContext, { id: 'A' } as Crossing);
    await expect(refused).rejects.toThrow('nothing to claim');
    expect(names).toEqual([null]);
  });
});
