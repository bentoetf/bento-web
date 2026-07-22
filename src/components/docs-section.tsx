import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { contracts, MAG7_COMPONENTS, PLACEHOLDER_ADDRESS, robinhood } from "@/config/contracts";

type DocSlug =
  | "introduction"
  | "quickstart"
  | "how-it-works"
  | "fees"
  | "claims"
  | "proof-of-reserves"
  | "launch-limits"
  | "mag7"
  | "bento-token"
  | "architecture"
  | "admin-timelock"
  | "audit-status"
  | "risks"
  | "contract-addresses"
  | "links";

type DocPage = {
  slug: DocSlug;
  title: string;
  description: string;
  group: string;
  body: React.ReactNode;
};

const repo = "https://github.com/bentoetf/bento-contracts";
const rc3Tag = `${repo}/releases/tag/v1.0.0-rc3`;
const webRepo = "https://github.com/bentoetf/bento-web";
const explorerBase = robinhood.blockExplorers.default.url;

function isUnset(address: string) {
  return address.toLowerCase() === PLACEHOLDER_ADDRESS;
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md border border-[#f5a623]/15 bg-black/35 px-1.5 py-0.5 font-mono text-[0.92em] text-[#faecc9]">{children}</code>;
}

function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#f5a623] underline decoration-[#f5a623]/30 underline-offset-4 hover:text-[#faecc9]">{children}<ExternalLink className="h-3.5 w-3.5" /></a>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-8 text-zinc-300">{children}</p>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-2xl font-semibold tracking-tight text-white">{children}</h2>;
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">{children}</ul>;
}

function RowTable({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 overflow-x-auto rounded-2xl border border-[#f5a623]/15"><table className="w-full min-w-[720px] text-left text-sm text-zinc-300">{children}</table></div>;
}

function AddressCell({ address }: { address: string }) {
  if (isUnset(address)) return <span className="text-zinc-500">not deployed yet</span>;
  return <a href={`${explorerBase}/address/${address}`} target="_blank" rel="noreferrer" className="font-mono text-[#f5a623] underline decoration-[#f5a623]/30 underline-offset-4">{short(address)}</a>;
}

const addressRows = [
  ["BoxEngine", "NEXT_PUBLIC_BOX_ENGINE_ADDRESS", contracts.boxEngine],
  ["MAG7 BoxToken", "NEXT_PUBLIC_MAG7_BOX_TOKEN_ADDRESS", contracts.mag7BoxToken],
  ["MAG7 BoxVault", "NEXT_PUBLIC_MAG7_VAULT_ADDRESS", contracts.mag7Vault],
  ["UniswapV4Adapter", "NEXT_PUBLIC_V4_ADAPTER_ADDRESS", contracts.v4Adapter],
  ["BENTO (pons)", "NEXT_PUBLIC_BENTO_TOKEN_ADDRESS", contracts.bentoToken],
  ["FeeCollector", "NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS", contracts.feeCollector],
] as const;

export const docsPages: DocPage[] = [
  {
    slug: "introduction",
    group: "WELCOME",
    title: "Introduction",
    description: "What Bento is and what the MAG7 box represents.",
    body: <>
      <Paragraph>Bento is a Robinhood Chain protocol for on-chain stock index boxes: ERC-20 box tokens backed by underlying tokenized equities held on-chain. At mint, the intended accounting scale is <InlineCode>1 BOX = 1 USD</InlineCode> of underlying tokenized equities, while NAV floats afterward with the live value of the basket.</Paragraph>
    </>,
  },
  {
    slug: "quickstart",
    group: "WELCOME",
    title: "Quickstart",
    description: "Connect, mint MAG7 with ETH, and redeem when needed.",
    body: <>
      <List>
        <li><strong className="text-white">Connect wallet.</strong> Use the single Connect button in the header and switch to Robinhood Chain if prompted.</li>
        <li><strong className="text-white">Mint MAG7.</strong> On the Mint page, enter ETH, quote the route, review slippage limits, then submit the mint once contracts are deployed.</li>
        <li><strong className="text-white">Receive box tokens.</strong> A successful mint sends MAG7 box tokens to the recipient wallet. Those tokens represent a claim on the underlying basket reserves.</li>
        <li><strong className="text-white">Redeem.</strong> Use the Redeem page to burn MAG7 for ETH through reverse routes or redeem for the underlying tokenized stocks.</li>
      </List>
    </>,
  },
  {
    slug: "how-it-works",
    group: "PROTOCOL",
    title: "How it works",
    description: "Mint, redeem, vault custody, and NAV calculation.",
    body: <>
      <H2>Mint flow</H2>
      <Paragraph>The MAG7 mint path takes ETH, routes through USDG, and acquires each underlying tokenized stock through the configured Uniswap V4 adapter route. The frontend quotes each component route before submit and passes per-component minimum outputs to the engine.</Paragraph>
      <H2>Redeem flow</H2>
      <Paragraph>Redeem burns MAG7 box tokens and returns either the underlying stocks or ETH. ETH redemptions use reverse adapter routes and user-provided minimum outputs. If one component leg cannot complete, the protocol records a claim for that component instead of treating the whole exit as successful.</Paragraph>
      <H2>Custody</H2>
      <Paragraph>Underlying stocks for a box are held by a dedicated <InlineCode>BoxVault</InlineCode>. The vault is controlled by <InlineCode>BoxEngine</InlineCode>; users access assets through mint, redeem, and claim paths.</Paragraph>
      <H2>NAV</H2>
      <Paragraph>NAV uses Chainlink-style stock/USD feeds and the ETH/USD feed for display and sanity checks. Feed staleness is surfaced as <InlineCode>market closed</InlineCode> in the interface where appropriate.</Paragraph>
    </>,
  },
  {
    slug: "fees",
    group: "PROTOCOL",
    title: "Fees",
    description: "Mint/redeem fee settings and where fees go.",
    body: <>
      <List>
        <li><strong className="text-white">Mint fee:</strong> <InlineCode>30 bps</InlineCode>.</li>
        <li><strong className="text-white">Redeem fee:</strong> <InlineCode>30 bps</InlineCode>.</li>
        <li><strong className="text-white">Hard cap:</strong> fees are capped in code at <InlineCode>100 bps</InlineCode>.</li>
        <li><strong className="text-white">Destination:</strong> fees route to <InlineCode>FeeCollector</InlineCode>, which is designed to feed the BENTO buyback-and-burn path once liquidity and production addresses exist.</li>
      </List>
    </>,
  },
  {
    slug: "claims",
    group: "PROTOCOL",
    title: "Claims",
    description: "Failed-leg claims and how users execute them.",
    body: <>
      <Paragraph>If a redeem leg fails because an underlying token transfer or swap cannot complete, the engine records a pending claim for that component. Reserved claim accounting prevents later redemptions from double-counting assets owed to earlier claimants.</Paragraph>
      <Paragraph>Users can open the Portfolio page, review pending failed-leg claims, and use the <InlineCode>Execute</InlineCode> button for each claim once the underlying token can be transferred.</Paragraph>
    </>,
  },
  {
    slug: "proof-of-reserves",
    group: "PROTOCOL",
    title: "Proof of Reserves",
    description: "How backing can be checked on-chain.",
    body: <>
      <Paragraph>Proof of reserves is based on live vault balances, box token supply, and per-stock component configuration. The Reserves page reads the backing view and shows each stock token balance beside the MAG7 box supply once deployment addresses are configured.</Paragraph>
      <Paragraph>Before deployment, the interface shows <InlineCode>not deployed yet</InlineCode> or dimmed placeholders instead of linking to placeholder addresses or rendering fake reserve figures.</Paragraph>
    </>,
  },
  {
    slug: "launch-limits",
    group: "PROTOCOL",
    title: "Launch limits",
    description: "Small initial caps for route and accounting safety.",
    body: <>
      <List>
        <li><strong className="text-white">MAG7 TVL cap:</strong> <InlineCode>15 ETH</InlineCode>.</li>
        <li><strong className="text-white">Per-transaction mint cap:</strong> <InlineCode>2 ETH</InlineCode>.</li>
      </List>
      <Paragraph>These limits exist because the launch relies on live DEX liquidity, oracle freshness, tokenized-stock transfer behavior, and unreviewed production usage. Small caps limit blast radius while the system is observed.</Paragraph>
    </>,
  },
  {
    slug: "mag7",
    group: "BOXES",
    title: "MAG7",
    description: "The first Bento box and its fixed v1 weights.",
    body: <>
      <Paragraph>MAG7 is the first Bento box. It uses fixed weights for seven tokenized equities. Six components are weighted at <InlineCode>14.28%</InlineCode>; TSLA is <InlineCode>14.32%</InlineCode> to make the basis-point total equal <InlineCode>100%</InlineCode>.</Paragraph>
      <RowTable><thead className="bg-[#f5a623]/5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/70"><tr><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Weight</th></tr></thead><tbody>{MAG7_COMPONENTS.map((component) => <tr key={component.symbol} className="border-t border-[#f5a623]/10"><td className="px-4 py-3 font-mono text-white">{component.symbol}</td><td className="px-4 py-3">{component.name}</td><td className="px-4 py-3 font-mono">{(Number(component.weightBps) / 100).toFixed(2)}%</td></tr>)}</tbody></RowTable>
      <H2>Rationale and rebalancing</H2>
      <Paragraph>The v1 box uses an equal-weight design so each component receives a similar target allocation at mint. There is no automatic rebalancing policy in v1; weights are fixed at mint and NAV floats with the held assets.</Paragraph>
    </>,
  },
  {
    slug: "bento-token",
    group: "BENTO TOKEN",
    title: "BENTO token",
    description: "Supply and buyback-and-burn mechanics.",
    body: <>
      <Paragraph>BENTO is the protocol token. It is launched on the pons.family launchpad on Robinhood Chain as a fixed-supply ERC-20 (1,000,000,000 tokens, 18 decimals) with an automatically created and locked Uniswap V3 pool against WETH. Bento Protocol does not deploy its own token contract and holds no mint or admin authority over BENTO.</Paragraph>
      <Paragraph>BENTO has no transfer tax. Trading happens in the pons pool with its standard 1% pool fee; a fixed share of those pool fees goes to the token creator under the split snapshotted by pons at launch, and the rest to the pons protocol.</Paragraph>
      <Paragraph>Protocol fees from box mint/redeem accrue to <InlineCode>FeeCollector</InlineCode>. The collector is designed to buy BENTO through a Sushi V2 route and send purchased tokens to the burn destination. Because the pons pool is Uniswap V3, buyback requires a separate Sushi V2 BENTO/WETH bridge pool; until that pool exists, fees simply accumulate in the collector. This documentation does not include token price discussion or future-return projections.</Paragraph>
    </>,
  },
  {
    slug: "architecture",
    group: "SECURITY",
    title: "Architecture",
    description: "Contract list and one-line role for each piece.",
    body: <>
      <RowTable><thead className="bg-[#f5a623]/5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/70"><tr><th className="px-4 py-3">Contract</th><th className="px-4 py-3">Role</th></tr></thead><tbody>{[
        ["BoxEngine", "Creates boxes, executes mint/redeem/claim logic, tracks fees and caps."],
        ["BoxToken", "ERC-20 token representing a claim on a specific box basket."],
        ["BoxVault", "Dedicated custody contract that holds the underlying stocks for one box."],
        ["BENTO (external)", "Fixed-supply ERC-20 launched on pons.family; used by the fee buyback-and-burn path. Not deployed or controlled by Bento Protocol."],
        ["FeeCollector", "Receives protocol fees and executes BENTO buyback-and-burn operations."],
        ["BoxRegistry", "Maps box identifiers to engine versions for discovery and versioning."],
        ["UniswapV4Adapter", "Adapter used for configured Uniswap V4 stock routes."],
      ].map(([name, role]) => <tr key={name} className="border-t border-[#f5a623]/10"><td className="px-4 py-3 font-mono text-white">{name}</td><td className="px-4 py-3">{role}</td></tr>)}</tbody></RowTable>
    </>,
  },
  {
    slug: "admin-timelock",
    group: "SECURITY",
    title: "Admin & Timelock",
    description: "Admin operations and user paths.",
    body: <>
      <Paragraph>Admin operations sit behind a <InlineCode>TimelockController</InlineCode> owned by a <InlineCode>2-of-3 Safe</InlineCode>. The timelock is deployed with a zero delay for one-time launch configuration, and the delay is raised to <InlineCode>24h</InlineCode> as the final launch operation, before public launch. Every admin action after that point is subject to the full 24-hour delay. Admin addresses are immutable where the deployed contracts require that pattern.</Paragraph>
      <Paragraph>User exit paths are not meant to be gated by admin actions. Redeem paths remain available by construction, while mint can be paused or capped for risk control.</Paragraph>
    </>,
  },
  {
    slug: "audit-status",
    group: "SECURITY",
    title: "Audit status",
    description: "Bento is unaudited and should be independently reviewed.",
    body: <>
      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm leading-7 text-red-100"><strong>UNAUDITED.</strong> Bento v1 contracts are not audited. They should receive experienced Solidity review before meaningful value is placed at risk.</div>
      <H2>Path to audit</H2>
      <Paragraph>Protocol fees are intended to fund an independent security audit as a priority. The launch caps (<InlineCode>15 ETH TVL</InlineCode>, <InlineCode>2 ETH per transaction</InlineCode>) will not be raised until an independent audit has been completed and published. No audit firm is engaged yet; this page will link the report when one exists.</Paragraph>
      <Paragraph>Source code is public in the contracts repository: <ExternalAnchor href={repo}>bento-contracts</ExternalAnchor>. The current release-candidate tag is <ExternalAnchor href={rc3Tag}>v1.0.0-rc3</ExternalAnchor>. Independent review is welcome.</Paragraph>
    </>,
  },
  {
    slug: "risks",
    group: "SECURITY",
    title: "Risks",
    description: "Known risks and limitations from the contract repo.",
    body: <>
      <List>
        <li><strong className="text-white">Smart contract risk.</strong> The contracts are unaudited release-candidate code and may contain bugs.</li>
        <li><strong className="text-white">Oracle/feed staleness.</strong> Production feed age defaults to <InlineCode>24h</InlineCode>. Weekend or holiday mints can revert with stale feeds; redeem-for-stocks does not depend on feeds.</li>
        <li><strong className="text-white">DEX liquidity risk.</strong> Mint and redeem-for-ETH depend on available Uniswap V4 route depth and frontend-supplied per-component slippage minima.</li>
        <li><strong className="text-white">Robinhood tokenized-stock issuer risk.</strong> Component tokens may pause transfers, apply blocklists, or have issuer-controlled restrictions. Paused transfers can become claims, but broad restrictions can still require operational handling.</li>
        <li><strong className="text-white">Adapter and route configuration risk.</strong> V4 adapter routes require correct stock/USD feeds and ETH/USD configuration for sanity and NAV math.</li>
        <li><strong className="text-white">Buyback execution risk.</strong> FeeCollector buybacks are rate-limited, but keepers still need sane off-chain minimum output calculations. Buyback requires a Sushi V2 BENTO/WETH pool; until one is seeded, fees accumulate in the collector without burning.</li>
        <li><strong className="text-white">External token risk.</strong> BENTO is launched through the pons.family factory and its pool liquidity is locked by pons contracts; Bento Protocol has no control over the pons factory, locker, or fee-claim mechanics.</li>
      </List>
      <Paragraph>See the contracts repo <ExternalAnchor href={`${repo}/blob/main/RISKS.md`}>RISKS.md</ExternalAnchor> for the canonical engineering risk notes.</Paragraph>
    </>,
  },
  {
    slug: "contract-addresses",
    group: "REFERENCE",
    title: "Contract addresses",
    description: "Environment-driven address book for the frontend.",
    body: <>
      <Paragraph>This table is wired to the same environment variables used by the app. Unset addresses render as <InlineCode>not deployed yet</InlineCode>; the docs never print or link placeholder zero addresses.</Paragraph>
      <RowTable><thead className="bg-[#f5a623]/5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/70"><tr><th className="px-4 py-3">Contract</th><th className="px-4 py-3">Env var</th><th className="px-4 py-3">Address</th></tr></thead><tbody>{addressRows.map(([label, env, address]) => <tr key={label} className="border-t border-[#f5a623]/10"><td className="px-4 py-3 font-mono text-white">{label}</td><td className="px-4 py-3 font-mono text-zinc-500">{env}</td><td className="px-4 py-3"><AddressCell address={address} /></td></tr>)}</tbody></RowTable>
    </>,
  },
  {
    slug: "links",
    group: "REFERENCE",
    title: "Links",
    description: "Official project links currently available.",
    body: <>
      <List>
        <li><ExternalAnchor href={repo}>Contracts GitHub repository</ExternalAnchor></li>
        <li><ExternalAnchor href={webRepo}>Frontend GitHub repository</ExternalAnchor></li>
        <li><span className="text-white">X:</span> official account is not configured in this repository yet.</li>
      </List>
    </>,
  },
];

export const groupedDocs = docsPages.reduce<Record<string, DocPage[]>>((groups, page) => {
  groups[page.group] = groups[page.group] ? [...groups[page.group], page] : [page];
  return groups;
}, {});

export function getDocPage(slug?: string) {
  if (!slug) return docsPages[0];
  return docsPages.find((page) => page.slug === slug);
}

function Sidebar({ activeSlug }: { activeSlug: string }) {
  return <nav className="space-y-7 text-sm">{Object.entries(groupedDocs).map(([group, pages]) => <div key={group}><p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f5a623]/70">{group}</p><div className="space-y-1">{pages.map((page) => <Link key={page.slug} href={`/docs/${page.slug}`} className={`block rounded-xl px-3 py-2 transition ${page.slug === activeSlug ? "bg-[#f5a623]/10 text-[#faecc9]" : "text-zinc-400 hover:bg-white/[0.03] hover:text-[#f5a623]"}`}>{page.title}</Link>)}</div></div>)}</nav>;
}

function PrevNext({ activeSlug }: { activeSlug: string }) {
  const index = docsPages.findIndex((page) => page.slug === activeSlug);
  const prev = index > 0 ? docsPages[index - 1] : undefined;
  const next = index >= 0 && index < docsPages.length - 1 ? docsPages[index + 1] : undefined;
  return <div className="mt-12 grid gap-3 border-t border-[#f5a623]/10 pt-6 sm:grid-cols-2">{prev ? <Link href={`/docs/${prev.slug}`} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-4 text-sm text-zinc-400 hover:border-[#f5a623]/40 hover:text-[#faecc9]"><span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/70"><ChevronLeft className="h-4 w-4" />Previous</span><span className="mt-2 block text-base text-white">{prev.title}</span></Link> : <div />}{next ? <Link href={`/docs/${next.slug}`} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-4 text-right text-sm text-zinc-400 hover:border-[#f5a623]/40 hover:text-[#faecc9]"><span className="flex items-center justify-end gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/70">Next<ChevronRight className="h-4 w-4" /></span><span className="mt-2 block text-base text-white">{next.title}</span></Link> : <div />}</div>;
}

export function BentoDocsPage({ slug = "introduction" }: { slug?: string }) {
  const page = getDocPage(slug) ?? docsPages[0];
  return <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]"><aside className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto"><details className="rounded-3xl border border-[#f5a623]/15 bg-[#10100e] p-4 lg:hidden"><summary className="cursor-pointer list-none font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#f5a623]">Documentation menu</summary><div className="mt-5"><Sidebar activeSlug={page.slug} /></div></details><div className="hidden rounded-3xl border border-[#f5a623]/15 bg-[#10100e] p-5 lg:block"><Sidebar activeSlug={page.slug} /></div></aside><article className="min-w-0 rounded-3xl border border-[#f5a623]/15 bg-[#10100e] px-5 py-7 sm:px-8 lg:px-10"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f5a623]/70">{page.group}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{page.title}</h1><p className="mt-4 max-w-3xl text-base leading-8 text-zinc-400">{page.description}</p><div className="mt-8 space-y-5">{page.body}</div><PrevNext activeSlug={page.slug} /></article></div>;
}
