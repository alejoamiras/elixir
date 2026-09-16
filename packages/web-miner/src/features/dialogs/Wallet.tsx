// The Ethereum wallet inside a dialog: the connect screen (one installed wallet connects on the
// click, several make a list), the connected wallet as a chip with the network beside it, the chain
// the bridge needs as a visible step, and the YACA the wallet holds there.
import type { Hex } from 'viem';
import { useAccount, useConnect, useConnectors, useDisconnect, useReadContract, useSwitchChain } from 'wagmi';
import { yacaAbi } from '../../../../bridge/src/portal.ts';
import { PARAMS } from '../../../../miner-core/src/generated/params.ts';
import { Note } from '../../../../ui/src/index.ts';
import { chainName } from '../../bridge/copy';
import { bridgeRecord } from '../../bridge/env';
import type { PayerFunds } from '../../bridge/eth-balance';
import { amount as fmt, shortAddress } from '../../lib/format';
import { Actions, firstLine, Primary, Quiet } from './Frame';

/** The bridge's chain, by name: "Sepolia", "Local Ethereum". */
export const chain = (): string => chainName(bridgeRecord()?.chainId);
const chainId = (): number => Number(bridgeRecord()?.chainId ?? 0);

/** The connected account's YACA on Ethereum, read through the RPC in use every few seconds. */
export function useYacaBalance(owner: Hex | undefined): bigint | undefined {
  const yaca = bridgeRecord()?.yaca as Hex | undefined;
  const { data } = useReadContract({
    address: yaca,
    abi: yacaAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: yaca !== undefined && owner !== undefined, refetchInterval: 5_000 },
  });
  return data;
}

/** The wallet's name as the dialog says it: the connector's, or the plain word before one is connected. */
export function useWalletName(): string {
  const { connector } = useAccount();
  return connector?.name ?? 'your wallet';
}

/**
 * Whether the connected wallet sits on the bridge's chain, and the switch as a step of its own:
 * the wallet asks to confirm it, so the dialog names it before the transaction rather than inside.
 */
export function useWalletChain(): {
  wrong: boolean;
  onChain: string;
  switching: boolean;
  switchTo: () => Promise<void>;
} {
  const account = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const wanted = chainId();
  const wrong = account.isConnected && account.chainId !== wanted;
  return {
    wrong,
    onChain: account.chainId === undefined ? 'another network' : chainName(String(account.chainId)),
    switching: isPending,
    switchTo: async () => {
      await switchChainAsync({ chainId: wanted });
    },
  };
}

/** The page's own "no ETH for the gas", before the wallet is asked; null when it can pay or nothing is known. */
export const noEth = (funds: PayerFunds, wallet: string): string | null =>
  funds.enough === false ? `${wallet} has no ${chain()} ETH for the gas.` : null;

/** The connected wallet as one chip: its name, the address and the network; × disconnects. */
export function WalletChip({ aside }: { aside?: React.ReactNode }) {
  const account = useAccount();
  const { disconnect } = useDisconnect();
  if (!account.address) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" data-testid="eth-account">
      <span className="inline-flex h-[34px] items-center gap-2 rounded-md border border-line-2 pr-1 pl-3 font-mono text-[12.5px]">
        <i aria-hidden className="size-3 rounded-full bg-[linear-gradient(135deg,var(--uv),var(--warn))]" />
        <span className="font-sans font-medium">{account.connector?.name ?? 'Wallet'}</span>
        <span>· {shortAddress(account.address)}</span>
        <span className="text-ink-3">
          · {account.chainId === undefined ? '…' : chainName(String(account.chainId))}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          aria-label="Disconnect this wallet"
          title="Disconnect"
          className="ml-0.5 grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-panel-2 hover:text-ink"
          data-testid="eth-disconnect"
        >
          ×
        </button>
      </span>
      {aside}
    </div>
  );
}

/** "7 YACA available" beside the chip, from the wallet's balance on Ethereum. */
export function YacaAvailable({ yaca }: { yaca: bigint | undefined }) {
  return (
    <span className="whitespace-nowrap font-mono text-2xs text-ink-2">
      <span data-testid="yaca-balance">{yaca === undefined ? '…' : fmt(yaca, PARAMS.DECIMALS)}</span> YACA
      available
    </span>
  );
}

const GET_ONE = 'https://ethereum.org/wallets/find-wallet/';

/**
 * The connect screen: one installed wallet connects on the click, several make a list by name and
 * icon (the EIP-6963 announcements wagmi discovers), none says where to get one.
 */
export function ConnectWallet({ onCancel }: { onCancel?: () => void }) {
  const connectors = useConnectors();
  const { connect, isPending, error } = useConnect();
  const account = useAccount();
  if (account.status === 'reconnecting')
    return (
      <p className="text-xs text-ink-2" data-testid="wallet-reconnecting">
        Reconnecting your Ethereum wallet…
      </p>
    );
  const one = connectors.length === 1 ? connectors[0] : undefined;
  return (
    <div className="flex flex-col gap-3" data-testid="wallet-picker">
      {connectors.length > 1 && (
        <div className="flex flex-col gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector: c })}
              className="flex items-center justify-between rounded-[8px] border border-line-2 px-3.5 py-3 text-left hover:border-ink-3 disabled:opacity-60"
              data-testid="wallet-option"
            >
              <span className="flex items-center gap-2.5">
                {c.icon ? (
                  <img src={c.icon} alt="" className="size-[22px] rounded-[6px]" />
                ) : (
                  <i aria-hidden className="size-[22px] rounded-[6px] bg-line-2" />
                )}
                <b className="text-sm">{c.name}</b>
              </span>
              <span className="font-mono text-2xs text-ink-3">installed</span>
            </button>
          ))}
        </div>
      )}
      {connectors.length <= 1 && (
        <Actions
          quiet={onCancel && <Quiet onClick={onCancel}>Cancel</Quiet>}
          below={
            <span className="font-sans text-xs text-ink-3">
              MetaMask, Rabby or any browser wallet. None installed?{' '}
              <a href={GET_ONE} target="_blank" rel="noopener noreferrer" className="text-uv-2">
                Get one ↗
              </a>
            </span>
          }
        >
          <Primary
            disabled={isPending || !one}
            onClick={() => one && connect({ connector: one })}
            data-testid="wallet-option"
          >
            {isPending ? 'Connecting…' : 'Connect wallet'}
          </Primary>
        </Actions>
      )}
      {connectors.length > 1 && onCancel && <Quiet onClick={onCancel}>Cancel</Quiet>}
      {error && (
        <p className="text-xs text-warn" data-testid="wallet-error">
          {firstLine(error)}
        </p>
      )}
    </div>
  );
}

/** The wrong-network note over the form, when the wallet is elsewhere than the bridge. */
export function WrongNetwork({ wallet, onChain, verb }: { wallet: string; onChain: string; verb: string }) {
  return (
    <Note title={`${wallet} is on ${onChain}.`} tone="warn" data-testid="wrong-network">
      The bridge is on {chain()}. Switch, then {verb}; {wallet} asks you to confirm the switch.
    </Note>
  );
}
