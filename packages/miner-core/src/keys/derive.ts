// A key is a 32-byte master; the master is the passkey's PRF output or the twelve words, through
// HKDF-SHA256 with versioned labels. Every label is pinned by derive.test.ts: changing one moves
// every user's address. WebCrypto only (Bun and browsers).
import { Fq, Fr } from '@aztec/foundation/curves/bn254';

export interface AccountFields {
  secret: Fr;
  salt: Fr;
  signingKey: Fq;
}

const te = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

const KDF_SALT_LABEL = 'yacana.kdf.v1';
const MASTER_INFO = 'yacana.master.v1';
const MASTER_WORDS_INFO = 'yacana.master.words.v1';
const ACCOUNT_INFO = 'yacana.account.v1';

async function hkdf(ikm: Uint8Array, info: string, bytes: number): Promise<Uint8Array> {
  const salt = await subtle().digest('SHA-256', te.encode(KDF_SALT_LABEL));
  const key = await subtle().importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: te.encode(info) },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** The PRF result must be exactly 32 bytes; anything else fails closed (a short PRF is a broken authenticator). */
export async function masterFromPrf(prf: Uint8Array): Promise<Uint8Array> {
  if (prf.length !== 32) throw new Error(`PRF output is ${prf.length} bytes, expected 32`);
  return hkdf(prf, MASTER_INFO, 32);
}

/** From a validated bip39 seed (64 bytes); the caller validates the phrase. */
export async function masterFromSeed(seed: Uint8Array): Promise<Uint8Array> {
  if (seed.length !== 64) throw new Error(`bip39 seed is ${seed.length} bytes, expected 64`);
  return hkdf(seed, MASTER_WORDS_INFO, 32);
}

/**
 * Account `index` of a master: 64 HKDF bytes per label, reduced into the field (the repo's
 * `secret.ts` pattern, bias 2^-190). Index 0 is the one account of every key today; the index
 * exists so a later plan can add more without moving it.
 */
export async function deriveAccountFields(master: Uint8Array, index: number): Promise<AccountFields> {
  if (master.length !== 32) throw new Error(`master is ${master.length} bytes, expected 32`);
  if (!Number.isInteger(index) || index < 0)
    throw new Error(`account index ${index} is not a natural number`);
  const bytes = (label: string) => hkdf(master, `${ACCOUNT_INFO}:${label}:${index}`, 64);
  const [secret, salt, signing] = await Promise.all([bytes('secret'), bytes('salt'), bytes('signing')]);
  return {
    secret: Fr.fromBufferReduce(Buffer.from(secret)),
    salt: Fr.fromBufferReduce(Buffer.from(salt)),
    signingKey: Fq.fromBufferReduce(Buffer.from(signing)),
  };
}
