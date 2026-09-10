import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalTeardown(): void {
  execFileSync('bun', ['e2e/replay/setup.ts', 'teardown'], {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: 'inherit',
  });
}
