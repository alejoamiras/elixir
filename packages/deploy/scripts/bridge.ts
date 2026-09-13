// The operator's bridge commands, one per runbook step. Reads need only the record; writes need
// YACANA_L1_PRIVATE_KEY, and the L2 side of `retire` needs YACANA_DEPLOYER_SECRET (any funded
// account would do: consuming the retire message is not privileged).
//
//   YACANA_L1_PRIVATE_KEY=0x… [YACANA_RECORD=deployments/<profile>.json] [YACANA_L1_RPC_URL=…] \
//     bun run bridge -- status [version]
//                    | register
//                    | note-transitions
//                    | pause <version> <seconds> | pause-all <seconds> | unpause <version>
//                    | close-deposits <version>
//                    | retire <version>            (L1; then L2 with YACANA_DEPLOYER_SECRET and the source node)
//                    | forward <source-record> [target-record]
import { Fr } from '@aztec/aztec.js/fields';
import { PROFILE } from '../../miner-core/src/generated/params.ts';
import { forwardAll } from '../src/bridge/forward.ts';
import { openL2 } from '../src/bridge/l2.ts';
import { loadRecord, operatorFromEnv } from '../src/bridge/operator.ts';
import { closeDeposits, pause, pauseAll, unpause } from '../src/bridge/pause.ts';
import { registerVersion } from '../src/bridge/register.ts';
import { retireOnL1, retireOnL2 } from '../src/bridge/retire.ts';
import { registeredVersions, statusLines, versionStatus } from '../src/bridge/status.ts';
import { noteAllTransitions } from '../src/bridge/transition.ts';

const [command, ...args] = process.argv.slice(2).filter((a) => a !== '--');
const arg = (i: number, name: string): string => {
  const v = args[i];
  if (v === undefined) throw new Error(`${command} needs <${name}>`);
  return v;
};
const op = await operatorFromEnv(PROFILE);

switch (command) {
  case 'status': {
    const versions = args[0] ? [BigInt(args[0])] : await registeredVersions(op);
    for (const v of versions) for (const line of statusLines(await versionStatus(op, v))) console.log(line);
    break;
  }
  case 'register': {
    const r = await registerVersion(op);
    console.log(`registered version ${r.version} at Registry index ${r.index}: ${r.txHash}`);
    break;
  }
  case 'note-transitions': {
    const noted = await noteAllTransitions(op);
    console.log(noted.length ? `noted transitions ${noted.join(', ')}` : 'nothing to note');
    break;
  }
  case 'pause':
    console.log(await pause(op, BigInt(arg(0, 'version')), BigInt(arg(1, 'seconds'))));
    break;
  case 'pause-all':
    console.log(await pauseAll(op, BigInt(arg(0, 'seconds'))));
    break;
  case 'unpause':
    console.log(await unpause(op, BigInt(arg(0, 'version'))));
    break;
  case 'close-deposits':
    console.log(await closeDeposits(op, BigInt(arg(0, 'version'))));
    break;
  case 'retire': {
    const sent = await retireOnL1(op, BigInt(arg(0, 'version')));
    console.log(`retire sent for ${sent.version}: ${sent.txHash} (inbox index ${sent.inboxIndex})`);
    const secret = process.env.YACANA_DEPLOYER_SECRET;
    if (!secret) {
      console.log(
        'YACANA_DEPLOYER_SECRET unset: consume it on the old chain with `retire` again, or from any account',
      );
      break;
    }
    const l2 = await openL2(op.record, Fr.fromHexString(secret));
    try {
      console.log(
        `retired on L2: ${await retireOnL2(l2, op.record.bridge.portal as `0x${string}`, sent.inboxIndex)}`,
      );
    } finally {
      await l2.stop();
    }
    break;
  }
  case 'forward': {
    const source = loadRecord(arg(0, 'source-record'));
    const target = args[1] ? loadRecord(args[1]) : undefined;
    const r = await forwardAll(op, { source, ...(target ? { target } : {}) });
    console.log(
      `archived ${r.archived}, forwarded ${r.forwarded.length}, failed ${r.failed.length}, pending ${r.pending.length}${r.refusedKind2 ? ' (send-aheads refused: the live miner is not the announced one)' : ''}`,
    );
    break;
  }
  default:
    throw new Error(`unknown command ${command ?? '(none)'}`);
}
