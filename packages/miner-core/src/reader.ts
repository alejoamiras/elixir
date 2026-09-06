// Node-only reads shared by every surface (no wallet, no PXE): the boot check that the node
// serves the deployment the build was made for.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { ContractArtifact } from '@aztec/stdlib/abi';

export type Node = ReturnType<typeof createAztecNodeClient>;
export type StorageLayout = ContractArtifact['storageLayout'];

export interface ExpectedDeployment {
  chainId: bigint;
  rollupVersion: bigint;
  miner: AztecAddress;
  minerClassId: Fr;
  token: AztecAddress;
  tokenClassId: Fr;
}

const fixedSlot = (layout: StorageLayout, name: string): Fr => {
  const slot = layout[name]?.slot;
  if (!slot) throw new Error(`storage layout lacks ${name}`);
  return slot;
};

/**
 * Both instances, both classes, and the miner's immutable `token` slot must match the build: a
 * node that serves another deployment (or a fork sharing addresses) is refused before any read.
 */
export async function assertDeployment(
  node: Node,
  expected: ExpectedDeployment,
  minerLayout: StorageLayout,
): Promise<void> {
  const [chainId, info] = await Promise.all([node.getChainId(), node.getNodeInfo()]);
  if (BigInt(chainId) !== expected.chainId)
    throw new Error(`node is on chain ${chainId}, this build expects ${expected.chainId}`);
  if (BigInt(info.rollupVersion) !== expected.rollupVersion)
    throw new Error(
      `node runs rollup version ${info.rollupVersion}, this build expects ${expected.rollupVersion}`,
    );
  for (const [name, address, classId] of [
    ['miner', expected.miner, expected.minerClassId],
    ['token', expected.token, expected.tokenClassId],
  ] as const) {
    const instance = await node.getContract(address);
    if (!instance) throw new Error(`no ${name} contract at ${address} on this node`);
    if (!instance.currentContractClassId.equals(classId))
      throw new Error(
        `${name} at ${address} has class ${instance.currentContractClassId}, this build expects ${classId}`,
      );
  }
  const bound = await node.getPublicStorageAt('latest', expected.miner, fixedSlot(minerLayout, 'token'));
  if (!bound.equals(expected.token.toField()))
    throw new Error(`the miner's bound token is ${bound}, this build expects ${expected.token}`);
}

/** Parses the build's deployment identity; every field must be a well-formed hex value. */
export const expectedFromStrings = (s: {
  chainId: string;
  rollupVersion: string;
  miner: string;
  minerClassId: string;
  token: string;
  tokenClassId: string;
}): ExpectedDeployment => ({
  chainId: BigInt(s.chainId),
  rollupVersion: BigInt(s.rollupVersion),
  miner: AztecAddress.fromStringUnsafe(s.miner),
  minerClassId: Fr.fromString(s.minerClassId),
  token: AztecAddress.fromStringUnsafe(s.token),
  tokenClassId: Fr.fromString(s.tokenClassId),
});
