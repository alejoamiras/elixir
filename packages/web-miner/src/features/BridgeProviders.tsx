// The bridge features mount here and nowhere else: wagmi over the open account's bridge session
// (its config names the chain and the RPC in use) and the query client wagmi's hooks want. Nothing
// renders while no bridge session is open — a build without a portal, or a signed-out page.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { type ReactNode, useEffect } from 'react';
import { useAccount, WagmiProvider } from 'wagmi';
import { bridgeSessionAtom, walletNameAtom } from '../state';

const queryClient = new QueryClient();

/** The connected wallet's name into the atom the rows read; wagmi's hooks reach only this far. */
function WalletName() {
  const name = useAccount().connector?.name;
  const set = useSetAtom(walletNameAtom);
  useEffect(() => set(name), [name, set]);
  return null;
}

export function BridgeProviders({ children }: { children: ReactNode }) {
  const bridge = useAtomValue(bridgeSessionAtom);
  if (!bridge) return null;
  return (
    <WagmiProvider config={bridge.config}>
      <QueryClientProvider client={queryClient}>
        <WalletName />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
