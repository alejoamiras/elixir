// The work prover through Presto: the same circuit and witness as bb.js, proved by the native app
// when it answers and by the WASM backend inside the same object when it does not — on the same
// witness, so the mining loop (which holds this prover for a whole run of nonces) never notices.
import {
  type PrestoPhase,
  PrestoUltraHonkBackend,
  PrestoUnavailableError,
  type VerifierTarget,
} from '@alejoamiras/presto-noir';
import type { Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { Noir } from '@aztec/noir-noir_js';
import { PROOF_FIELDS } from '../../miner-core/src/proof.ts';
import type { WorkArtifact, WorkInputs, WorkProver, WorkResult } from '../../miner-core/src/work.ts';
import { W_VK_BYTES } from '../../work-circuit/src/generated/vk.ts';
import { type FallbackCause, type PrestoEndpoint, type ProverKind, prestoConfig } from './presto';

const TARGET: VerifierTarget = 'noir-recursive-no-zk';
/** The bb release both provers must share, or their proofs would differ for one witness. */
const BB_VERSION = '5.2.0';
/** Busy answers in a row (429/503/408/413 — other tabs share Presto's queue) before WASM is for good. */
const TRANSIENT_LIMIT = 3;

export interface ProverTransition {
  /** True when WASM is now the prover for the rest of this Worker's life (until a rebuild). */
  sticky: boolean;
  reason?: FallbackCause;
}

export interface PrestoProverHooks {
  /** Every change of what actually proved: the page's ✦ follows this, not the construction. */
  prover: (kind: ProverKind, t: ProverTransition) => void;
  phase?: (p: PrestoPhase) => void;
}

const field = (v: Fr | bigint): string => (v instanceof Fr ? v : new Fr(v)).toString();

/** bn254's scalar modulus, big-endian: bb.js throws on an element at or above it instead of rejecting the proof. */
const MODULUS_BYTES = Buffer.from(Fr.MODULUS.toString(16).padStart(64, '0'), 'hex');

/** W's proof shape with every element canonical — the only bytes the digest and the verifier may see. */
function wellFormed(proof: Uint8Array): boolean {
  if (proof.length !== PROOF_FIELDS * 32) return false;
  for (let i = 0; i < proof.length; i += 32) {
    if (Buffer.from(proof.subarray(i, i + 32)).compare(MODULUS_BYTES) >= 0) return false;
  }
  return true;
}

export class PrestoWorkProver implements WorkProver {
  private readonly noir: Noir;
  private readonly backend: PrestoUltraHonkBackend;
  private stuck: FallbackCause | undefined;
  private transients = 0;
  private reported: ProverKind | null = null;
  private last: ProverKind = 'wasm';

  constructor(
    artifact: WorkArtifact,
    api: () => Promise<Barretenberg>,
    endpoint: PrestoEndpoint,
    private readonly on: PrestoProverHooks,
  ) {
    this.noir = new Noir(artifact as ConstructorParameters<typeof Noir>[0]);
    // `fallback: 'none'`: the typed reason decides here whether WASM is for one witness or for good.
    this.backend = new PrestoUltraHonkBackend(artifact.bytecode, api, {
      bbVersion: BB_VERSION,
      presto: prestoConfig(endpoint),
      fallback: 'none',
      verificationKey: { bytes: W_VK_BYTES, verifierTarget: TARGET },
      onPhase: (p) => on.phase?.(p),
    });
  }

  /** What proves the next witness. */
  get active(): ProverKind {
    return this.stuck ? 'wasm' : 'presto';
  }

  /** Who made the last proof returned — a busy Presto's witness was proved in WASM even while `active` is native. */
  get lastProver(): ProverKind {
    return this.last;
  }

  async prove(inputs: WorkInputs): Promise<WorkResult> {
    const { witness, returnValue } = await this.noir.execute({
      domain: inputs.domain.toString(),
      seed: inputs.seed.toString(),
      epoch: inputs.epoch.toString(),
      miner_commit: inputs.minerCommit.toString(),
      nonce: inputs.nonce.toString(),
    });
    const out = Fr.fromString(String(returnValue));
    if (this.stuck) return { proof: await this.local(witness), out };
    try {
      const { proof } = await this.backend.generateProof(witness, { verifierTarget: TARGET });
      // The SDK checks whole fields, not W's count nor canonicity: a foreign answer never reaches the digest.
      if (!wellFormed(proof)) {
        this.stick('malformed-response');
        return { proof: await this.local(witness), out };
      }
      this.transients = 0;
      this.last = 'presto';
      this.report('presto', { sticky: false });
      return { proof, out };
    } catch (e) {
      if (!(e instanceof PrestoUnavailableError)) throw e;
      if (e.reason === 'transient' && ++this.transients < TRANSIENT_LIMIT) {
        this.report('wasm', { sticky: false });
        return { proof: await this.local(witness), out };
      }
      this.stick(e.reason);
      return { proof: await this.local(witness), out };
    }
  }

  /**
   * A native winning proof checked by the WASM verifier against the job's own public inputs (W's
   * order; `out` came from the local execute), never against anything Presto said. False means the
   * accelerator lied or broke: the caller flips to WASM and re-proves the nonce.
   */
  async verifyWin(inputs: WorkInputs, result: WorkResult): Promise<boolean> {
    const publicInputs = [
      inputs.domain,
      inputs.seed,
      inputs.epoch,
      inputs.minerCommit,
      inputs.nonce,
      result.out,
    ].map(field);
    try {
      return await this.backend.verifyProof(
        { proof: result.proof, publicInputs },
        { verifierTarget: TARGET },
      );
    } catch {
      // The verifier throws on malformed input; from an accelerator that is a failed verification, not a crash.
      return false;
    }
  }

  /** WASM for good, with the reason the page shows; a rebuild is the only way back to native. */
  forceLocal(reason: FallbackCause): void {
    this.stick(reason);
  }

  destroy(): Promise<void> {
    return this.backend.destroy();
  }

  private stick(reason: FallbackCause) {
    if (this.stuck) return;
    this.stuck = reason;
    this.backend.setForceLocal(true);
    this.reported = 'wasm';
    this.on.prover('wasm', { sticky: true, reason });
  }

  private report(kind: ProverKind, t: ProverTransition) {
    if (this.reported === kind) return;
    this.reported = kind;
    this.on.prover(kind, t);
  }

  /** One witness through the backend's own WASM path; native is tried again next time unless stuck. */
  private async local(witness: Uint8Array): Promise<Uint8Array> {
    this.backend.setForceLocal(true);
    try {
      const { proof } = await this.backend.generateProof(witness, { verifierTarget: TARGET });
      this.last = 'wasm';
      return proof;
    } finally {
      if (!this.stuck) this.backend.setForceLocal(false);
    }
  }
}
