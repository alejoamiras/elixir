import { expect, test } from 'bun:test';
import { Glob } from 'bun';

const ROOTS = ['apps/web-miner/src', 'packages/ui/src', 'apps/web-stats/src', 'apps/web-landing/src'];
const REPO = new URL('../../../', import.meta.url).pathname;

/** `ExternalLink` draws its own ↗: one typed into its children makes two. */
async function doubled(): Promise<{ hits: string[]; scanned: Record<string, number> }> {
  const hits: string[] = [];
  const scanned: Record<string, number> = {};
  for (const root of ROOTS) {
    scanned[root] = 0;
    for await (const file of new Glob('**/*.tsx').scan({ cwd: `${REPO}${root}` })) {
      scanned[root]++;
      if (file.endsWith('external-link.tsx')) continue;
      const text = await Bun.file(`${REPO}${root}/${file}`).text();
      for (const m of text.matchAll(/<ExternalLink\b[\s\S]*?<\/ExternalLink>/g))
        if (m[0].includes('↗')) hits.push(`${root}/${file}: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  return { hits, scanned };
}

test('no ExternalLink carries a second ↗ in its children', async () => {
  const { hits, scanned } = await doubled();
  // A root that moved would pass by scanning nothing.
  for (const root of ROOTS) expect(scanned[root], root).toBeGreaterThan(0);
  expect(hits).toEqual([]);
});
