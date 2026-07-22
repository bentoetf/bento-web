"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { WagmiProvider, createConfig } from "wagmi";
import { useState, type ReactNode } from "react";
import { robinhood } from "@/config/contracts";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = walletConnectProjectId
  ? [injected(), walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
  : [injected()];

export const wagmiConfig = createConfig({
  chains: [robinhood],
  connectors,
  transports: {
    [robinhood.id]: http(robinhood.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
