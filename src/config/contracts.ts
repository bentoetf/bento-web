import { defineChain, type Address } from "viem";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com/"] },
  },
  blockExplorers: {
    default: { name: "Robinhood Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const contracts = {
  boxEngine: (process.env.NEXT_PUBLIC_BOX_ENGINE_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  mag7BoxToken: (process.env.NEXT_PUBLIC_MAG7_BOX_TOKEN_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  mag7Vault: (process.env.NEXT_PUBLIC_MAG7_VAULT_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  v4Adapter: (process.env.NEXT_PUBLIC_V4_ADAPTER_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  bentoToken: (process.env.NEXT_PUBLIC_BENTO_TOKEN_ADDRESS || "0x73e2bb7793ee0cf1375ef7892d2ca228a29a7d5c") as Address,
  feeCollector: (process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  usdgZapper: (process.env.NEXT_PUBLIC_USDG_ZAPPER_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
  boxId: 1n,
  tvlCapWei: 15_000_000_000_000_000_000n,
  perTxMintCapWei: 2_000_000_000_000_000_000n,
} as const;

export const ETH_USD_FEED = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9" as Address;
export const USDG_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
export const USDG_DECIMALS = 6;

export const MAG7_COMPONENTS = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" as Address,
    feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15" as Address,
    weightBps: 1428n,
    thinPoolWarning: false,
  },
  {
    symbol: "AAPL",
    name: "Apple",
    token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" as Address,
    feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0" as Address,
    weightBps: 1428n,
    thinPoolWarning: false,
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74" as Address,
    feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E" as Address,
    weightBps: 1428n,
    thinPoolWarning: true,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" as Address,
    feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b" as Address,
    weightBps: 1428n,
    thinPoolWarning: false,
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54" as Address,
    feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C" as Address,
    weightBps: 1428n,
    thinPoolWarning: false,
  },
  {
    symbol: "META",
    name: "Meta",
    token: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35" as Address,
    feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1" as Address,
    weightBps: 1428n,
    thinPoolWarning: true,
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" as Address,
    feed: "0x4A1166a659A55625345e9515b32adECea5547C38" as Address,
    weightBps: 1432n,
    thinPoolWarning: false,
  },
] as const;

export const boxEngineAbi = [
  {
    type: "function",
    name: "navUsdPerBox",
    stateMutability: "view",
    inputs: [{ name: "boxId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "backingDetailed",
    stateMutability: "view",
    inputs: [{ name: "boxId", type: "uint256" }],
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "rawBalances", type: "uint256[]" },
      { name: "uiBalances", type: "uint256[]" },
      { name: "usdValues1e18", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "boxes",
    stateMutability: "view",
    inputs: [{ name: "boxId", type: "uint256" }],
    outputs: [
      { name: "boxToken", type: "address" },
      { name: "vault", type: "address" },
      { name: "mintFeeBps", type: "uint16" },
      { name: "redeemFeeBps", type: "uint16" },
      { name: "tvlCapWei", type: "uint128" },
      { name: "mintPaused", type: "bool" },
      { name: "exists", type: "bool" },
      { name: "metadataURI", type: "string" },
    ],
  },
  {
    type: "function",
    name: "perTxMintCapWei",
    stateMutability: "view",
    inputs: [{ name: "boxId", type: "uint256" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "simulateMint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "ethIn", type: "uint256" },
    ],
    outputs: [{ name: "boxOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingClaims",
    stateMutability: "view",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "minBoxOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "minComponentOut", type: "uint256[]" },
    ],
    outputs: [{ name: "boxOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeemForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "boxIn", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "minComponentEthOut", type: "uint256[]" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "ethOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeemForStocks",
    stateMutability: "nonpayable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "boxIn", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimPending",
    stateMutability: "nonpayable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export const feedAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export const adapterAbi = [
  { type: "function", name: "quoteETHToToken", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amountIn", type: "uint256" }], outputs: [{ name: "amountOut", type: "uint256" }] },
  { type: "function", name: "quoteTokenToETH", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "amountIn", type: "uint256" }], outputs: [{ name: "amountOut", type: "uint256" }] },
] as const;

export const zapperAbi = [
  {
    type: "function",
    name: "mintWithUSDG",
    stateMutability: "nonpayable",
    inputs: [
      { name: "boxId", type: "uint256" },
      { name: "usdgIn", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "minBoxOut", type: "uint256" },
      { name: "minComponentOut", type: "uint256[]" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "boxOut", type: "uint256" }],
  },
] as const;

export function hasZapperAddress() {
  return contracts.usdgZapper !== PLACEHOLDER_ADDRESS;
}

export function hasDeployAddresses() {
  return contracts.boxEngine !== PLACEHOLDER_ADDRESS && contracts.mag7BoxToken !== PLACEHOLDER_ADDRESS && contracts.mag7Vault !== PLACEHOLDER_ADDRESS && contracts.v4Adapter !== PLACEHOLDER_ADDRESS;
}

export function hasBentoAddresses() {
  return contracts.bentoToken !== PLACEHOLDER_ADDRESS && contracts.feeCollector !== PLACEHOLDER_ADDRESS;
}
