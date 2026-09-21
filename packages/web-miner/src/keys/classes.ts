// An account's address depends on the account contract's class as much as on the master: an SDK
// that ships a new class gives every master a new address. The vault therefore knows two classes —
// the build's and the one before it — and a master fingerprint that names the master without any
// class, so a record made under the old class opens under the new one exactly once and only when
// the master is the same.
import { SchnorrInitializerlessAccountContractArtifact } from '@aztec/accounts/schnorr';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { Schnorr } from '@aztec/foundation/crypto/schnorr';
import { Fr } from '@aztec/foundation/curves/bn254';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { computeContractAddressFromInstance, getContractClassFromArtifact } from '@aztec/stdlib/contract';
import { deriveKeys } from '@aztec/stdlib/keys';
import { deriveAccountFields, hkdf } from '@yacana/miner-core/keys/derive';

/**
 * The account class the last shipped build derived addresses with. When an SDK bump changes the
 * class (classes.test.ts stops matching), move the value this test printed here: records without a
 * fingerprint are verified against it, once, on the apex.
 */
export const PREVIOUS_ACCOUNT_CLASS_ID = '0x1c59d7500b7d8ba4bb13ace9e7c07e9576a11a5966624ced14f8efd117b9d5b2';

let current: Promise<string> | undefined;
/** The build's account class id, from the SDK's own artifact. */
export const currentAccountClassId = (): Promise<string> => {
  current ??= getContractClassFromArtifact(SchnorrInitializerlessAccountContractArtifact).then((c) =>
    c.id.toString(),
  );
  return current;
};

/**
 * Account `index` of `master` under `classId`: the initializerless Schnorr account's instance
 * (no initializer, the signing key's hash as the immutables hash, the secret's public keys, the
 * derived salt, no deployer), with the class id set rather than taken from the artifact.
 */
export async function addressUnderClass(master: Uint8Array, index: number, classId: string): Promise<string> {
  const fields = await deriveAccountFields(master, index);
  const { publicKeys } = await deriveKeys(fields.secret);
  const signingPublicKey = await new Schnorr().computePublicKey(fields.signingKey);
  const immutablesHash = await poseidon2Hash([signingPublicKey.x, signingPublicKey.y]);
  const id = Fr.fromHexString(classId);
  const address = await computeContractAddressFromInstance({
    originalContractClassId: id,
    initializationHash: Fr.ZERO,
    immutablesHash,
    publicKeys,
    salt: fields.salt,
    deployer: AztecAddress.ZERO,
    version: 2,
  });
  return address.toString();
}

const FINGERPRINT_INFO = 'yacana.master.fp.v1';

/** Names a master without naming an address: 32 bytes of HKDF under a label of its own, as hex. */
export async function fingerprintOf(master: Uint8Array): Promise<string> {
  const bytes = await hkdf(master, FINGERPRINT_INFO, 32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The two classes a record is checked against; tests substitute their own. */
export interface AccountClasses {
  current: { id: string; addressOf: (master: Uint8Array, index: number) => Promise<string> };
  previous: { id: string; addressOf: (master: Uint8Array, index: number) => Promise<string> };
}

export const buildClasses = async (): Promise<AccountClasses> => {
  const id = await currentAccountClassId();
  return {
    current: { id, addressOf: (m, i) => addressUnderClass(m, i, id) },
    previous: {
      id: PREVIOUS_ACCOUNT_CLASS_ID,
      addressOf: (m, i) => addressUnderClass(m, i, PREVIOUS_ACCOUNT_CLASS_ID),
    },
  };
};
