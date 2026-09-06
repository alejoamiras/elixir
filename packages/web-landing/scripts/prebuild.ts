// What the page fetches besides its bundle: the pinned CRS and the work circuit (the demo), the
// slot table and the storage layouts (the live strip); all under public/, all gitignored.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { copySlots } from '../../site/scripts/copy-slots.ts';

const pkg = resolve(import.meta.dir, '..');
const site = resolve(pkg, '../site/scripts');
for (const script of ['fetch-crs.ts', 'copy-artifacts.ts'])
  execFileSync('bun', [resolve(site, script), 'public'], { cwd: pkg, stdio: 'inherit' });
console.log(await copySlots(resolve(pkg, 'public')));
