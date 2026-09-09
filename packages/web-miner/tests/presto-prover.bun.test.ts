// The prover against a fake Presto on loopback: what it sends, when it sticks to WASM, when it
// gives native another chance, and that a winning native proof is verified against the job's own
// public inputs. WASM proofs are real (bb.js in this process), so the suite proves W a few times.
import { beforeAll, describe, expect, test } from 'bun:test';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { PROOF_FIELDS } from '../../miner-core/src/proof.ts';
import type { WorkArtifact, WorkInputs } from '../../miner-core/src/work.ts';
import { W_VK_BYTES } from '../../work-circuit/src/generated/vk.ts';
import { acceleratorUrls, type PrestoEndpoint, type ProverKind } from '../src/presto.ts';
import { PrestoWorkProver, type ProverTransition } from '../src/presto-prover.ts';

const circuit = resolve(import.meta.dir, '../../work-circuit');
const artifact = (await Bun.file(resolve(circuit, 'artifacts/yacana_work.json')).json()) as WorkArtifact;
// Prover.toml's inputs and the proof bb made of them, committed beside the VK.
const FIXTURE: WorkInputs = {
  domain: new Fr(1n),
  seed: new Fr(2n),
  epoch: 0n,
  minerCommit: new Fr(3n),
  nonce: 4n,
};
const fixtureProof = new Uint8Array(
  await Bun.file(resolve(circuit, 'fixtures/yacana_work/proof')).arrayBuffer(),
);
const fixtureInputs = new Uint8Array(
  await Bun.file(resolve(circuit, 'fixtures/yacana_work/public_inputs')).arrayBuffer(),
);
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

type Answer = { status: number; body: unknown } | 'fixture';

/** One fake per suite: `/health` says a current Presto; `/prove/ultra-honk` answers from the script. */
function fakePresto() {
  const requests: { path: string; body: Record<string, unknown> | null }[] = [];
  const script: Answer[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const path = new URL(req.url).pathname;
      const body = req.method === 'POST' ? ((await req.json()) as Record<string, unknown>) : null;
      requests.push({ path, body });
      if (path === '/health')
        return Response.json({
          status: 'ok',
          api_version: 1,
          schemes: ['chonk', 'ultra_honk'],
          version: '1.1.1',
          aztec_version: '5.2.0',
          available_versions: ['5.2.0'],
          versions: [{ aztec_version: '5.2.0', bb_version: '5.2.0' }],
          bb_available: true,
        });
      const next = script.shift();
      if (next === undefined) return Response.json({ error: 'unscripted' }, { status: 500 });
      if (next === 'fixture')
        return Response.json({ proof: b64(fixtureProof), public_inputs: b64(fixtureInputs) });
      return Response.json(next.body, { status: next.status });
    },
  });
  const endpoint: PrestoEndpoint = {
    host: '127.0.0.1',
    port: Number(server.port),
    httpsPort: 1,
    httpsOnly: false,
  };
  return { server, requests, script, endpoint, proves: () => requests.filter((r) => r.path !== '/health') };
}

const api = () =>
  Barretenberg.new({ threads: Math.max(1, cpus().length - 1), backend: BackendType.WasmWorker });

function prover(endpoint: PrestoEndpoint) {
  const transitions: { kind: ProverKind; t: ProverTransition }[] = [];
  const p = new PrestoWorkProver(artifact, api, endpoint, {
    prover: (kind, t) => transitions.push({ kind, t }),
  });
  return { p, transitions };
}

let fake: ReturnType<typeof fakePresto>;
beforeAll(async () => {
  fake = fakePresto();
  // Another suite in this process may have armed the node guard over `fetch`: admit the fake as the
  // Worker admits Presto, or the SDK's requests die at the guard and every test reads as `network`.
  const guard = await import('../../site/src/browser/node-guard.ts');
  guard.setAcceleratorEndpoints(acceleratorUrls(fake.endpoint), 60_000);
});

describe('PrestoWorkProver', () => {
  test('sends the circuit, the witness and the pinned VK; a native answer is the proof, native is reported once', async () => {
    fake.script.push('fixture', 'fixture');
    const { p, transitions } = prover(fake.endpoint);
    try {
      const first = await p.prove(FIXTURE);
      const second = await p.prove(FIXTURE);
      expect(Buffer.from(first.proof).equals(Buffer.from(fixtureProof))).toBe(true);
      expect(second.proof.length).toBe(PROOF_FIELDS * 32);
      const sent = fake.proves()[0]?.body ?? {};
      expect(sent.bytecode).toBe(artifact.bytecode);
      expect(sent.verifier_target).toBe('noir-recursive-no-zk');
      expect(Buffer.from(String(sent.vk), 'base64').equals(Buffer.from(W_VK_BYTES))).toBe(true);
      // A gzip stream: the compressed witness, never the inputs in the clear.
      expect(Buffer.from(String(sent.witness), 'base64').subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
      expect(transitions).toEqual([{ kind: 'presto', t: { sticky: false } }]);
      expect(p.active).toBe('presto');
    } finally {
      await p.destroy();
    }
  }, 120_000);

  test('a winning native proof verifies against the job’s own public inputs; a corrupted one does not', async () => {
    fake.script.push('fixture');
    const { p } = prover(fake.endpoint);
    try {
      const result = await p.prove(FIXTURE);
      const t0 = performance.now();
      expect(await p.verifyWin(FIXTURE, result)).toBe(true);
      console.log(`first verifyWin (WASM init + VK) ${(performance.now() - t0).toFixed(0)} ms`);
      const flipped = new Uint8Array(result.proof);
      flipped[100] ^= 1;
      expect(await p.verifyWin(FIXTURE, { ...result, proof: flipped })).toBe(false);
      expect(await p.verifyWin({ ...FIXTURE, nonce: 5n }, result)).toBe(false);
    } finally {
      await p.destroy();
    }
  }, 180_000);

  test('a denial sticks: one WASM proof with the reason, and no further request to Presto', async () => {
    fake.script.push({ status: 403, body: { error: 'origin_denied', message: 'denied' } });
    const { p, transitions } = prover(fake.endpoint);
    try {
      const before = fake.proves().length;
      const a = await p.prove(FIXTURE);
      const b = await p.prove(FIXTURE);
      expect(a.proof.length).toBe(PROOF_FIELDS * 32);
      expect(Buffer.from(a.proof).equals(Buffer.from(b.proof))).toBe(true); // WASM is deterministic on one witness
      expect(fake.proves().length - before).toBe(1);
      expect(transitions).toEqual([{ kind: 'wasm', t: { sticky: true, reason: 'denied' } }]);
      expect(p.active).toBe('wasm');
    } finally {
      await p.destroy();
    }
  }, 180_000);

  test('a busy Presto gets three chances: WASM for that nonce, native next, sticky on the third in a row', async () => {
    const busy = { status: 429, body: { error: 'origin_queue_full', message: 'busy' } };
    fake.script.push(busy, 'fixture', busy, busy, busy);
    const { p, transitions } = prover(fake.endpoint);
    try {
      const before = fake.proves().length;
      await p.prove(FIXTURE); // busy → WASM, one chance used
      await p.prove(FIXTURE); // native again, the count resets
      await p.prove(FIXTURE); // busy
      await p.prove(FIXTURE); // busy
      await p.prove(FIXTURE); // busy: sticky
      await p.prove(FIXTURE); // WASM, no request
      expect(fake.proves().length - before).toBe(5);
      expect(transitions.map((x) => [x.kind, x.t.sticky, x.t.reason])).toEqual([
        ['wasm', false, undefined],
        ['presto', false, undefined],
        ['wasm', false, undefined],
        ['wasm', true, 'transient'],
      ]);
    } finally {
      await p.destroy();
    }
  }, 300_000);

  test('a proof of the right length with an element above the modulus never reaches the digest: sticky, malformed', async () => {
    fake.script.push({
      status: 200,
      body: { proof: b64(new Uint8Array(PROOF_FIELDS * 32).fill(0xff)), public_inputs: b64(fixtureInputs) },
    });
    const { p, transitions } = prover(fake.endpoint);
    try {
      const r = await p.prove(FIXTURE);
      expect(r.proof.length).toBe(PROOF_FIELDS * 32);
      expect(transitions).toEqual([{ kind: 'wasm', t: { sticky: true, reason: 'malformed-response' } }]);
      // And the verifier's own throw on such bytes is a false, not an exception, for the Worker.
      expect(await p.verifyWin(FIXTURE, { ...r, proof: new Uint8Array(PROOF_FIELDS * 32).fill(0xff) })).toBe(
        false,
      );
    } finally {
      await p.destroy();
    }
  }, 180_000);

  test('a well-formed answer of the wrong length sticks as malformed', async () => {
    fake.script.push({
      status: 200,
      body: { proof: b64(new Uint8Array(64)), public_inputs: b64(fixtureInputs) },
    });
    const { p, transitions } = prover(fake.endpoint);
    try {
      const r = await p.prove(FIXTURE);
      expect(r.proof.length).toBe(PROOF_FIELDS * 32);
      expect(transitions).toEqual([{ kind: 'wasm', t: { sticky: true, reason: 'malformed-response' } }]);
    } finally {
      await p.destroy();
    }
  }, 180_000);
});
