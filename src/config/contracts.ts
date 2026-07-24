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
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
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

export type BoxComponent = {
  symbol: string;
  name: string;
  token: Address;
  feed: Address;
  weightBps: bigint;
  thinPoolWarning: boolean;
};

export type BoxType = "backed" | "synthetic" | "mixed";

// Engine boxes are 1:1 BoxEngine boxes; synthetic boxes are standalone SyntheticBox ERC20 vaults.
export type BoxKind = "engine" | "synthetic";

export type BoxInfo = {
  id: bigint;
  kind: BoxKind;
  name: string;
  symbol: string;
  description: string;
  // For engine boxes this is the box ERC20 token; for synthetic boxes it is the SyntheticBox vault itself (the vault IS the ERC20).
  token: Address;
  zapper: Address;
  art: string;
  thumb: string;
  componentSummary: string;
  boxType: BoxType;
  components: readonly BoxComponent[];
};

// Centralized synthetic box addresses. Swapping a redeployed box is a one-line change here
// (env override wins so a redeploy needs no code change at all).
export const SYNTHETIC_BOX_ADDRESSES = {
  factory: (process.env.NEXT_PUBLIC_BOX_FACTORY_ADDRESS || "0x43A996e185eC15538b20ea0e3C4c68aEe6Cfe79a") as Address,
  SEMI6: (process.env.NEXT_PUBLIC_SEMI6_ADDRESS || "0xD1fb21D214C249a18DcAaE6d1acA84A4b2Ec8c33") as Address,
  CRYPTOEQ: (process.env.NEXT_PUBLIC_CRYPTOEQ_ADDRESS || "0x7f1a855f22733db560f4E06d5Fb3Cc0590D26550") as Address,
  SPYQQQ: (process.env.NEXT_PUBLIC_SPYQQQ_ADDRESS || "0xa76aB5F20a825647Ec3967822Cef1D018D5C0B1D") as Address,
} as const;

// Synthetic boxes hold ETH collateral only; "token" here is the feed proxy used purely for
// per-component price display, "weightBps" is the box weight. No underlying token is held.
const SYNTH_FEEDS = {
  NVDA: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",
  AMD: "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72",
  MU: "0x425EEFdCf05ed6526C3cE61Af99429A228a6d596",
  TSM: "0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F",
  INTC: "0x3f390C5C24628Ac7C489515402235FeAD71D1913",
  ASML: "0xB4106147E8cce40b7d46124090d373A71b70f87D",
  COIN: "0xA3a468A452940B7D6b69991207B508c609a98Ef2",
  MSTR: "0x396118bdFB181e6240E74D243F266B061c0edc3D",
  CRCL: "0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a",
  SPY: "0x319724394D3A0e3669269846abE664Cd621f9f6A",
  QQQ: "0x80901d846d5D7B030F26B480776EE3b29374C2ae",
} as const;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
function synthComponent(symbol: string, name: string, weightBps: bigint): BoxComponent {
  return { symbol, name, token: ZERO, feed: SYNTH_FEEDS[symbol as keyof typeof SYNTH_FEEDS] as Address, weightBps, thinPoolWarning: false };
}

export const ALL_BOXES: readonly BoxInfo[] = [
  {
    id: 1n,
    kind: "engine",
    name: "MAG7 Bento Box",
    symbol: "MAG7",
    description: "Equal-weight basket of seven tokenized equities with on-chain reserve accounting.",
    token: (process.env.NEXT_PUBLIC_MAG7_BOX_TOKEN_ADDRESS || "0xA4d595f7BECafAAFD3FD279776551D88AD4B26e5") as Address,
    zapper: (process.env.NEXT_PUBLIC_USDG_ZAPPER_ADDRESS || "0x720a5FE26B63498B4b9fD3659167FF001c8BA633") as Address,
    art: "/boxes/mag7-512.png",
    thumb: "/boxes/mag7-128.png",
    componentSummary: "NVDA · AAPL · MSFT · GOOGL · AMZN · META · TSLA",
    boxType: "backed",
    components: [
      { symbol: "NVDA", name: "NVIDIA", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" as Address, feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15" as Address, weightBps: 1428n, thinPoolWarning: false },
      { symbol: "AAPL", name: "Apple", token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" as Address, feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0" as Address, weightBps: 1428n, thinPoolWarning: false },
      { symbol: "MSFT", name: "Microsoft", token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74" as Address, feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E" as Address, weightBps: 1428n, thinPoolWarning: true },
      { symbol: "GOOGL", name: "Alphabet", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" as Address, feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b" as Address, weightBps: 1428n, thinPoolWarning: false },
      { symbol: "AMZN", name: "Amazon", token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54" as Address, feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C" as Address, weightBps: 1428n, thinPoolWarning: false },
      { symbol: "META", name: "Meta", token: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35" as Address, feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1" as Address, weightBps: 1428n, thinPoolWarning: true },
      { symbol: "TSLA", name: "Tesla", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" as Address, feed: "0x4A1166a659A55625345e9515b32adECea5547C38" as Address, weightBps: 1432n, thinPoolWarning: false },
    ],
  },
  {
    id: 2n,
    kind: "engine",
    name: "AI3 Bento Box",
    symbol: "AI3",
    description: "Equal-weight basket of three tokenized AI equities with on-chain reserve accounting.",
    token: (process.env.NEXT_PUBLIC_AI3_BOX_TOKEN_ADDRESS || "0xa98AC72547c656520BD2DaD3C38F619e7EC21BB2") as Address,
    zapper: (process.env.NEXT_PUBLIC_AI3_ZAPPER_ADDRESS || "0xC41c6513901530BCd58CF6404777A4AC0fbD05ff") as Address,
    art: "/boxes/ai3-512.png",
    thumb: "/boxes/ai3-128.png",
    componentSummary: "NVDA · AMD · MU",
    boxType: "backed",
    components: [
      { symbol: "NVDA", name: "NVIDIA", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" as Address, feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15" as Address, weightBps: 3333n, thinPoolWarning: false },
      { symbol: "AMD", name: "AMD", token: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC" as Address, feed: "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72" as Address, weightBps: 3333n, thinPoolWarning: false },
      { symbol: "MU", name: "Micron", token: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD" as Address, feed: "0x425EEFdCf05ed6526C3cE61Af99429A228a6d596" as Address, weightBps: 3334n, thinPoolWarning: false },
    ],
  },
  {
    id: 3n,
    kind: "synthetic",
    name: "Semiconductor Six",
    symbol: "SEMI6",
    description: "Synthetic equal-weight basket of six semiconductor names, ETH-collateralized and oracle-priced.",
    token: SYNTHETIC_BOX_ADDRESSES.SEMI6,
    zapper: PLACEHOLDER_ADDRESS,
    art: "/boxes/semi6-512.png",
    thumb: "/boxes/semi6-128.png",
    componentSummary: "NVDA · AMD · MU · TSM · INTC · ASML",
    boxType: "synthetic",
    components: [
      synthComponent("NVDA", "NVIDIA", 1667n),
      synthComponent("AMD", "AMD", 1667n),
      synthComponent("MU", "Micron", 1667n),
      synthComponent("TSM", "TSMC", 1667n),
      synthComponent("INTC", "Intel", 1666n),
      synthComponent("ASML", "ASML", 1666n),
    ],
  },
  {
    id: 4n,
    kind: "synthetic",
    name: "Crypto Equities",
    symbol: "CRYPTOEQ",
    description: "Synthetic equal-weight basket of crypto-linked equities, ETH-collateralized and oracle-priced.",
    token: SYNTHETIC_BOX_ADDRESSES.CRYPTOEQ,
    zapper: PLACEHOLDER_ADDRESS,
    art: "/boxes/cryptoeq-512.png",
    thumb: "/boxes/cryptoeq-128.png",
    componentSummary: "COIN · MSTR · CRCL",
    boxType: "synthetic",
    components: [
      synthComponent("COIN", "Coinbase", 3333n),
      synthComponent("MSTR", "MicroStrategy", 3333n),
      synthComponent("CRCL", "Circle", 3334n),
    ],
  },
  {
    id: 5n,
    kind: "synthetic",
    name: "SPY QQQ 50 50",
    symbol: "SPYQQQ",
    description: "Synthetic 50/50 blend of the SPY and QQQ index proxies, ETH-collateralized and oracle-priced.",
    token: SYNTHETIC_BOX_ADDRESSES.SPYQQQ,
    zapper: PLACEHOLDER_ADDRESS,
    art: "/boxes/spyqqq-512.png",
    thumb: "/boxes/spyqqq-128.png",
    componentSummary: "SPY · QQQ",
    boxType: "synthetic",
    components: [
      synthComponent("SPY", "SPY 500", 5000n),
      synthComponent("QQQ", "Nasdaq 100", 5000n),
    ],
  },
  {
    id: (process.env.NEXT_PUBLIC_ELON_BOX_ID ? BigInt(process.env.NEXT_PUBLIC_ELON_BOX_ID) : 3n),
    kind: "engine",
    name: "Elon Bento Box",
    symbol: "ELON",
    description: "SpaceX and Tesla in one box, 50/50, fully backed by vault reserves. Ships through the 24h timelock.",
    token: (process.env.NEXT_PUBLIC_ELON_BOX_TOKEN_ADDRESS || PLACEHOLDER_ADDRESS) as Address,
    zapper: (process.env.NEXT_PUBLIC_USDG_ZAPPER_ADDRESS || "0x720a5FE26B63498B4b9fD3659167FF001c8BA633") as Address,
    art: "/boxes/elon-512.png",
    thumb: "/boxes/elon-128.png",
    componentSummary: "SPCX \u00b7 TSLA",
    boxType: "backed",
    components: [
      { symbol: "SPCX", name: "SpaceX", token: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa" as Address, feed: "0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb" as Address, weightBps: 5000n, thinPoolWarning: false },
      { symbol: "TSLA", name: "Tesla", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" as Address, feed: "0x4A1166a659A55625345e9515b32adECea5547C38" as Address, weightBps: 5000n, thinPoolWarning: false },
    ],
  },
] as const;

// All boxes are shown, including ones whose contract has not been executed through the
// timelock yet (token = placeholder). Those render as "launching soon" with mint disabled.
export const BOXES: readonly BoxInfo[] = ALL_BOXES;

export function isSynthetic(box: BoxInfo): boolean {
  return box.kind === "synthetic";
}

export function boxBySymbol(symbol?: string | null): BoxInfo {
  const match = symbol ? BOXES.find((b) => b.symbol.toLowerCase() === symbol.toLowerCase()) : undefined;
  return match ?? BOXES[0];
}

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
    name: "GENESIS_BOX_USD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
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
    name: "getRoundData",
    stateMutability: "view",
    inputs: [{ name: "_roundId", type: "uint80" }],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
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

// SyntheticBox: the vault IS the ERC20 share token. Mint is payable mint() with ETH,
// redeem burns shares for ETH, NAV via navPerShare() (8 decimals, genesis 1e10 = $100).
export const syntheticBoxAbi = [
  { type: "function", name: "GENESIS_BOX_USD", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "navPerShare", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "ethUsdPrice", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalCollateral", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "accruedFees", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "mintFeeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "redeemFeeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "componentCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function", name: "component", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }],
    outputs: [{ name: "adapter", type: "address" }, { name: "weightBps", type: "uint256" }, { name: "basePrice", type: "uint256" }],
  },
  {
    type: "function", name: "previewMint", stateMutability: "view", inputs: [{ name: "ethIn", type: "uint256" }],
    outputs: [{ name: "sharesOut", type: "uint256" }, { name: "fee", type: "uint256" }],
  },
  {
    type: "function", name: "previewRedeem", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "ethOut", type: "uint256" }, { name: "fee", type: "uint256" }],
  },
  { type: "function", name: "mint", stateMutability: "payable", inputs: [], outputs: [{ name: "sharesOut", type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ name: "ethOut", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export function hasZapperAddress() {
  return contracts.usdgZapper !== PLACEHOLDER_ADDRESS;
}

export function hasDeployAddresses() {
  return contracts.boxEngine !== PLACEHOLDER_ADDRESS && contracts.mag7BoxToken !== PLACEHOLDER_ADDRESS && contracts.mag7Vault !== PLACEHOLDER_ADDRESS && contracts.v4Adapter !== PLACEHOLDER_ADDRESS;
}

export function hasBentoAddresses() {
  return contracts.bentoToken !== PLACEHOLDER_ADDRESS;
}
