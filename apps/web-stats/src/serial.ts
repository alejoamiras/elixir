/** Chain reads run one at a time: the poll, a window fetch and a fill page must not each publish a stale whole. */
let inFlight: Promise<void> = Promise.resolve();
export const serial = (fn: () => Promise<void>): Promise<void> => {
  const run = inFlight.then(fn);
  inFlight = run.catch(() => {});
  return run;
};

/** `fn` waits its turn at most once: a call while one is queued joins it, a call during a run queues the next. */
export function coalesced(fn: () => Promise<void>): () => Promise<void> {
  let queued: Promise<void> | undefined;
  return () => {
    if (queued) return queued;
    const run = serial(() => {
      queued = undefined;
      return fn();
    });
    queued = run;
    return run;
  };
}
