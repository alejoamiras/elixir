// The prover needs threads and gigabytes; a phone browser gives neither. The check is the layout's
// width or a coarse pointer without SharedArrayBuffer, never the user agent.
export const isDesktop = (
  w: Pick<Window, 'innerWidth' | 'matchMedia'>,
  sab = typeof SharedArrayBuffer !== 'undefined',
): boolean => w.innerWidth >= 900 && !(w.matchMedia('(pointer: coarse)').matches && !sab);
