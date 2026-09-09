// The prover against a real headless Presto (`presto-server` on loopback, `PRESTO_URL=http://127.0.0.1:<port>`),
// as the homelab and the e2e lane run it: one W proof natively, byte-identical to the WASM proof of the same
// witness and to bb's committed native proof; the winning check on it and on a corrupted copy.
import { describe, expect, test } from 'bun:test';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { BbJsWorkProver, type WorkArtifact, type WorkInputs } from '../../miner-core/src/work.ts';
import { acceleratorUrls, type PrestoEndpoint, type ProverKind } from '../src/presto.ts';
import { PrestoWorkProver, type ProverTransition } from '../src/presto-prover.ts';

const url = process.env.PRESTO_URL;

describe.skipIf(!url)('PrestoWorkProver against a headless Presto', () => {
  const circuit = resolve(import.meta.dir, '../../work-circuit');
  const FIXTURE: WorkInputs = {
    domain: new Fr(1n),
    seed: new Fr(2n),
    epoch: 0n,
    minerCommit: new Fr(3n),
    nonce: 4n,
  };
  const threads = Math.max(1, cpus().length - 1);

  test('proves W natively: the same bytes as WASM and as bb; the win verifies, a corrupted copy does not', async () => {
    const artifact = (await Bun.file(resolve(circuit, 'artifacts/yacana_work.json')).json()) as WorkArtifact;
    const native = new Uint8Array(
      await Bun.file(resolve(circuit, 'fixtures/yacana_work/proof')).arrayBuffer(),
    );
    const u = new URL(url as string);
    const endpoint: PrestoEndpoint = {
      host: u.hostname,
      port: Number(u.port),
      httpsPort: Number(u.port),
      httpsOnly: false,
    };
    // As the Worker does: this realm's guard, if armed by another suite, admits Presto's URLs.
    (await import('../../site/src/browser/node-guard.ts')).setAcceleratorEndpoints(
      acceleratorUrls(endpoint),
      60_000,
    );
    const transitions: { kind: ProverKind; t: ProverTransition }[] = [];
    const phases: string[] = [];
    const api = () => Barretenberg.new({ threads, backend: BackendType.WasmWorker });
    const presto = new PrestoWorkProver(artifact, api, endpoint, {
      prover: (kind, t) => transitions.push({ kind, t }),
      phase: (p) => phases.push(p),
    });
    const wasm = new BbJsWorkProver(artifact, await api());
    try {
      const t0 = performance.now();
      const viaPresto = await presto.prove(FIXTURE);
      const nativeMs = performance.now() - t0;
      const t1 = performance.now();
      const viaWasm = await wasm.prove(FIXTURE);
      const wasmMs = performance.now() - t1;
      expect(transitions).toEqual([{ kind: 'presto', t: { sticky: false } }]);
      expect(phases).not.toContain('fallback');
      expect(Buffer.from(viaPresto.proof).equals(Buffer.from(viaWasm.proof))).toBe(true);
      expect(Buffer.from(viaPresto.proof).equals(Buffer.from(native))).toBe(true);
      expect(viaPresto.out.equals(viaWasm.out)).toBe(true);
      const t2 = performance.now();
      expect(await presto.verifyWin(FIXTURE, viaPresto)).toBe(true);
      const verifyMs = performance.now() - t2;
      // The low byte of one field: still a canonical element, no longer this proof.
      const flipped = new Uint8Array(viaPresto.proof);
      flipped[4096 + 31] ^= 1;
      expect(await presto.verifyWin(FIXTURE, { ...viaPresto, proof: flipped })).toBe(false);
      console.log(
        `presto ${nativeMs.toFixed(0)} ms (phases: ${phases.join(' → ')}) · wasm ${wasmMs.toFixed(0)} ms × ${threads} threads · first verifyWin ${verifyMs.toFixed(0)} ms`,
      );
    } finally {
      await presto.destroy();
      await wasm.destroy();
    }
  }, 600_000);
});
