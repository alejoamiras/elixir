// What the connected Ethereum wallet can pay, read before it is asked, so "no ETH for the gas" is
// the page's own sentence and not the wallet's error. Either number may be unreadable, and unknown
// is null, never zero: a wallet that might have paid must not be refused.
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hex } from 'viem';
import { encodeFunctionData } from 'viem';
import { estimateFeesPerGas, estimateGas, getBalance, getPublicClient } from 'wagmi/actions';
import type { WagmiConfig } from './eth.ts';

export interface PayerFunds {
  /** Wei the wallet holds on the portal's chain. */
  balance: bigint | null;
  /** Wei the call would cost at the fee the RPC quotes now. */
  cost: bigint | null;
  /** Null until both are known. */
  enough: boolean | null;
}

export const UNKNOWN_FUNDS: PayerFunds = { balance: null, cost: null, enough: null };

export interface PortalCall<
  abi extends Abi,
  name extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
> {
  address: Hex;
  abi: abi;
  functionName: name;
  args: ContractFunctionArgs<abi, 'nonpayable' | 'payable', name>;
}

/** The payer's ETH against `call`'s cost from `account`; a call that cannot be estimated leaves the cost unknown. */
export async function payerFunds<
  abi extends Abi,
  name extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(config: WagmiConfig, account: Hex, call: PortalCall<abi, name> | undefined): Promise<PayerFunds> {
  if (!getPublicClient(config)) return UNKNOWN_FUNDS;
  const balance = await getBalance(config, { address: account })
    .then((b) => b.value)
    .catch(() => null);
  const cost = call ? await costOf(config, account, call).catch(() => null) : null;
  return { balance, cost, enough: balance === null || cost === null ? null : balance >= cost };
}

async function costOf<abi extends Abi, name extends ContractFunctionName<abi, 'nonpayable' | 'payable'>>(
  config: WagmiConfig,
  account: Hex,
  call: PortalCall<abi, name>,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
  } as never);
  const [gas, fees] = await Promise.all([
    estimateGas(config, { account, to: call.address, data }),
    estimateFeesPerGas(config),
  ]);
  return gas * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n);
}
