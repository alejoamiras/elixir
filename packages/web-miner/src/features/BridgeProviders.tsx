// The bridge features mount here and nowhere else: wagmi over the open account's bridge session
// (its config names the chain and the RPC in use) and the query client wagmi's hooks want. Nothing
// renders while no bridge session is open — a build without a portal, or a signed-out page.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { bridgeSessionAtom } from '../state';

const queryClient = new QueryClient();

export function BridgeProviders({ children }: { children: ReactNode }) {
  const bridge = useAtomValue(bridgeSessionAtom);
  if (!bridge) return null;
  return (
    <WagmiProvider config={bridge.config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
