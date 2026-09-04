// Deploys one profile of elixir.params.json: the token-less miner (its address depends only on
// class, salt, deployer and its constructor args), the token with `minter` = that address, the
// miner, then one bind_token. Fees go through the sponsored FPC; the deployer is an
// initializerless Schnorr account derived from ELIXIR_DEPLOYER_SECRET (never logged).
//   AZTEC_NODE_URL=… ELIXIR_DEPLOYER_SECRET=0x… [ELIXIR_LAUNCH_AT=<unix seconds>] [ELIXIR_DEPLOY_SALT=0x…] \
//     [ELIXIR_DEPLOY_FORCE=1] bun packages/deploy/src/deploy.ts
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { deriveMasterMessageSigningSecretKey } from '@aztec/stdlib/keys';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { TokenContract } from '@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.js';
import { PARAMS, PROFILE } from '../../miner-core/src/generated/params.ts';

const repo = resolve(import.meta.dir, '../../..');

export interface Deployment {
  profile: string;
  chainId: string;
  nodeUrl: string;
  deployer: string;
  miner: string;
  token: string;
  /** For checking an announcement: the class ids the instances were deployed from, and the rollup. */
  minerClassId: string;
  tokenClassId: string;
  rollupVersion: string;
  minerSalt: string;
  tokenSalt: string;
  params: Record<string, string | number>;
  /** Unix seconds; epoch 0 accepts claims from here, as read back from epoch_params(0). */
  launchAt: string;
  deployedAt: string;
}

export interface DeployOverrides {
  /** Tests mine at an easy target; real deployments always take the profile's value. */
  initialTarget?: bigint;
  /** Unix seconds; announce the deployment before it so epoch 0 is a public race. 0 launches at once. */
  launchAt?: bigint;
}

// The record must describe what is on chain, not what the local artifact was compiled with.
async function verifyOnChain(
  miner: Contract,
  token: Contract,
  from: AztecAddress,
  initialTarget: bigint,
): Promise<{ target: bigint; seed: bigint; opened_at: bigint }> {
  const read = async <T>(p: Promise<unknown>) => ((await p) as { result: T }).result;
  const [n, expected, tMax, reward, ttl] = await read<bigint[]>(miner.methods.constants().simulate({ from }));
  const epoch0 = await read<{ target: bigint; seed: bigint; opened_at: bigint }>(
    miner.methods.epoch_params(0n).simulate({ from }),
  );
  const minter = await read<{ toString(): string }>(token.methods.get_minter().simulate({ from }));
  const bound = await read<{ toString(): string }>(miner.methods.bound_token().simulate({ from }));
  const mismatches = [
    [n, BigInt(PARAMS.N), 'N'],
    [expected, PARAMS.EXPECTED_EPOCH_SECONDS, 'EXPECTED_EPOCH_SECONDS'],
    [tMax, PARAMS.T_MAX, 'T_MAX'],
    [reward, PARAMS.REWARD, 'REWARD'],
    [ttl, PARAMS.CLAIM_TTL_SECONDS, 'CLAIM_TTL_SECONDS'],
    [epoch0.target, initialTarget, 'INITIAL_TARGET'],
    [epoch0.seed, PARAMS.GENESIS_SEED, 'GENESIS_SEED'],
  ].filter(([onChain, local]) => onChain !== local);
  if (mismatches.length)
    throw new Error(
      `deployed contract disagrees with the generated params: ${mismatches.map((m) => m[2]).join(', ')}`,
    );
  if (minter.toString() !== miner.address.toString()) throw new Error('token minter is not the miner');
  if (bound.toString() !== token.address.toString()) throw new Error('the miner bound a different token');
  return epoch0;
}

export async function deployElixir(
  nodeUrl: string,
  deployerSecret: Fr,
  salt = Fr.random(),
  overrides: DeployOverrides = {},
): Promise<Deployment> {
  const wallet = await EmbeddedWallet.create(nodeUrl, { ephemeral: true, pxe: { proverEnabled: true } });
  try {
    const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
    await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
    const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
    // Fixed account salt: the same secret always yields the same deployer address.
    const deployer = (
      await wallet.createSchnorrInitializerlessAccount(
        deployerSecret,
        Fr.ZERO,
        deriveMasterMessageSigningSecretKey(deployerSecret),
      )
    ).address;
    const minerArtifact = loadContractArtifact(
      await Bun.file(resolve(repo, 'packages/contracts/target/elixir_miner-ElixirMiner.json')).json(),
    );
    const minerDeploy = Contract.deploy(
      wallet,
      minerArtifact,
      [
        overrides.initialTarget ?? PARAMS.INITIAL_TARGET,
        new Fr(PARAMS.GENESIS_SEED),
        overrides.launchAt ?? 0n,
      ],
      'constructor',
      { deployer, salt },
    );
    const predicted = (await minerDeploy.getInstance()).address;
    const tokenSalt = Fr.random();
    const { contract: token, instance: tokenInstance } = await TokenContract.deployWithOpts(
      { method: 'constructor_with_minter', wallet, instantiation: { deployer, salt: tokenSalt } },
      PARAMS.TOKEN_NAME,
      PARAMS.TOKEN_SYMBOL,
      PARAMS.DECIMALS,
      predicted,
      AztecAddress.ZERO,
    ).send({ from: deployer, fee, wait: { timeout: 600 } });
    const { contract: miner, instance: minerInstance } = await minerDeploy.send({
      from: deployer,
      fee,
      wait: { timeout: 600 },
    });
    if (!miner.address.equals(predicted))
      throw new Error('deployed miner address differs from the precomputed one');
    await miner.methods.bind_token(token.address).send({ from: deployer, fee, wait: { timeout: 600 } });
    const epoch0 = await verifyOnChain(
      miner,
      token,
      deployer,
      overrides.initialTarget ?? PARAMS.INITIAL_TARGET,
    );
    const info = await createAztecNodeClient(nodeUrl).getNodeInfo();
    const chainId = String(info.l1ChainId);
    return {
      profile: PROFILE,
      chainId,
      // Origin only: a node URL can carry a provider API key in its path.
      nodeUrl: new URL(nodeUrl).origin,
      deployer: deployer.toString(),
      miner: miner.address.toString(),
      token: token.address.toString(),
      minerClassId: minerInstance.currentContractClassId.toString(),
      tokenClassId: tokenInstance.currentContractClassId.toString(),
      rollupVersion: String(info.rollupVersion),
      minerSalt: salt.toString(),
      tokenSalt: tokenSalt.toString(),
      params: Object.fromEntries(
        Object.entries(PARAMS).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v]),
      ),
      launchAt: epoch0.opened_at.toString(),
      deployedAt: new Date().toISOString(),
    };
  } finally {
    await wallet.stop().catch(() => {});
  }
}

if (import.meta.main) {
  const nodeUrl = process.env.AZTEC_NODE_URL;
  const secret = process.env.ELIXIR_DEPLOYER_SECRET;
  if (!nodeUrl || !secret) throw new Error('AZTEC_NODE_URL and ELIXIR_DEPLOYER_SECRET are required');
  // Validated and reduced here: the field constructors throw messages that echo their input, and
  // a 32-byte key can exceed the field modulus. Any 1–32-byte hex value maps to one deployer.
  if (!/^(0x)?[0-9a-fA-F]{1,64}$/.test(secret))
    throw new Error('ELIXIR_DEPLOYER_SECRET must be hex, at most 32 bytes');
  const deployerSecret = Fr.fromBufferReduce(Buffer.from(secret.replace(/^0x/, '').padStart(64, '0'), 'hex'));
  const salt = process.env.ELIXIR_DEPLOY_SALT ? Fr.fromString(process.env.ELIXIR_DEPLOY_SALT) : Fr.random();
  const dir = resolve(repo, 'deployments');
  const file = resolve(dir, `${PROFILE}.json`);
  if ((await Bun.file(file).exists()) && process.env.ELIXIR_DEPLOY_FORCE !== '1')
    throw new Error(
      `${file} already records a ${PROFILE} deployment; set ELIXIR_DEPLOY_FORCE=1 to replace it`,
    );
  const launchAt = BigInt(process.env.ELIXIR_LAUNCH_AT ?? '0');
  if (launchAt < 0n || launchAt >= 1n << 63n) throw new Error('ELIXIR_LAUNCH_AT must be unix seconds');
  const deployment = await deployElixir(nodeUrl, deployerSecret, salt, { launchAt });
  mkdirSync(dir, { recursive: true });
  await Bun.write(file, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`deployed ${PROFILE}: miner ${deployment.miner}, token ${deployment.token} → ${file}`);
}
