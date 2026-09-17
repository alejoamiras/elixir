// The wallet's transaction prover on Presto: the private kernel's proof (a claim, a burn, a
// transfer) goes to the native prover on this machine through the SDK, and to WASM in the page
// when Presto steps aside. The SDK's own WASM path logs the PXE's proof event; a proof Presto made
// gets the same event here, with who made it and where its time went, so the e2e meter and the
// breakdown count both.
import { type PrestoPhase, type PrestoPhaseData, PrestoProver } from '@alejoamiras/presto';
import { createLogger } from '@aztec/foundation/log';
import type { PrivateExecutionStep } from '@aztec/stdlib/kernel';
import { type PrestoEndpoint, type ProverKind, prestoConfig } from './presto';

const log = createLogger('web-miner:tx-prover');

export type TxPhase = (phase: PrestoPhase, data?: PrestoPhaseData) => void;

export class TxProver extends PrestoProver {
  /** The UI's listener for the proof under way; the meter's own tracking never depends on it. */
  onPhase: TxPhase | null = null;
  #forced = false;
  #local = false;
  #marks: Record<string, number> = {};
  #t0 = 0;

  constructor(endpoint: PrestoEndpoint) {
    let note: (phase: PrestoPhase) => void = () => {};
    super({
      presto: prestoConfig(endpoint),
      onPhase: (phase, data) => {
        note(phase);
        this.onPhase?.(phase, data);
      },
    });
    // A fallback says WASM proved, and the SDK logged that proof itself; `proved` alone is either
    // side's (the client says it of a remote proof too).
    note = (phase) => {
      this.#marks[phase] = Math.round(performance.now() - this.#t0);
      if (phase === 'fallback') this.#local = true;
    };
  }

  override setForceLocal(force: boolean) {
    this.#forced = force;
    super.setForceLocal(force);
  }

  override async createChonkProof(steps: PrivateExecutionStep[]) {
    this.#local = this.#forced;
    this.#marks = {};
    this.#t0 = performance.now();
    const proof = await super.createChonkProof(steps);
    if (!this.#local)
      log.info('Generated ClientIVC proof through Presto', {
        eventName: 'client-ivc-proof-generation',
        duration: performance.now() - this.#t0,
        prover: 'presto' satisfies ProverKind,
        phases: this.#marks,
      });
    return proof;
  }
}
