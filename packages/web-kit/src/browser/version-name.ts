// Aztec numbers its versions by Registry index, and that is how the pages name them (V5, V6): this
// build's index comes from the record once the portal registered it, the next version's from the
// migration block. A version whose index is unknown is named by the rollup's own number.
export const versionName = (index: string | bigint | undefined, number: string | bigint): string =>
  index !== undefined && index !== '' ? `V${index}` : `V${number}`;

export const ownVersionName = (): string =>
  versionName(import.meta.env.VITE_VERSION_INDEX, import.meta.env.VITE_ROLLUP_VERSION);
