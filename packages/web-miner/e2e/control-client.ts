// The spec's side of the run's control server (tools/localnet/src/control.ts). No imports: Playwright's
// loader reads this file.
export interface Control {
  /** Warps the source node past the exit's epoch and proves it: the Outbox root is on Ethereum. */
  settle(): Promise<void>;
  /** Publishes the checkpoints a fresh Inbox message needs before the node serves it. */
  nudge(): Promise<void>;
  /** The operator's forward of every archived exit: what Yacana does by hand. */
  forward(): Promise<{ forwarded: number; failed: number }>;
  call<T = unknown>(name: string, body?: unknown): Promise<T>;
}

export const control = (url: string): Control => {
  const call = async <T>(name: string, body: unknown = {}): Promise<T> => {
    const res = await fetch(`${url}/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const reply = (await res.json()) as { ok: boolean; result?: T; error?: string };
    if (!reply.ok) throw new Error(`control ${name}: ${reply.error}`);
    return reply.result as T;
  };
  return {
    settle: () => call('settle'),
    nudge: () => call('nudge'),
    forward: () => call('forward'),
    call,
  };
};
