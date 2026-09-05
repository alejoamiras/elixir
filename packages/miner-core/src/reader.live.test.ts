// Runs against an isolated local network: bun run e2e:agent -- bun test packages/miner-core
import { describe, expect, test } from 'bun:test';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { deployYacana } from '../../deploy/src/deploy.ts';
import { loadMinerArtifact } from './artifacts.ts';
import { assertDeployment, expectedFromStrings } from './reader.ts';

const nodeUrl = process.env.AZTEC_NODE_URL ?? '';

describe.skipIf(!nodeUrl)('assertDeployment against a live node', () => {
  test('accepts the deployment it was built for and refuses every drift', async () => {
    const node = createAztecNodeClient(nodeUrl);
    const layout = (await loadMinerArtifact()).storageLayout;
    const d = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 127n });
    const other = await deployYacana(nodeUrl, Fr.random(), Fr.random(), { initialTarget: 1n << 127n });
    const expected = expectedFromStrings(d);
    await assertDeployment(node, expected, layout);
    await expect(assertDeployment(node, { ...expected, chainId: 1n }, layout)).rejects.toThrow(/on chain/);
    await expect(assertDeployment(node, { ...expected, rollupVersion: 1n }, layout)).rejects.toThrow(
      /rollup version/,
    );
    await expect(assertDeployment(node, { ...expected, minerClassId: Fr.random() }, layout)).rejects.toThrow(
      /has class/,
    );
    await expect(
      assertDeployment(node, { ...expected, miner: expectedFromStrings(other).miner }, layout),
    ).rejects.toThrow(/bound token/);
    await expect(
      assertDeployment(node, { ...expected, token: expectedFromStrings(other).token }, layout),
    ).rejects.toThrow(/bound token/);
  }, 600_000);
});
