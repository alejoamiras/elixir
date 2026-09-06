import { useCallback, useEffect, useRef, useState } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { expectedDeployment } from '../../../site/src/browser/connection.ts';
import { createDemoWorker, type DemoJob } from '../../../web-miner/src/demo/index.ts';
import { type DemoState, demoThreads, runDemo } from './machine';

/** The job for the open epoch, or null while its seed is unknown. */
export function demoJob(open: EpochRow | undefined, miner: string): DemoJob | null {
  if (!open || open.seed === undefined) return null;
  const expected = expectedDeployment();
  return {
    chainId: expected.chainId,
    rollupVersion: expected.rollupVersion,
    miner,
    version: PARAMS.VERSION,
    seed: `0x${open.seed.toString(16).padStart(64, '0')}`,
    epoch: BigInt(open.epoch),
    target: open.target,
    threads: demoThreads(navigator.hardwareConcurrency || 1),
  };
}

/** One demo at a time; a run still going when the page leaves is terminated with it. */
export function useDemo() {
  const [state, setState] = useState<DemoState>({ phase: 'before' });
  const running = useRef(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const start = useCallback(async (job: DemoJob) => {
    if (running.current) return;
    running.current = true;
    try {
      await runDemo(
        job,
        {
          worker: () => {
            worker.current = createDemoWorker();
            return worker.current;
          },
        },
        setState,
      );
    } finally {
      worker.current = null;
      running.current = false;
    }
  }, []);
  return { state, start };
}
