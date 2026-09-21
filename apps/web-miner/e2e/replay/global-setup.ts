import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Playwright runs under Node; the real work happens in a Bun script (setup.ts).
export default function globalSetup(): void {
  execFileSync('bun', ['e2e/replay/setup.ts', 'serve'], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, E2E_OWNER_PID: String(process.pid) },
    stdio: 'inherit',
  });
}
