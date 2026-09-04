import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const agentsDir = mkdtempSync(join(tmpdir(), 'elixir-registry-'));
beforeAll(() => {
  process.env.ELIXIR_AGENTS_DIR = agentsDir;
});
afterAll(() => rmSync(agentsDir, { recursive: true, force: true }));

const { claim, release, rows } = await import('./registry.ts');
const base = { worktree: '/wt', base: 20000, span: 4 };

describe('run registry', () => {
  test('claims distinct ports, reaps dead owners, releases by run', async () => {
    const a = await claim({ ...base, runId: 'a', service: 'x', ownerPid: process.pid });
    const b = await claim({ ...base, runId: 'b', service: 'x', ownerPid: process.pid });
    expect(b).toBe(a + 1);
    expect(readFileSync(join(agentsDir, 'ports.md'), 'utf8')).toContain('| port | service | owner (run) |');

    // A row whose owner pid is dead must not block the port (pid 2^22-1 is above pid_max).
    await claim({ ...base, runId: 'dead', service: 'x', ownerPid: 4194303 });
    expect((await rows()).map((r) => r.runId)).toEqual(['a', 'b']);

    await release('a');
    expect((await rows()).map((r) => r.runId)).toEqual(['b']);
    const reused = await claim({ ...base, runId: 'c', service: 'x', ownerPid: process.pid });
    expect(reused).toBe(a);
  });

  test('throws when the lane is exhausted', async () => {
    await claim({ ...base, runId: 'd', service: 'x', ownerPid: process.pid });
    await claim({ ...base, runId: 'e', service: 'x', ownerPid: process.pid });
    await expect(claim({ ...base, runId: 'f', service: 'x', ownerPid: process.pid })).rejects.toThrow(
      /no free port/,
    );
  });
});
