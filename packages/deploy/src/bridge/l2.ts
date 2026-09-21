// The operator's Aztec side: a wallet on one version's node, its account (the deployer's, or any
// funded one — every L2 bridge call the operator makes is one anyone may make), the miner as a
// contract handle, and the sponsored fee every call pays with.
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { MINER_ARTIFACT_PATH } from '@yacana/miner-core/artifacts';
import type { Deployment } from '../deploy.ts';

export interface L2Side {
  node: AztecNode;
  wallet: EmbeddedWallet;
  from: AztecAddress;
  miner: Contract;
  token: TokenContract;
  fee: { paymentMethod: SponsoredFeePaymentMethod };
  chainId: bigint;
  rollupVersion: bigint;
  stop(): Promise<void>;
}

/** Opens the version's node named by the record (or `nodeUrl`) with an account derived from `secret`. */
export async function openL2(record: Deployment, secret: Fr, nodeUrl = record.nodeUrl): Promise<L2Side> {
  const wallet = await EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
  try {
    const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
    await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
    const account = await wallet.createSchnorrInitializerlessAccount(
      secret,
      Fr.ZERO,
      deriveMasterMessageSigningSecretKey(secret),
    );
    const node = createAztecNodeClient(nodeUrl);
    const artifact = loadContractArtifact(await Bun.file(MINER_ARTIFACT_PATH).json());
    // The miner's bridge calls reach the token (a burn, a mint): the wallet needs both instances.
    for (const [address, art] of [
      [record.miner, artifact],
      [record.token, TokenContract.artifact],
    ] as const) {
      const instance = await node.getContract(AztecAddress.fromStringUnsafe(address));
      if (!instance) throw new Error(`${address} is not on ${nodeUrl}`);
      await wallet.registerContract(instance, art);
    }
    const miner = Contract.at(AztecAddress.fromStringUnsafe(record.miner), artifact, wallet);
    return {
      node,
      wallet,
      from: account.address,
      miner,
      token: TokenContract.at(AztecAddress.fromStringUnsafe(record.token), wallet),
      fee: { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) },
      chainId: BigInt(record.chainId),
      rollupVersion: BigInt(record.rollupVersion),
      stop: () => wallet.stop().catch(() => {}),
    };
  } catch (e) {
    await wallet.stop().catch(() => {});
    throw e;
  }
}
