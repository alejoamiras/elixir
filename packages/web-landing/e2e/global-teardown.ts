import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalTeardown(): void {
  execFileSync('bun', ['e2e/run-teardown.ts'], { cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit' });
}
