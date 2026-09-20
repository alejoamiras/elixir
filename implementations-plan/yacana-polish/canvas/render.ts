// Renders every artboard of canvas.json to a PNG (for the reviewers and the gallery):
//   bun implementations-plan/yacana-polish/canvas/render.ts <out-dir> [Name…]
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const here = resolve(import.meta.dir);
const out = resolve(process.argv[2] ?? join(here, 'render'));
const only = new Set(process.argv.slice(3));
const canvas = JSON.parse(readFileSync(join(here, 'canvas.json'), 'utf8')) as {
  artboards: { file: string; w: number; h: number }[];
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const a of canvas.artboards) {
    const name = a.file.replace('.dc.html', '');
    if (only.size && !only.has(name)) continue;
    const page = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    await page.goto(`file://${join(here, a.file)}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    console.log(`${name}\t${a.w}×${a.h}\tcontent ${height}${height > a.h ? '  ← taller than the frame' : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
