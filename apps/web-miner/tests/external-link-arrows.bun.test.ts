import { expect, test } from 'bun:test';
import { Glob } from 'bun';

const ROOTS = [
  'packages/web-miner/src',
  'packages/ui/src',
  'packages/web-stats/src',
  'packages/web-landing/src',
];
const REPO = new URL('../../../', import.meta.url).pathname;

/** `ExternalLink` draws its own ↗: one typed into its children makes two. */
async function doubled(): Promise<string[]> {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for await (const file of new Glob('**/*.tsx').scan({ cwd: `${REPO}${root}` })) {
      if (file.endsWith('external-link.tsx')) continue;
      const text = await Bun.file(`${REPO}${root}/${file}`).text();
      for (const m of text.matchAll(/<ExternalLink\b[\s\S]*?<\/ExternalLink>/g))
        if (m[0].includes('↗')) hits.push(`${root}/${file}: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  return hits;
}

test('no ExternalLink carries a second ↗ in its children', async () => {
  expect(await doubled()).toEqual([]);
});
