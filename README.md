# Bento Web

Client-only frontend for Bento Protocol Phase 2A. The app targets Robinhood Chain and reads live Bento/MAG7 contract state through wagmi + viem. It does not render fake or mocked protocol data: if deployment addresses are not configured or a chain read fails, the UI shows the value as unavailable.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- wagmi + viem
- Injected wallets + WalletConnect

## Features

- **Box overview:** MAG7 composition, NAV per box, TVL/cap status, backing table, and live stock feed prices.
- **Mint:** ETH input, `simulateMint` quote, fee display, per-component quote/minimum breakdown, slippage tolerance defaulting to 1%, and the array overload of `mint`.
- **Redeem:** `redeemForStocks` and `redeemForETH`; ETH path computes per-leg minimums from live adapter quotes.
- **Claims:** reads `pendingClaims` for the connected wallet across all MAG7 components and calls `claimPending`.
- **Error UX:** friendly messages for stale feeds, per-tx cap, TVL cap, slippage, and wallet rejection.
- **Launch safety:** clear placeholder-address state until mainnet deploy addresses are provided.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com/
NEXT_PUBLIC_BOX_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_MAG7_BOX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MAG7_VAULT_ADDRESS=0x...
NEXT_PUBLIC_V4_ADAPTER_ADDRESS=0x...
```

Until the Bento deploy addresses are set, the app runs in an unavailable-data state and disables contract actions.

## Development

```bash
npm run dev
```

Open http://localhost:3000.

## Build checks

```bash
npm run lint
npm run build
```

## Local Robinhood fork mode

Use a local Anvil fork when you want to test the full mint/redeem flow against forked Robinhood state and locally deployed Bento contracts:

```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com/ --chain-id 4663 --port 8545
```

Then deploy the Bento contracts to the fork, copy the fork deployment addresses into `.env.local`, and point the frontend at Anvil:

```bash
NEXT_PUBLIC_ROBINHOOD_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_BOX_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_MAG7_BOX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MAG7_VAULT_ADDRESS=0x...
NEXT_PUBLIC_V4_ADAPTER_ADDRESS=0x...
```

Restart `npm run dev` after changing environment variables.

## Data policy

No fake or mocked Bento values are included. MAG7 component token/feed addresses are public Robinhood Chain addresses. All NAV, TVL, backing, quote, balance, and claim values come from chain reads, otherwise the UI displays `Unavailable`.
