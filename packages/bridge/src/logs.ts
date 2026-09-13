// Portal events off an Ethereum RPC, in windows: most public RPCs cap a single `eth_getLogs` at a
// few thousand blocks, so a scan from the portal's deploy block to the head walks it in slices.
import type {
  Abi,
  ContractEventName,
  GetContractEventsParameters,
  GetContractEventsReturnType,
  Hex,
  PublicClient,
} from 'viem';

/** What a scan needs of a client: the one read, so a test's stand-in is a plain object. */
export type LogClient = Pick<PublicClient, 'getContractEvents'>;

/** Blocks per `eth_getLogs`: under the range most public RPCs allow. */
export const LOG_WINDOW = 10_000n;

export interface LogScan<abi extends Abi, name extends ContractEventName<abi>> {
  address: Hex;
  abi: abi;
  eventName: name;
  args?: GetContractEventsParameters<abi, name>['args'];
  fromBlock: bigint;
  toBlock: bigint;
  /** Stop at the first window that has a match: for a lookup of one event, not a listing. */
  first?: boolean;
}

/** Every matching event between the two blocks, window by window, in block order. */
export async function scanLogs<abi extends Abi, name extends ContractEventName<abi>>(
  client: LogClient,
  scan: LogScan<abi, name>,
): Promise<GetContractEventsReturnType<abi, name, true>> {
  const out: GetContractEventsReturnType<abi, name, true> = [];
  for (let from = scan.fromBlock; from <= scan.toBlock; from += LOG_WINDOW) {
    const to = from + LOG_WINDOW - 1n < scan.toBlock ? from + LOG_WINDOW - 1n : scan.toBlock;
    const logs = await client.getContractEvents({
      address: scan.address,
      abi: scan.abi,
      eventName: scan.eventName,
      ...(scan.args ? { args: scan.args } : {}),
      fromBlock: from,
      toBlock: to,
      // Only logs whose data decodes in full: an event with a missing field is no event.
      strict: true,
    } as GetContractEventsParameters<abi, name>);
    out.push(...(logs as GetContractEventsReturnType<abi, name, true>));
    if (scan.first && out.length > 0) break;
  }
  return out;
}
