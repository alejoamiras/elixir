// What the page fetches besides its bundle: the pinned CRS, the contract artifacts, and the slot
// table with the storage layouts (the public epoch poll reads epochs through them before an
// account is open, the way the stats page does). This package's own `build` writes its `dist` for
// local previews and the E2E; nothing deploys it — the site assembles the miner under `/mine/`.
import { resolve } from 'node:path';
import { copyArtifacts } from '../../site/scripts/copy-artifacts.ts';
import { copySlots } from '../../site/scripts/copy-slots.ts';
import { fetchCrs } from '../../site/scripts/fetch-crs.ts';

const publicDir = resolve(import.meta.dir, '../public');
await fetchCrs(publicDir);
await copyArtifacts(publicDir);
console.log(await copySlots(publicDir));
