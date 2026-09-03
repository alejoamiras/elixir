// The work: prove W for one nonce. The prover is an interface so the browser Worker (bb.js WASM)
// and a native prover can back the same mining loop.
import { type Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { Noir } from '@aztec/noir-noir_js';
import type { WorkArtifact } from './artifacts.ts';

export interface WorkInputs {
  domain: Fr;
  seed: Fr;
  epoch: bigint;
  minerCommit: Fr;
  nonce: bigint;
}

export interface WorkResult {
  /** 410 × 32 bytes, big-endian fields; the ticket is hashed over exactly this. */
  proof: Uint8Array;
  /** W's public output, supplied to `claim` as `out`. */
  out: Fr;
}

export interface WorkProver {
  prove(inputs: WorkInputs): Promise<WorkResult>;
  destroy(): Promise<void>;
}

export class BbJsWorkProver implements WorkProver {
  private readonly noir: Noir;
  private readonly backend: UltraHonkBackend;

  constructor(
    artifact: WorkArtifact,
    private readonly api: Barretenberg,
  ) {
    // Noir's artifact type is stricter than the JSON we load; the shape is the compiled circuit.
    this.noir = new Noir(artifact as ConstructorParameters<typeof Noir>[0]);
    this.backend = new UltraHonkBackend(artifact.bytecode, api);
  }

  async prove(inputs: WorkInputs): Promise<WorkResult> {
    const { witness, returnValue } = await this.noir.execute({
      domain: inputs.domain.toString(),
      seed: inputs.seed.toString(),
      epoch: inputs.epoch.toString(),
      miner_commit: inputs.minerCommit.toString(),
      nonce: inputs.nonce.toString(),
    });
    const { proof } = await this.backend.generateProof(witness, { verifierTarget: 'noir-recursive-no-zk' });
    return { proof, out: Fr.fromString(String(returnValue)) };
  }

  destroy(): Promise<void> {
    return this.api.destroy();
  }
}
