// The WebAuthn ceremony that turns a passkey into a 32-byte secret (CTAP2 hmac-secret through the
// PRF extension). `navigator.credentials.*` must be the first await after the click: a consumed
// user gesture makes the browser throw NotAllowedError.
export interface PasskeyResult {
  credentialId: Uint8Array;
  prf: Uint8Array;
}

/** The authenticator made a credential but cannot evaluate PRF: the key screen offers the words. */
export class NoPrfError extends Error {
  override readonly name = 'NoPrfError';
}

const PRF_LABEL = 'yacana.passkey.prf.v1';
const TIMEOUT_MS = 120_000;
const ALGORITHMS: PublicKeyCredentialParameters[] = [
  { type: 'public-key', alg: -7 }, // ES256
  { type: 'public-key', alg: -257 }, // RS256
];

// Hashed at import so the click handler never awaits anything before the ceremony.
let prfInput: ArrayBuffer | undefined;
const prfInputReady = crypto.subtle.digest('SHA-256', new TextEncoder().encode(PRF_LABEL)).then((d) => {
  prfInput = d;
  return d;
});
export const preparePasskeys = (): Promise<ArrayBuffer> => prfInputReady;

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const toBuffer = (u: Uint8Array): BufferSource => u as BufferSource;

type PrfOutputs = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

const prfOf = (cred: PublicKeyCredential): { enabled: boolean; first?: Uint8Array } => {
  const ext = cred.getClientExtensionResults() as PrfOutputs;
  const first = ext.prf?.results?.first;
  return {
    enabled: ext.prf?.enabled === true || first !== undefined,
    ...(first && { first: new Uint8Array(first) }),
  };
};

const requirePrf = (bytes: Uint8Array | undefined): Uint8Array => {
  if (!bytes) throw new NoPrfError('the authenticator returned no PRF output');
  if (bytes.length !== 32) throw new Error(`PRF output is ${bytes.length} bytes, expected 32`);
  return bytes;
};

const input = (): ArrayBuffer => {
  if (!prfInput) throw new Error('passkeys not prepared: await preparePasskeys() before the click');
  return prfInput;
};

export interface CeremonyOptions {
  rpId: string;
  credentials?: CredentialsContainer;
  signal?: AbortSignal;
}

/**
 * Creates a discoverable, user-verified credential and evaluates PRF on it. Some authenticators
 * report `prf.enabled` on creation but only evaluate on assertion; then one assertion follows.
 * Without PRF at all, NoPrfError.
 */
export async function createPasskey(
  o: CeremonyOptions & { userName: string; exclude?: Uint8Array[] },
): Promise<PasskeyResult> {
  const first = input();
  const credentials = o.credentials ?? navigator.credentials;
  const cred = (await credentials.create({
    ...(o.signal && { signal: o.signal }),
    publicKey: {
      rp: { id: o.rpId, name: 'Yacana' },
      user: { id: toBuffer(random(16)), name: o.userName, displayName: o.userName },
      challenge: toBuffer(random(32)),
      pubKeyCredParams: ALGORITHMS,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      attestation: 'none',
      timeout: TIMEOUT_MS,
      excludeCredentials: (o.exclude ?? []).map((id) => ({ type: 'public-key', id: toBuffer(id) })),
      extensions: { prf: { eval: { first } } },
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('no credential was created');
  const credentialId = new Uint8Array(cred.rawId);
  const prf = prfOf(cred);
  if (prf.first) return { credentialId, prf: requirePrf(prf.first) };
  if (!prf.enabled) throw new NoPrfError('this authenticator does not support PRF');
  return assertPasskey({ ...o, allow: [credentialId] });
}

/** One touch: evaluates PRF on an existing credential (`allow`), or a discoverable one when omitted. */
export async function assertPasskey(o: CeremonyOptions & { allow?: Uint8Array[] }): Promise<PasskeyResult> {
  const first = input();
  const credentials = o.credentials ?? navigator.credentials;
  const cred = (await credentials.get({
    ...(o.signal && { signal: o.signal }),
    publicKey: {
      rpId: o.rpId,
      challenge: toBuffer(random(32)),
      userVerification: 'required',
      timeout: TIMEOUT_MS,
      ...(o.allow && { allowCredentials: o.allow.map((id) => ({ type: 'public-key', id: toBuffer(id) })) }),
      extensions: { prf: { eval: { first } } },
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('no credential was returned');
  return { credentialId: new Uint8Array(cred.rawId), prf: requirePrf(prfOf(cred).first) };
}
