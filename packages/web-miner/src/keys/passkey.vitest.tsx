import { beforeAll, describe, expect, test, vi } from 'vitest';
import { assertPasskey, createPasskey, NoPrfError, preparePasskeys } from './passkey';

type Options = { publicKey: PublicKeyCredentialCreationOptions & PublicKeyCredentialRequestOptions };

/** A CredentialsContainer that records the options and answers with the given PRF behaviour. */
function fakeAuthenticator(behaviour: 'prf' | 'enabled-only' | 'none') {
  const creates: Options[] = [];
  const gets: Options[] = [];
  const rawId = new Uint8Array([9, 9, 9]).buffer;
  const output = new Uint8Array(32).fill(7).buffer;
  const credential = (withPrf: boolean) =>
    ({
      rawId,
      getClientExtensionResults: () =>
        behaviour === 'none'
          ? {}
          : withPrf
            ? { prf: { enabled: true, results: { first: output } } }
            : { prf: { enabled: true } },
    }) as unknown as PublicKeyCredential;
  const container = {
    create: vi.fn(async (o: Options) => {
      creates.push(o);
      return credential(behaviour === 'prf');
    }),
    get: vi.fn(async (o: Options) => {
      gets.push(o);
      return credential(true);
    }),
  } as unknown as CredentialsContainer;
  return { container, creates, gets, output };
}

beforeAll(() => preparePasskeys());

describe('passkey ceremony', () => {
  test('create: fresh challenge and user id per call, discoverable, verified, no attestation, PRF evaluated', async () => {
    const a = fakeAuthenticator('prf');
    const r1 = await createPasskey({
      rpId: 'localhost',
      userName: 'yacana',
      credentials: a.container,
      exclude: [new Uint8Array([1])],
    });
    const r2 = await createPasskey({ rpId: 'localhost', userName: 'yacana', credentials: a.container });
    expect(new Uint8Array(r1.prf)).toEqual(new Uint8Array(a.output));
    expect(r1.credentialId).toEqual(new Uint8Array([9, 9, 9]));
    expect(r2.prf).toEqual(r1.prf);
    const [o1, o2] = a.creates.map((c) => c.publicKey);
    expect(o1?.challenge).toHaveLength(32);
    expect(o1?.challenge).not.toEqual(o2?.challenge);
    expect(o1?.user.id).toHaveLength(16);
    expect(o1?.user.id).not.toEqual(o2?.user.id);
    expect(o1?.rp).toEqual({ id: 'localhost', name: 'Yacana' });
    expect(o1?.authenticatorSelection).toEqual({ residentKey: 'required', userVerification: 'required' });
    expect(o1?.attestation).toBe('none');
    expect(o1?.timeout).toBe(120_000);
    expect(o1?.pubKeyCredParams.map((p) => p.alg)).toEqual([-7, -257]);
    expect(o1?.excludeCredentials?.map((c) => new Uint8Array(c.id as ArrayBuffer))).toEqual([
      new Uint8Array([1]),
    ]);
    expect(a.gets).toHaveLength(0);
  });

  test('create falls back to one assertion when PRF is enabled but not evaluated', async () => {
    const a = fakeAuthenticator('enabled-only');
    const r = await createPasskey({ rpId: 'localhost', userName: 'yacana', credentials: a.container });
    expect(new Uint8Array(r.prf)).toEqual(new Uint8Array(a.output));
    expect(a.gets).toHaveLength(1);
    expect(a.gets[0]?.publicKey.allowCredentials?.map((c) => new Uint8Array(c.id as ArrayBuffer))).toEqual([
      new Uint8Array([9, 9, 9]),
    ]);
    expect(a.gets[0]?.publicKey.userVerification).toBe('required');
  });

  test('no PRF at all is NoPrfError; a wrong-size PRF fails closed', async () => {
    const a = fakeAuthenticator('none');
    await expect(
      createPasskey({ rpId: 'localhost', userName: 'yacana', credentials: a.container }),
    ).rejects.toBeInstanceOf(NoPrfError);
    const short = {
      get: async () =>
        ({
          rawId: new Uint8Array(3).buffer,
          getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(16).buffer } } }),
        }) as unknown as PublicKeyCredential,
    } as unknown as CredentialsContainer;
    await expect(assertPasskey({ rpId: 'localhost', credentials: short })).rejects.toThrow(/expected 32/);
  });

  test('assert without allow is a discoverable request; with allow it names the credential', async () => {
    const a = fakeAuthenticator('prf');
    await assertPasskey({ rpId: 'localhost', credentials: a.container });
    await assertPasskey({ rpId: 'localhost', credentials: a.container, allow: [new Uint8Array([2])] });
    expect(a.gets[0]?.publicKey.allowCredentials).toBeUndefined();
    expect(a.gets[1]?.publicKey.allowCredentials).toHaveLength(1);
    expect(a.gets[0]?.publicKey.challenge).not.toEqual(a.gets[1]?.publicKey.challenge);
  });
});
