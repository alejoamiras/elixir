// Links into the Ethereum explorer (Etherscan's paths), as guarded as the Aztec explorer's: every
// identifier is validated before it becomes a path segment, and an invalid one yields no link.
import { explorerBase } from './explorer.ts';

const HEX20 = /^0x[0-9a-f]{40}$/;
const HEX32 = /^0x[0-9a-f]{64}$/;

export interface L1Explorer {
  address(address: string): string | undefined;
  tx(hash: string): string | undefined;
  block(n: number | bigint): string | undefined;
  /** An ERC-20's page. */
  token(address: string): string | undefined;
}

export function l1Explorer(raw: string | undefined): L1Explorer {
  const base = explorerBase(raw);
  const at = (path: string, part: string | undefined): string | undefined =>
    base && part !== undefined ? `${base}${path}/${encodeURIComponent(part)}` : undefined;
  const hex = (re: RegExp) => (v: string) => (re.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
  return {
    address: (a) => at('/address', hex(HEX20)(a)),
    tx: (h) => at('/tx', hex(HEX32)(h)),
    block: (n) => at('/block', BigInt(n) > 0n ? BigInt(n).toString() : undefined),
    token: (a) => at('/token', hex(HEX20)(a)),
  };
}
