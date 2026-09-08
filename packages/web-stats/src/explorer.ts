// The explorer links the stats pages show, from the build's configured base.
import { explorer, explorerBase } from '../../site/src/browser/explorer.ts';

export const links = explorer(explorerBase(import.meta.env.VITE_EXPLORER_URL));
