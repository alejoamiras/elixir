// The explorer links the landing shows, from the build's configured base.
import { explorer, explorerBase } from '@yacana/site/browser/explorer';

export const links = explorer(explorerBase(import.meta.env.VITE_EXPLORER_URL));
