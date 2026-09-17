// One queue for every bridge operation of a page: a send, an exit, a deposit, a claim, a forward
// never overlap, so two clicks cannot reserve one index or race the wallet's proof. Each operation
// waits for the ones before it, failed or not.
export class OperationQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private refusal: string | null = null;

  /** While set, `run` rejects at once with this reason (a node switch: nothing may straddle two nodes). */
  refuse(reason: string | null): void {
    this.refusal = reason;
  }

  /** Runs `op` after every operation queued before it; its result and failure are the caller's alone. */
  run<T>(op: () => Promise<T>): Promise<T> {
    if (this.refusal !== null) return Promise.reject(new Error(this.refusal));
    this.pending++;
    const run = this.tail.then(op, op).finally(() => {
      this.pending--;
    });
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  /** Operations queued or running. */
  get size(): number {
    return this.pending;
  }

  /** Resolves once everything queued so far has settled. */
  drain(): Promise<void> {
    return this.tail.then(() => {});
  }
}
