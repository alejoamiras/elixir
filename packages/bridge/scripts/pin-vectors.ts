// Pins the bridge's cross-language vectors: every content hash, the retire secret hash, the exit
// log tag and one crossing's derived secrets, computed here once and written to
// packages/bridge/fixtures/bridge-vectors.json. The codegen turns them into Noir tests, the
// portal's Foundry suite and vectors.test.ts assert the same values. Re-run only when an
// encoding, a label or a domain changes on purpose — that orphans every crossing ever made.
import { resolve } from 'node:path';
import { Fr } from '@aztec/foundation/curves/bn254';
import { EthAddress } from '@aztec/foundation/eth-address';
import { computeSecretHash } from '@aztec/stdlib/hash';
import { masterFromPrf } from '@yacana/miner-core/src/keys/derive.ts';
import { claimContent, exitContent, retireContent, sendAheadContent } from '../src/content.ts';
import { deriveCrossingSecrets, exitLogTag } from '../src/secrets.ts';

const hex = (v: Fr | bigint) => `0x${(typeof v === 'bigint' ? v : v.toBigInt()).toString(16)}`;

const recipient = EthAddress.fromString('0x1e5700000000000000000000000000000000c0de');
const redeemKey = EthAddress.fromString('0x00000000000000000000000000000000000000ff');
const amount = 12_000000000000000000n;
const tag = new Fr(0x7a9n);
const secretHash = new Fr(0x5ec2e7n);
const version = 1821665230n;
const scope = {
  chainId: 31337n,
  portal: EthAddress.fromString('0x000000000000000000000000000000000000beef'),
  version,
};
const master = await masterFromPrf(new Uint8Array(32).map((_, i) => i));
const crossing = await deriveCrossingSecrets(master, scope, 3);

const vectors = {
  exit: {
    recipient: recipient.toString(),
    amount: amount.toString(),
    tag: hex(tag),
    value: hex(exitContent(recipient, amount, tag)),
  },
  sendAhead: {
    amount: amount.toString(),
    secretHash: hex(secretHash),
    redeemKey: redeemKey.toString(),
    value: hex(sendAheadContent(amount, secretHash, redeemKey)),
  },
  claim: { amount: amount.toString(), value: hex(claimContent(amount)) },
  retire: { version: version.toString(), value: hex(retireContent(version)) },
  retireSecretHash: hex(await computeSecretHash(new Fr(0n))),
  exitLogTag: { hashOrTag: hex(tag), value: hex(await exitLogTag(tag)) },
  crossing: {
    masterPrf: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    scope: {
      chainId: scope.chainId.toString(),
      portal: scope.portal.toString(),
      version: version.toString(),
    },
    index: crossing.index,
    secret: hex(crossing.secret),
    secretHash: hex(crossing.secretHash),
    tag: hex(crossing.tag),
    redeemKey: crossing.redeemKey,
    redeemAddress: crossing.redeemAddress.toString(),
  },
};
const out = resolve(import.meta.dir, '../fixtures/bridge-vectors.json');
await Bun.write(out, `${JSON.stringify(vectors, null, 2)}\n`);
console.log(`bridge vectors → ${out}`);
