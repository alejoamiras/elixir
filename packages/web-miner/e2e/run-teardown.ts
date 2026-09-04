// Bun-side E2E teardown: kills exactly the Vite process group this run spawned, releases its port.
import { rmSync } from 'node:fs';
import { release } from '../../../scripts/run/registry.ts';
import { type E2eRun, RUN_FILE } from './run.ts';

const file = Bun.file(RUN_FILE);
if (await file.exists()) {
  const run = (await file.json()) as E2eRun;
  try {
    process.kill(-run.vitePid, 'SIGKILL');
  } catch {
    /* already gone */
  }
  await release(run.runId).catch(() => {});
  rmSync(RUN_FILE, { force: true });
}
