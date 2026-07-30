import type { Address } from "viem";

// Component feed directory for the builder. Feed addresses verified against
// the Chainlink reference data directory for Robinhood Chain mainnet
// (feeds-robinhood-mainnet.json), all 8 decimals.
//
// Adapter addresses are the deployed ChainlinkAdapter wrappers (not the raw
// feeds), deployed on RH mainnet 2026-07-24 via bento-synth
// script/DeployAdapters.s.sol. Entries with adapter = undefined render as
// "adapter pending" and cannot be selected for launch.
export type FeedEntry = {
  symbol: string;
  name: string;
  // Address of the deployed ChainlinkAdapter for this feed (not the raw feed).
  adapter: Address | undefined;
  // Underlying Chainlink feed address, for reference and explorer links.
  feed: Address | undefined;
  // Suggested max staleness in seconds (equity feeds pause on weekends).
  suggestedStaleness: number;
};

export const DEFAULT_STALENESS = 345_600; // 4 days, covers weekend gaps

export const FEEDS: readonly FeedEntry[] = [
  { symbol: "AAPL", name: "Apple", adapter: "0xd8b00343966e4cf3b5103e2d48be995b900892a4", feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "AMD", name: "AMD", adapter: "0x1592c20e800e193471baa48657f722777271867a", feed: "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "AMZN", name: "Amazon", adapter: "0x4431a57e9db97ae9c805c69d5f3111de1b77fe6e", feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "ASML", name: "ASML", adapter: "0x826d0e4fd5c80c2eccf4774fff93f74dc834c028", feed: "0xB4106147E8cce40b7d46124090d373A71b70f87D", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "BABA", name: "Alibaba", adapter: "0x09cc9964513eb895966dfa9955ee004741b287c7", feed: "0x62Cc8F9b5f56a33c9C8A60c8B92779f523c4E984", suggestedStaleness: DEFAULT_STALENESS },
  // CASHCAT, PONS, TENDIES are Robinhood Chain meme coins priced via hoodoracle
  // v3 TWAP USD adapters (Uniswap v3 TWAP x ETH/USD), 24/7 updates. Softer
  // guarantees than the Chainlink stock feeds above; treat prices accordingly.
  { symbol: "CASHCAT", name: "Cash Cat", adapter: "0x3F1bc0B56aAef80D8de57A375593317AEE671cc5", feed: "0xdfE6bA7641a4f536a303c46cfEFD673aF75ca286", suggestedStaleness: 86_400 },
  { symbol: "CLSK", name: "CleanSpark", adapter: "0xc02590a6878c46e653c8795e707d28ec56b913cc", feed: "0x810c12D3a554Bc47fd39597Fe3b3AAC4941F50eF", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "COIN", name: "Coinbase", adapter: "0xc4a45772fdc1b803cec4cb3a1e18ceffd8cc9d1a", feed: "0xA3a468A452940B7D6b69991207B508c609a98Ef2", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "CRCL", name: "Circle", adapter: "0x1552f6d4ff9b9297b31cf6cda2eafff7a8399589", feed: "0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "CRWV", name: "CoreWeave", adapter: "0x09f76b7cc1844d6a9d27f9243371452da4fbd61a", feed: "0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "DELL", name: "Dell", adapter: "0x2c034e9c0d225cd6cef8d52323a1b4435edf81d0", feed: "0x1C6c8cADBe02E19129c39dDB92281cE4c0bf206b", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "GME", name: "GameStop", adapter: "0x22161d93ccd4d89bbf310980d5fc75fe5dad4640", feed: "0x27C71df6A64fB476468EdF256CF72c038baB5B67", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "GOOGL", name: "Alphabet", adapter: "0x6e779b8ec1c51afcca8fdf5868020a5a886ec29a", feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "INTC", name: "Intel", adapter: "0xa1afff7e5611c2a21e69510dda0371636c9727b5", feed: "0x3f390C5C24628Ac7C489515402235FeAD71D1913", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "IONQ", name: "IonQ", adapter: "0x0a646463d285ea874648d85b2bd961bf57f23ad1", feed: "0x22EfeC4919baf55F360E0EDee4AbEB26DE4971eb", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "META", name: "Meta", adapter: "0x08f6332e1c1130342c0116b413101ce253636207", feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "MSFT", name: "Microsoft", adapter: "0xbe111d664a2287713d8549b45f9cbc727e25f924", feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "MSTR", name: "Strategy", adapter: "0x78c3d747f563f4d70b3bac7415f13b7bb1061dcf", feed: "0x396118bdFB181e6240E74D243F266B061c0edc3D", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "MU", name: "Micron", adapter: "0xf79b13807289457dd0708e7ae0ccd69b3a44d42d", feed: "0x425EEFdCf05ed6526C3cE61Af99429A228a6d596", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "NBIS", name: "Nebius", adapter: "0x133d5fc48e78fa8342090266c7977880f7e4a378", feed: "0xE1D87B116Ba0fe898998f1D140339D1fA1E09705", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "NFLX", name: "Netflix", adapter: "0x969b9d7ad68b4ba2143192b539b3cfa0073c5def", feed: "0x04F9190Aa8DCdEb0425b2d54aAEEB220EeBBa7D5", suggestedStaleness: 900 },
  { symbol: "NVDA", name: "NVIDIA", adapter: "0x4b2026f0f1ece9ff2525d9141af063c54aaa1722", feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "ORCL", name: "Oracle", adapter: "0xb380a561e49e3e8c99521a2dc1e938a734e1e3d5", feed: "0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "PLTR", name: "Palantir", adapter: "0x8571f748c5d08df1c995a7a563cfabb30e453337", feed: "0x820ABedFF239034956B7A9d2F0a331f9F075eB4c", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "PONS", name: "Pons", adapter: "0x1dd831204990679588f184073649D6abd02076Fd", feed: "0x33ab56F507dcda241F07ad7F0cf89611af32F35d", suggestedStaleness: 86_400 },
  { symbol: "QQQ", name: "Invesco QQQ", adapter: "0x571b1189b186e64c65ca3fe07a6790d6b97a3ecd", feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "RGTI", name: "Rigetti", adapter: "0xb560f00a147b26f532d5dc58c258c46a3f328eeb", feed: "0x2A045cF1C49c61c166C036d2f06FA2D2d984f765", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "RKLB", name: "Rocket Lab", adapter: "0xf199c47e70345dfc1d4cb58920f3805aeb2b7e29", feed: "0x045477BF65Aef6f4F2386ad0164579e48381CC74", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "SLV", name: "iShares Silver", adapter: "0x7458d8ed1ab7396d2f4631d04abee35bfe3fcb05", feed: "0x209b73908e92Ae021826eD79609845451Ecba2ce", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "SNDK", name: "Sandisk", adapter: "0xcad6eeb823d768828d389e422c90d89b1beab445", feed: "0xfb133Fa4B7b385802B693a293606682Df47109A3", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "SPCX", name: "SpaceX", adapter: "0x8f8f7eb23791c665581777ecad2665f60769274a", feed: "0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "SPY", name: "SPDR S&P 500", adapter: "0x7a5cc5267a82d14d98af1f060b6fec1dc3f96990", feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "TENDIES", name: "Tendies", adapter: "0xC3ff9045a3B9F3bfEE584b5198dB66a44Cad1F19", feed: "0xf2d89A553E6EEc797cF2DdE5Eb0Bec1A3897a8bf", suggestedStaleness: 86_400 },
  { symbol: "TSLA", name: "Tesla", adapter: "0xe469af6b9e9c4b93ff8a4d3ab4cecb5cce370919", feed: "0x4A1166a659A55625345e9515b32adECea5547C38", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "TSM", name: "TSMC", adapter: "0x2f9f5ce8575bc96a9c5afdd312d102fe11352b8b", feed: "0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F", suggestedStaleness: DEFAULT_STALENESS },
  { symbol: "USO", name: "US Oil Fund", adapter: "0xdfce8c16c353095921fb06ce12db695b39eb9a26", feed: "0x75a9c76Ef439e2C7c2E5a34Ab105EcFe3766431c", suggestedStaleness: DEFAULT_STALENESS },
] as const;

export function selectableFeeds(): FeedEntry[] {
  return FEEDS.filter((f) => !!f.adapter);
}
