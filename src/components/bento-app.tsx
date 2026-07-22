"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, Copy, ExternalLink, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, formatUnits, parseEther, parseUnits, type Address } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { adapterAbi, boxEngineAbi, contracts, erc20Abi, ETH_USD_FEED, feedAbi, hasBentoAddresses, hasDeployAddresses, hasZapperAddress, MAG7_COMPONENTS, PLACEHOLDER_ADDRESS, robinhood, USDG_ADDRESS, USDG_DECIMALS, zapperAbi } from "@/config/contracts";

type BoxData = readonly [Address, Address, number, number, bigint, boolean, boolean, string];
type BackingData = readonly [readonly Address[], readonly bigint[], readonly bigint[], readonly bigint[]];
type QuoteState = { boxOut?: bigint; minBoxOut?: bigint; componentMins?: bigint[]; componentQuotes?: bigint[]; ethOut?: bigint; minEthOut?: bigint; error?: string };

const BPS = 10_000n;
const explorerBase = robinhood.blockExplorers.default.url;
const SOON = "launching soon";
const navItems = [
  { href: "/", label: "Boxes" },
  { href: "/mint", label: "Mint" },
  { href: "/redeem", label: "Redeem" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/bento", label: "BENTO" },
  { href: "/docs", label: "Docs" },
  { href: "/guide", label: "Guide" },
];

function short(addr?: string) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—"; }
function isZeroAddress(addr: Address) { return addr.toLowerCase() === PLACEHOLDER_ADDRESS; }
function explorerAddress(addr: Address) { return `${explorerBase}/address/${addr}`; }
function parseSafeEther(value: string) { try { return parseEther(value || "0"); } catch { return 0n; } }
function resolveRecipient(input: string, fallback: Address): Address { const trimmed = input.trim(); if (!trimmed) return fallback; if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) throw new Error("Gift recipient must be a valid 0x address."); return trimmed as Address; }
function formatBig(value?: bigint, decimals = 18, precision = 4) { if (value === undefined) return "—"; const raw = formatUnits(value, decimals); const [whole, frac = ""] = raw.split("."); return frac ? `${whole}.${frac.slice(0, precision)}` : whole; }
function formatUsd1e18(value?: bigint) { if (value === undefined) return "—"; return `$${Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; }
function isFeedStale(updatedAt?: bigint) { return !updatedAt || Math.floor(Date.now() / 1000) - Number(updatedAt) > 86_400; }
function usdFromNav(balance?: bigint, navUsdPerBox?: bigint) { if (balance === undefined || navUsdPerBox === undefined) return undefined; return (balance * navUsdPerBox) / 10n ** 18n; }
function usdFromBalance(balance?: bigint, feedAnswer?: bigint, feedDecimals?: number) { if (balance === undefined || feedAnswer === undefined || feedDecimals === undefined) return undefined; return (balance * feedAnswer) / (10n ** BigInt(feedDecimals)); }
function applySlippage(value: bigint, slippagePercent: string) { const bps = BigInt(Math.max(0, Math.min(5000, Math.round(Number(slippagePercent || "0") * 100)))); return (value * (BPS - bps)) / BPS; }
function feedAge(updatedAt?: bigint) { if (!updatedAt) return "—"; const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(updatedAt)); const hours = seconds / 3600; return hours >= 48 ? `${(hours / 24).toFixed(1)} days` : `${hours.toFixed(1)} hours`; }
function friendlyError(error?: unknown) { const text = error instanceof Error ? error.message : String(error || ""); if (!text) return undefined; if (text.includes("FeedStale")) return "market closed"; if (text.includes("PerTxMintCapExceeded")) return "Mint exceeds the 2 ETH per-transaction cap."; if (text.includes("TvlCapExceeded")) return "Mint would exceed the MAG7 TVL cap."; if (text.includes("Slippage")) return "Slippage check failed. Try a smaller size or wider tolerance."; if (text.includes("User rejected")) return "Transaction rejected in wallet."; return text.slice(0, 220); }

function useBentoData() {
  const deployed = hasDeployAddresses();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhood.id });
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const [ethIn, setEthIn] = useState("0.01");
  const [usdgIn, setUsdgIn] = useState("25");
  const [payAsset, setPayAsset] = useState<"ETH" | "USDG">("ETH");
  const [slippage, setSlippage] = useState("1");
  const [redeemAmount, setRedeemAmount] = useState("0");
  const [giftRecipient, setGiftRecipient] = useState("");
  const [mintQuote, setMintQuote] = useState<QuoteState>({});
  const [redeemQuote, setRedeemQuote] = useState<QuoteState>({});
  const [txMessage, setTxMessage] = useState<string>();
  const boxId = contracts.boxId;

  const navRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "navUsdPerBox", args: [boxId], query: { enabled: deployed } });
  const boxRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "boxes", args: [boxId], query: { enabled: deployed } });
  const capRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "perTxMintCapWei", args: [boxId], query: { enabled: deployed } });
  const backingRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "backingDetailed", args: [boxId], query: { enabled: deployed } });
  const boxBalanceRead = useReadContract({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: deployed && !!address } });
  const totalSupplyRead = useReadContract({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "totalSupply", query: { enabled: deployed } });
  const feedReads = useReadContracts({ contracts: MAG7_COMPONENTS.flatMap((c) => [{ address: c.feed, abi: feedAbi, functionName: "latestRoundData" }, { address: c.feed, abi: feedAbi, functionName: "decimals" }]), query: { enabled: deployed } });
  const claimsReads = useReadContracts({ contracts: MAG7_COMPONENTS.map((c) => ({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "pendingClaims", args: [boxId, address || PLACEHOLDER_ADDRESS, c.token] })), query: { enabled: deployed && !!address, staleTime: 0 } });
  const stockBalanceReads = useReadContracts({ contracts: MAG7_COMPONENTS.map((c) => ({ address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [address || PLACEHOLDER_ADDRESS] })), query: { enabled: deployed && !!address, staleTime: 0 } });
  const ethBalanceRead = useBalance({ address, chainId: robinhood.id, query: { enabled: !!address, staleTime: 0 } });
  const ethFeedReads = useReadContracts({ contracts: [{ address: ETH_USD_FEED, abi: feedAbi, functionName: "latestRoundData" }, { address: ETH_USD_FEED, abi: feedAbi, functionName: "decimals" }], query: { enabled: deployed, staleTime: 0 } });
  const bentoSupplyRead = useReadContract({ address: contracts.bentoToken, abi: erc20Abi, functionName: "totalSupply", query: { enabled: hasBentoAddresses(), staleTime: 0 } });
  const bentoBalanceRead = useReadContract({ address: contracts.bentoToken, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: hasBentoAddresses() && !!address, staleTime: 0 } });

  const boxData = boxRead.data as BoxData | undefined;
  const backingData = backingRead.data as BackingData | undefined;
  const tvlUsd = backingData?.[3]?.reduce((sum, v) => sum + v, 0n);
  const mintFeeBps = BigInt(boxData?.[2] ?? 30);
  const redeemFeeBps = BigInt(boxData?.[3] ?? 30);
  const tvlCap = boxData?.[4] ?? contracts.tvlCapWei;
  const perTxCap = capRead.data ?? contracts.perTxMintCapWei;
  const feedInfo = useMemo(() => MAG7_COMPONENTS.map((component, i) => { const round = feedReads.data?.[i * 2]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined; const decimals = feedReads.data?.[i * 2 + 1]?.result as number | undefined; return { component, answer: round?.[1], updatedAt: round?.[3], decimals }; }), [feedReads.data]);

  async function quoteMint() {
    try {
      if (!publicClient || !deployed) throw new Error("Deploy addresses unavailable.");
      const value = parseEther(ethIn || "0");
      if (value > perTxCap) throw new Error("PerTxMintCapExceeded");
      if (value <= 0n) throw new Error("Enter an ETH amount.");
      const simData = encodeFunctionData({ abi: boxEngineAbi, functionName: "simulateMint", args: [boxId, value] });
      const simResult = await publicClient.call({ to: contracts.boxEngine, data: simData, account: address });
      const boxOut = decodeFunctionResult({ abi: boxEngineAbi, functionName: "simulateMint", data: simResult.data ?? "0x" }) as unknown as bigint;
      const net = value - (value * mintFeeBps) / BPS;
      let remaining = net;
      const componentQuotes: bigint[] = [];
      for (let i = 0; i < MAG7_COMPONENTS.length; i++) {
        const part = i === MAG7_COMPONENTS.length - 1 ? remaining : (net * MAG7_COMPONENTS[i].weightBps) / BPS;
        remaining -= part;
        const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteETHToToken", args: [MAG7_COMPONENTS[i].token, part] });
        const result = await publicClient.call({ to: contracts.v4Adapter, data, account: address });
        componentQuotes.push(decodeFunctionResult({ abi: adapterAbi, functionName: "quoteETHToToken", data: result.data ?? "0x" }) as unknown as bigint);
      }
      setMintQuote({ boxOut, minBoxOut: applySlippage(boxOut, slippage), componentQuotes, componentMins: componentQuotes.map((q) => applySlippage(q, slippage)) });
    } catch (error) { setMintQuote({ error: friendlyError(error) }); }
  }

  async function quoteRedeem() {
    try {
      if (!publicClient || !deployed) throw new Error("Deploy addresses unavailable.");
      const boxIn = parseEther(redeemAmount || "0");
      if (boxIn <= 0n) throw new Error("Enter a MAG7 amount.");
      if (!backingData) throw new Error("Backing unavailable.");
      const supply = await publicClient.readContract({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "totalSupply" }) as bigint;
      const componentEthQuotes: bigint[] = [];
      for (let i = 0; i < MAG7_COMPONENTS.length; i++) {
        const componentAmount = (backingData[1][i] * boxIn) / supply;
        const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteTokenToETH", args: [MAG7_COMPONENTS[i].token, componentAmount] });
        const result = await publicClient.call({ to: contracts.v4Adapter, data, account: address });
        componentEthQuotes.push(decodeFunctionResult({ abi: adapterAbi, functionName: "quoteTokenToETH", data: result.data ?? "0x" }) as unknown as bigint);
      }
      const ethOut = componentEthQuotes.reduce((sum, v) => sum + v, 0n);
      setRedeemQuote({ ethOut, minEthOut: applySlippage(ethOut, slippage), componentQuotes: componentEthQuotes, componentMins: componentEthQuotes.map((q) => applySlippage(q, slippage)) });
    } catch (error) { setRedeemQuote({ error: friendlyError(error) }); }
  }

  async function submitMint() { try { if (!address) throw new Error("Connect wallet first."); if (!mintQuote.boxOut || !mintQuote.minBoxOut || !mintQuote.componentMins) await quoteMint(); const value = parseEther(ethIn || "0"); const recipient = resolveRecipient(giftRecipient, address); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "mint", args: [boxId, mintQuote.minBoxOut || 0n, recipient, mintQuote.componentMins || []], value, chainId: robinhood.id }); setTxMessage(`Mint sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }
  async function submitMintUSDG() {
    try {
      if (!address) throw new Error("Connect wallet first.");
      if (!publicClient) throw new Error("Wallet client unavailable.");
      if (!hasZapperAddress()) throw new Error("USDG zapper not deployed yet.");
      const usdgAmount = parseUnits(usdgIn || "0", USDG_DECIMALS);
      if (usdgAmount <= 0n) throw new Error("Enter a USDG amount.");
      // Derive mins for the USDG path independently of the ETH-path quote state.
      // Estimate expected ETH out from the ETH/USD feed (USDG ~ $1), then simulate the mint with that ETH.
      const ethRound = ethFeedReads.data?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
      const ethFeedDec = ethFeedReads.data?.[1]?.result as number | undefined;
      let minEthOut = 0n;
      let minBoxOut = 0n;
      let componentMins: bigint[] = [];
      if (ethRound && ethRound[1] > 0n && ethFeedDec !== undefined) {
        const expectedEth = (usdgAmount * 10n ** 18n * 10n ** BigInt(ethFeedDec)) / (10n ** BigInt(USDG_DECIMALS) * ethRound[1]);
        minEthOut = applySlippage(expectedEth, slippage);
        const simData = encodeFunctionData({ abi: boxEngineAbi, functionName: "simulateMint", args: [boxId, minEthOut] });
        const simResult = await publicClient.call({ to: contracts.boxEngine, data: simData, account: address });
        const boxOut = decodeFunctionResult({ abi: boxEngineAbi, functionName: "simulateMint", data: simResult.data ?? "0x" }) as unknown as bigint;
        minBoxOut = applySlippage(boxOut, slippage);
        const net = minEthOut - (minEthOut * mintFeeBps) / BPS;
        let remaining = net;
        for (let i = 0; i < MAG7_COMPONENTS.length; i++) {
          const part = i === MAG7_COMPONENTS.length - 1 ? remaining : (net * MAG7_COMPONENTS[i].weightBps) / BPS;
          remaining -= part;
          const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteETHToToken", args: [MAG7_COMPONENTS[i].token, part] });
          const result = await publicClient.call({ to: contracts.v4Adapter, data, account: address });
          componentMins.push(applySlippage(decodeFunctionResult({ abi: adapterAbi, functionName: "quoteETHToToken", data: result.data ?? "0x" }) as unknown as bigint, slippage));
        }
      }
      const approveHash = await writeContractAsync({ address: USDG_ADDRESS, abi: erc20Abi, functionName: "approve", args: [contracts.usdgZapper, usdgAmount], chainId: robinhood.id });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      const recipient = resolveRecipient(giftRecipient, address);
      const hash = await writeContractAsync({ address: contracts.usdgZapper, abi: zapperAbi, functionName: "mintWithUSDG", args: [boxId, usdgAmount, minEthOut, minBoxOut, componentMins, recipient], chainId: robinhood.id });
      setTxMessage(`USDG mint sent: ${hash}`);
    } catch (error) { setTxMessage(friendlyError(error)); }
  }
  async function redeemForEth() { try { if (!address) throw new Error("Connect wallet first."); if (!publicClient) throw new Error("Wallet client unavailable."); const boxIn = parseEther(redeemAmount || "0"); const approveHash = await writeContractAsync({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "approve", args: [contracts.boxEngine, boxIn], chainId: robinhood.id }); await publicClient.waitForTransactionReceipt({ hash: approveHash }); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "redeemForETH", args: [boxId, boxIn, redeemQuote.minEthOut || 0n, redeemQuote.componentMins || [], address], chainId: robinhood.id }); setTxMessage(`Redeem for ETH sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }
  async function redeemForStocks() { try { if (!address) throw new Error("Connect wallet first."); if (!publicClient) throw new Error("Wallet client unavailable."); const boxIn = parseEther(redeemAmount || "0"); const approveHash = await writeContractAsync({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "approve", args: [contracts.boxEngine, boxIn], chainId: robinhood.id }); await publicClient.waitForTransactionReceipt({ hash: approveHash }); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "redeemForStocks", args: [boxId, boxIn, address], chainId: robinhood.id }); setTxMessage(`Redeem for stocks sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }
  async function claim(token: Address) { try { if (!address) throw new Error("Connect wallet first."); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "claimPending", args: [boxId, token, address], chainId: robinhood.id }); setTxMessage(`Claim sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }

  return { address, isConnected, deployed, bentoConfigured: hasBentoAddresses(), zapperConfigured: hasZapperAddress(), boxId, navRead, boxRead, capRead, backingRead, boxBalanceRead, stockBalanceReads, ethBalanceRead, ethFeedReads, bentoSupplyRead, bentoBalanceRead, totalSupplyRead, feedReads, claimsReads, boxData, backingData, tvlUsd, mintFeeBps, redeemFeeBps, tvlCap, perTxCap, feedInfo, ethIn, setEthIn, usdgIn, setUsdgIn, payAsset, setPayAsset, giftRecipient, setGiftRecipient, slippage, setSlippage, redeemAmount, setRedeemAmount, mintQuote, redeemQuote, txMessage, writePending, quoteMint, quoteRedeem, submitMint, submitMintUSDG, redeemForEth, redeemForStocks, claim };
}

function BentoLogo() {
  return <div className="relative grid h-8 w-8 place-items-center"><Image src="/brand/bento-logo.svg" alt="Bento logo" width={32} height={32} priority className="h-8 w-8 object-contain" /></div>;
}

function WalletPanel() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected) {
    return <div className="flex items-center gap-3"><span className="font-mono text-xs text-zinc-500">{short(address)} · {chainId ?? "?"}</span><button onClick={() => disconnect()} className="rounded-full border border-[#f5a623] px-5 py-2 text-sm font-semibold text-[#f5a623] hover:bg-[#f5a623]/10">Disconnect</button></div>;
  }

  return <div className="relative"><button onClick={() => setOpen((v) => !v)} className="rounded-full border border-[#f5a623] px-6 py-2 text-sm font-semibold text-[#f5a623] hover:bg-[#f5a623]/10">Connect</button>{open ? <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-[#f5a623]/25 bg-[#10100e] p-3"><p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[#f5a623]/70">Choose wallet</p><div className="space-y-2">{connectors.map((connector) => <button key={connector.uid} disabled={isPending} onClick={() => { connect({ connector, chainId: robinhood.id }); setOpen(false); }} className="w-full rounded-xl border border-[#f5a623]/15 px-4 py-3 text-left text-sm text-zinc-100 hover:border-[#f5a623]/45 hover:bg-[#f5a623]/10 disabled:opacity-50">{connector.name}</button>)}</div></div> : null}</div>;
}

function CaBadge() {
  const [copied, setCopied] = useState(false);
  if (contracts.bentoToken === PLACEHOLDER_ADDRESS) return null;
  const ca = contracts.bentoToken;
  return <button onClick={async () => { try { await navigator.clipboard.writeText(ca); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} title="Copy $BENTO contract address" className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/25 bg-[#f5a623]/5 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition hover:border-[#f5a623]/50 hover:text-[#f5a623]"><span className="font-semibold text-[#f5a623]">$BENTO</span><span>{short(ca)}</span>{copied ? <Check className="h-3 w-3 text-[#22c55e]" /> : <Copy className="h-3 w-3" />}</button>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(true);
  const deployed = hasDeployAddresses();
  return <div className="min-h-screen bg-[#050505]"><header className="sticky top-0 z-30 border-b border-[#f5a623]/10 bg-[#050505]/95 backdrop-blur"><div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8"><div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]"><Link href="/" className="flex items-center gap-3 justify-self-start"><BentoLogo /><span className="text-sm font-semibold tracking-tight text-zinc-100">Bento</span></Link><nav className="flex items-center justify-center gap-8 overflow-x-auto text-sm text-zinc-400">{navItems.map((item) => { const active = pathname === item.href || (item.href === "/" && pathname === "/reserves"); return <Link key={item.href} href={item.href} className={`whitespace-nowrap transition hover:text-[#f5a623] ${active ? "text-[#f5a623]" : ""}`}>{item.label}</Link>; })}</nav><div className="flex items-center gap-3 justify-self-end"><CaBadge /><WalletPanel /></div></div>{!deployed && showBanner ? <div className="mt-3 flex items-center justify-between gap-3 rounded-full border border-[#f5a623]/15 bg-[#f5a623]/5 px-4 py-2 text-xs text-zinc-400"><p><span className="font-mono uppercase tracking-[0.18em] text-[#f5a623]/80">Contracts not yet deployed</span> · launching-soon state, no zero-address reads.</p><button onClick={() => setShowBanner(false)} className="text-zinc-500 hover:text-[#f5a623]">Dismiss</button></div> : null}</div></header><main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">{children}</main><Footer /></div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f5a623]/70">{children}</p>; }
function Panel({ children, className = "", muted = false }: { children: React.ReactNode; className?: string; muted?: boolean }) { return <section className={`rounded-3xl border border-[#f5a623]/15 bg-[#10100e] p-6 ${muted ? "opacity-55 grayscale" : ""} ${className}`}>{children}</section>; }
function Value({ children, large = false, tone, dim = false }: { children: React.ReactNode; large?: boolean; tone?: "green" | "red"; dim?: boolean }) { const color = tone === "green" ? "text-[#22c55e]" : tone === "red" ? "text-[#ef4444]" : "text-zinc-100"; return <span className={`font-mono font-black tabular-nums ${large ? "text-5xl sm:text-7xl" : "text-2xl"} ${color} ${dim ? "opacity-40" : ""}`}>{children}</span>; }
function StatCard({ label, value, caption, dim = false, emptyChart = false }: { label: string; value: string; caption?: string; dim?: boolean; emptyChart?: boolean }) { return <Panel className={`grid min-h-28 items-center gap-4 p-5 ${emptyChart ? "grid-cols-[minmax(0,1fr)_7.5rem]" : ""}`}><div><SectionLabel>{label}</SectionLabel><div className="mt-2"><Value dim={dim}>{value}</Value></div>{caption ? <p className="mt-1 text-xs text-zinc-500">{caption}</p> : null}</div>{emptyChart ? <EmptyChart compact /> : null}</Panel>; }
function EmptyChart({ compact = false }: { compact?: boolean }) { return <div className={`${compact ? "h-14" : "h-36"} rounded-2xl bg-white/[0.03]`} />; }
function BoxArt() { return <div className="relative aspect-square w-full max-w-[18rem] overflow-hidden rounded-3xl bg-black"><Image src="/boxes/mag7-512.png" alt="MAG7 box artwork" fill sizes="(min-width: 1280px) 17rem, 18rem" className="object-cover" priority /></div>; }
function ProofBadge() { return <Link href="/reserves" className="inline-flex items-center gap-2 rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 px-3 py-2 text-xs font-semibold text-[#22c55e]"><Check className="h-3.5 w-3.5" /> <span className="font-mono uppercase tracking-[0.16em]">Proof of reserves</span><span className="text-zinc-300">100% backed by on-chain reserves</span></Link>; }
function FormInput({ label, value, onChange, suffix, large = false }: { label: string; value: string; onChange: (v: string) => void; suffix: string; large?: boolean }) { return <label className="block"><SectionLabel>{label}</SectionLabel><div className="mt-2 flex rounded-2xl border border-[#f5a623]/20 bg-black/45"><input className={`min-w-0 flex-1 bg-transparent px-4 py-4 font-mono font-black text-zinc-100 outline-none tabular-nums ${large ? "text-5xl sm:text-7xl" : "text-lg"}`} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" /><span className="px-4 py-4 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{suffix}</span></div></label>; }
function Action({ children, onClick, disabled, variant = "filled", large = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "filled" | "outline"; large?: boolean }) { return <button onClick={onClick} disabled={disabled} className={`rounded-2xl px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40 ${large ? "w-full py-5" : ""} ${variant === "filled" ? "bg-[#f5a623] text-black hover:brightness-110" : "border border-[#f5a623]/45 text-[#f5a623] hover:bg-[#f5a623]/10"}`}>{children}</button>; }
function Warning({ text }: { text: string }) { return <div className="mt-4 rounded-2xl border border-[#f5a623]/25 bg-[#f5a623]/10 p-3 text-sm text-[#f7c66b]"><AlertTriangle className="mr-2 inline h-4 w-4" />{text}</div>; }
function DisabledHint() { if (hasDeployAddresses()) return null; return <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-600">Launching soon: visible for review, disabled until contract addresses are configured.</p>; }
function Toast({ text }: { text: string }) { return <div className="fixed bottom-4 left-4 right-4 z-20 rounded-2xl border border-[#f5a623]/20 bg-[#10100e] p-4 font-mono text-xs text-zinc-100 sm:left-auto sm:w-[28rem]">{text}</div>; }

export function OverviewPage() {
  const data = useBentoData();
  const overviewFeeBalance = useBalance({ address: contracts.feeCollector, chainId: robinhood.id, query: { enabled: !isZeroAddress(contracts.feeCollector), staleTime: 0 } });
  const overviewFees = !isZeroAddress(contracts.feeCollector) && overviewFeeBalance.data !== undefined ? `${formatBig(overviewFeeBalance.data.value, 18, 5)} ETH` : undefined;
  const navValue = data.deployed ? formatUsd1e18(data.navRead.data as bigint | undefined) : "$—.————";
  const moveValue = data.deployed ? "—" : "$—.————";
  const tvlValue = data.deployed ? formatUsd1e18(data.tvlUsd) : "—";
  const bentoBurned = (() => { const supply = data.bentoSupplyRead.data as bigint | undefined; if (!data.bentoConfigured || supply === undefined) return undefined; const initial = 1_000_000_000n * 10n ** 18n; return supply < initial ? initial - supply : 0n; })();
  return <><section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><Panel className="min-h-[33rem] p-7 sm:p-8"><div className="grid h-full gap-8 xl:grid-cols-[17rem_minmax(0,1fr)_minmax(19rem,0.95fr)]"><div className="flex items-start justify-center xl:justify-start"><BoxArt /></div><div className="flex flex-col justify-center"><SectionLabel>Featured box</SectionLabel><h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">MAG7 Box</h1><p className="mt-4 max-w-md text-base leading-7 text-zinc-400">Equal-weight tokenized equities, redeemable against reserves.</p><div className="mt-6"><ProofBadge /></div></div><div className="flex flex-col justify-center"><SectionLabel>NAV (on-chain)</SectionLabel><div className="mt-3"><Value large dim={!data.deployed}>{navValue}</Value></div>{!data.deployed ? <p className="mt-2 text-sm text-zinc-500">launching soon</p> : null}<p className="mt-2 font-mono text-sm text-zinc-500">24h change: {moveValue}</p><div className="mt-5 flex gap-3"><Link href="/mint" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f5a623] px-6 py-3 text-sm font-semibold text-black hover:brightness-110"><ArrowUpRight className="h-4 w-4" />Mint</Link><Link href="/redeem" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f5a623]/45 px-6 py-3 text-sm font-semibold text-[#f5a623] hover:bg-[#f5a623]/10"><ArrowDownRight className="h-4 w-4" />Redeem</Link></div></div></div></Panel><aside className="grid gap-4"><StatCard label="TVL" value={tvlValue} caption={data.deployed ? "on-chain backing" : "launching soon"} dim={!data.deployed} /><StatCard label="BENTO burned" value={bentoBurned !== undefined ? `${formatBig(bentoBurned, 18, 2)} BENTO` : "—"} caption={bentoBurned !== undefined ? "every mint burns BENTO" : "launching soon"} dim={bentoBurned === undefined} /><StatCard label="Fees collected" value={overviewFees ?? "—"} caption={overviewFees !== undefined ? "ETH awaiting buyback" : "launching soon"} dim={overviewFees === undefined} /></aside></section><section><SectionLabel>Index boxes</SectionLabel><div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3"><BoxCard data={data} /><Panel className="flex min-h-[18rem] items-center justify-center border-dashed"><div className="text-center"><SectionLabel>More boxes soon</SectionLabel><p className="mt-3 text-sm text-zinc-500">New boxes appear here only after real contracts, feeds, and reserves exist.</p></div></Panel></div></section><RoadmapSection /></>;
}

const ROADMAP_ITEMS: { title: string; body: string; status: string }[] = [
  { title: "Pay with USDG", body: "Mint boxes directly with USDG. One transaction swaps to ETH and mints through the same reserve-backed path.", status: "built · deploying after launch" },
  { title: "AI Box", body: "A second index box of AI names with live Chainlink feeds and real on-chain liquidity. Ships through the 24h timelock.", status: "built · deploying after launch" },
  { title: "Elon Box", body: "SpaceX and Tesla in one box, 50/50. Fork-tested against live pools and feeds; ships through the 24h timelock.", status: "built · deploying after launch" },
  { title: "LP with box tokens", body: "A MAG7/USDG pool for one-click buys and a live chart. Mint/redeem arbitrage keeps the pool price pinned to NAV.", status: "planned" },
  { title: "Boxes as collateral", body: "A Chainlink-compatible NAV oracle is built, enabling isolated lending markets where box tokens are collateral for USDG borrowing.", status: "oracle built · market planned" },
  { title: "Request a box", body: "Community-requested baskets, curated and deployed through the timelock. Fully permissionless box creation comes later, after external review.", status: "planned" },
  { title: "Open stats API", body: "Public JSON endpoint with live NAV, TVL, reserves and burn totals, so bots, dashboards and other builders can integrate Bento directly.", status: "built · live at launch" },
  { title: "Earn on your box", body: "Once box tokens work as collateral, an earn view surfaces lending yield on MAG7. Tokenized stocks that earn.", status: "planned" },
  { title: "Vote with BENTO", body: "Holders vote on which box ships next. Winning baskets deploy through the timelock.", status: "planned" },
  { title: "Recurring buys", body: "Set-and-forget DCA into any box, for example 50 USDG of MAG7 every week.", status: "exploring" },
];

function RoadmapSection() {
  return <section><SectionLabel>Coming soon</SectionLabel><p className="mt-2 max-w-2xl text-sm text-zinc-500">In the order they unlock. No dates promised; everything ships through the 24h timelock and gets announced when live.</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{ROADMAP_ITEMS.map((item) => <Panel key={item.title} className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-white">{item.title}</h3><span className="whitespace-nowrap rounded-full border border-[#f5a623]/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f5a623]/80">{item.status}</span></div><p className="mt-3 text-sm leading-6 text-zinc-400">{item.body}</p></Panel>)}</div></section>;
}

function BoxCard({ data }: { data: ReturnType<typeof useBentoData> }) { const nav = data.deployed ? formatUsd1e18(data.navRead.data as bigint | undefined) : "$—.————"; const tvl = data.deployed ? formatUsd1e18(data.tvlUsd) : "—"; return <Panel className="min-h-[18rem]"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="relative h-12 w-12 overflow-hidden rounded-xl bg-black"><Image src="/boxes/mag7-128.png" alt="MAG7 box thumbnail" fill sizes="48px" className="object-cover" loading="lazy" /></div><div><h2 className="text-2xl font-semibold text-white">MAG7 Box</h2><span className="mt-1 inline-flex rounded-full border border-[#f5a623]/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f5a623]">MAG7</span></div></div></div><p className="mt-5 text-sm leading-6 text-zinc-500">Equal-weight basket of seven tokenized equities with on-chain reserve accounting.</p><div className="mt-6 divide-y divide-[#f5a623]/10 border-y border-[#f5a623]/10"><MetricRow label="NAV" value={nav} dim={!data.deployed} /><MetricRow label="24h change" value={data.deployed ? "—" : "—"} dim={!data.deployed} /><MetricRow label="TVL" value={tvl} dim={!data.deployed} /></div></Panel>; }
function MetricRow({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3"><SectionLabel>{label}</SectionLabel><span className={`font-mono text-sm font-bold tabular-nums text-zinc-100 ${dim ? "opacity-40" : ""}`}>{value}</span></div>; }

export function ReservesPage() {
  const data = useBentoData();
  const vaultConfigured = !isZeroAddress(contracts.mag7Vault);
  const totalSupply = data.totalSupplyRead.data as bigint | undefined;
  const backingRatio = (() => { if (!data.deployed || totalSupply === undefined || data.tvlUsd === undefined) return undefined; if (totalSupply === 0n) return "no supply yet"; const nav = data.navRead.data as bigint | undefined; if (nav === undefined) return undefined; const liabilities = (totalSupply * nav) / 10n ** 18n; if (liabilities === 0n) return "no supply yet"; const ratio = Number((data.tvlUsd * 10000n) / liabilities) / 100; return `${ratio.toFixed(2)}%`; })();
  return <Panel muted={!data.deployed}><SectionLabel>Proof of reserves</SectionLabel><h1 className="mt-3 text-4xl font-black text-white">MAG7 reserve table</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">Vault explorer links remain hidden until the vault env var is set. Token links are component token contracts, never zero-address placeholders.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><StatCard label="Total backing" value={data.deployed ? formatUsd1e18(data.tvlUsd) : SOON} emptyChart={false} /><StatCard label="Box supply" value={data.deployed && totalSupply !== undefined ? `${formatBig(totalSupply)} MAG7` : SOON} emptyChart={false} /><StatCard label="Backing ratio" value={backingRatio ?? (data.deployed ? "—" : SOON)} emptyChart={false} /></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/60"><tr><th className="py-3">Stock</th><th>Token</th><th>Weight</th><th>Amount held</th><th>Feed price</th><th>Feed age</th><th>USD value</th>{vaultConfigured ? <th>Verify</th> : null}</tr></thead><tbody>{MAG7_COMPONENTS.map((c, i) => { const price = data.deployed && data.feedInfo[i]?.answer !== undefined && data.feedInfo[i]?.decimals !== undefined ? `$${formatBig(data.feedInfo[i].answer, data.feedInfo[i].decimals, 2)}` : SOON; return <tr key={c.symbol} className="border-t border-[#f5a623]/10"><td className="py-4"><div className="flex items-center gap-3"><StockLogo symbol={c.symbol} /><div><div className="font-mono font-bold text-white">{c.symbol}</div><div className="text-xs text-zinc-500">{c.name}</div></div></div></td><td><a href={explorerAddress(c.token)} target="_blank" rel="noreferrer" className="font-mono text-xs text-zinc-400 underline decoration-[#f5a623]/20 underline-offset-4">{short(c.token)}</a></td><td><WeightBar bps={c.weightBps} /></td><td className="font-mono text-zinc-400">{data.deployed ? formatBig(data.backingData?.[2]?.[i]) : SOON}</td><td className="font-mono text-zinc-400">{price}</td><td className="font-mono text-zinc-400">{data.deployed ? feedAge(data.feedInfo[i]?.updatedAt) : SOON}</td><td className="font-mono text-zinc-400">{data.deployed ? formatUsd1e18(data.backingData?.[3]?.[i]) : SOON}</td>{vaultConfigured ? <td><a href={explorerAddress(contracts.mag7Vault)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#f5a623]/25 px-3 py-2 font-mono text-xs text-[#f5a623]">Vault <ExternalLink className="h-3 w-3" /></a></td> : null}</tr>; })}</tbody></table></div><DisabledHint /></Panel>;
}

function StockLogo({ symbol }: { symbol: string }) { return <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#f5a623]/25 bg-black font-mono text-xs font-black text-[#f5a623]">{symbol.slice(0, 2)}</div>; }
function WeightBar({ bps }: { bps: bigint }) { const pct = Number(bps) / 100; return <div className="min-w-[10rem]"><div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500"><span>Weight</span><span>{pct.toFixed(2)}%</span></div><div className="h-2 rounded-full bg-black"><div className="h-2 rounded-full bg-[#f5a623]" style={{ width: `${pct}%` }} /></div></div>; }

export function MintPage() {
  const data = useBentoData();
  const usingUsdg = data.payAsset === "USDG";
  const overPerTx = (() => { try { return !usingUsdg && parseEther(data.ethIn || "0") > data.perTxCap; } catch { return false; } })();
  const thinPoolWarning = Number(data.ethIn || "0") > 0.05 && !usingUsdg;
  return <section className="mx-auto w-full max-w-3xl"><Panel muted={!data.deployed} className="p-7 sm:p-10"><SectionLabel>Mint MAG7</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Enter {usingUsdg ? "USDG" : "ETH"}</h1><div className="mt-6 flex gap-2">{(["ETH", "USDG"] as const).map((asset) => <button key={asset} type="button" onClick={() => data.setPayAsset(asset)} disabled={asset === "USDG" && !data.zapperConfigured} className={`rounded-full border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition ${data.payAsset === asset ? "border-[#f5a623] bg-[#f5a623]/15 text-[#f5a623]" : "border-[#f5a623]/20 text-zinc-500 hover:text-zinc-300"} ${asset === "USDG" && !data.zapperConfigured ? "cursor-not-allowed opacity-40" : ""}`}>{asset}{asset === "USDG" && !data.zapperConfigured ? " · soon" : ""}</button>)}</div><div className="mt-6">{usingUsdg ? <FormInput label="USDG amount" value={data.usdgIn} onChange={data.setUsdgIn} suffix="USDG" large /> : <FormInput label="ETH amount" value={data.ethIn} onChange={data.setEthIn} suffix="ETH" large />}</div><div className="mt-5"><FormInput label="Send to (optional, gift a box)" value={data.giftRecipient} onChange={data.setGiftRecipient} suffix="0x…" /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><FormInput label="Slippage" value={data.slippage} onChange={data.setSlippage} suffix="%" /><StatCard label="Protocol fee" value={data.deployed ? (usingUsdg ? `${(Number(data.usdgIn || "0") * Number(data.mintFeeBps) / 10000).toFixed(4)} USDG eq.` : `${formatBig(parseSafeEther(data.ethIn) * data.mintFeeBps / BPS, 18, 6)} ETH`) : SOON} emptyChart={false} /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard label="Quote box out" value={data.mintQuote.boxOut ? `${formatBig(data.mintQuote.boxOut)} MAG7` : data.mintQuote.error || (data.deployed ? "—" : SOON)} emptyChart={false} /><StatCard label="Minimum box out" value={data.mintQuote.minBoxOut ? formatBig(data.mintQuote.minBoxOut) : data.deployed ? "—" : SOON} emptyChart={false} /></div>{overPerTx ? <Warning text="This input exceeds the per-transaction mint cap." /> : null}{thinPoolWarning ? <Warning text="Size may exceed ~1% price impact on thinner MSFT/META pools. Consider smaller chunks." /> : null}{usingUsdg ? <Warning text="USDG mint swaps to ETH first (approve + mint, two transactions). Quote shown is for the ETH path; expect a small extra swap fee." /> : null}<div className="mt-8"><Action onClick={data.quoteMint} disabled={!data.deployed} large>Quote mint</Action></div><div className="mt-3"><Action onClick={usingUsdg ? data.submitMintUSDG : data.submitMint} disabled={!data.isConnected || data.writePending || (usingUsdg ? !data.zapperConfigured : !data.mintQuote.minBoxOut)} variant="outline" large>{usingUsdg ? "Mint with USDG" : "Mint"}</Action></div><Breakdown title="Execution guardrails" quotes={data.mintQuote.componentQuotes} mins={data.mintQuote.componentMins} unit="tokens" /><DisabledHint /></Panel>{data.txMessage ? <Toast text={data.txMessage} /> : null}</section>;
}

function Breakdown({ title, quotes, mins, unit }: { title: string; quotes?: bigint[]; mins?: bigint[]; unit: string }) { return <details className="mt-5 rounded-2xl border border-[#f5a623]/15 bg-black/25 p-4"><summary className="flex cursor-pointer list-none items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f5a623]"><span>{title}</span><ChevronDown className="h-4 w-4" /></summary><div className="mt-4 space-y-2 text-sm">{MAG7_COMPONENTS.map((c, i) => <div key={c.symbol} className="rounded-2xl bg-[#10100e] p-3"><div className="flex justify-between"><span className="font-mono font-semibold text-white">{c.symbol}{c.thinPoolWarning ? " · thin" : ""}</span><span className="font-mono text-zinc-500">{unit}</span></div><div className="mt-2 grid gap-1 font-mono text-xs text-zinc-400"><span>Quote: {quotes?.[i] !== undefined ? formatBig(quotes[i], 18, unit === "ETH" ? 6 : 4) : SOON}</span><span>Minimum: {mins?.[i] !== undefined ? formatBig(mins[i], 18, unit === "ETH" ? 6 : 4) : SOON}</span></div></div>)}</div></details>; }

export function RedeemPage() { const data = useBentoData(); const pendingClaims = data.claimsReads.data?.some((r) => ((r.result as bigint | undefined) ?? 0n) > 0n); return <section className="grid gap-5 lg:grid-cols-2"><Panel muted={!data.deployed}>{pendingClaims ? <Link href="/portfolio" className="mb-5 block rounded-2xl border border-[#f5a623]/20 bg-[#f5a623]/10 p-3 text-sm text-[#f5a623]">You have pending failed-leg claims. Open Portfolio to execute claims.</Link> : null}<SectionLabel>Redeem MAG7</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Exit route</h1><div className="mt-5"><StatCard label="Connected balance" value={data.boxBalanceRead.data ? `${formatBig(data.boxBalanceRead.data as bigint)} MAG7` : data.deployed ? "—" : SOON} emptyChart={false} /></div><div className="mt-5"><FormInput label="MAG7 amount" value={data.redeemAmount} onChange={data.setRedeemAmount} suffix="MAG7" large /></div><div className="mt-5"><FormInput label="Slippage" value={data.slippage} onChange={data.setSlippage} suffix="%" /></div><div className="mt-5 grid gap-4"><StatCard label="Redeem fee" value={data.deployed ? `${formatBig(parseSafeEther(data.redeemAmount) * data.redeemFeeBps / BPS, 18, 6)} MAG7` : SOON} emptyChart={false} /><StatCard label="ETH quote" value={data.redeemQuote.ethOut ? `${formatBig(data.redeemQuote.ethOut, 18, 6)} ETH` : data.redeemQuote.error || (data.deployed ? "—" : SOON)} emptyChart={false} /><StatCard label="Minimum ETH out" value={data.redeemQuote.minEthOut ? `${formatBig(data.redeemQuote.minEthOut, 18, 6)} ETH` : data.deployed ? "—" : SOON} emptyChart={false} /></div><div className="mt-5 flex flex-wrap gap-3"><Action onClick={data.quoteRedeem} disabled={!data.deployed}>Quote ETH path</Action><Action onClick={data.redeemForEth} disabled={!data.isConnected || data.writePending} variant="outline">Redeem for ETH</Action><Action onClick={data.redeemForStocks} disabled={!data.isConnected || data.writePending} variant="outline">Redeem for stocks</Action></div><DisabledHint /></Panel><Panel muted={!data.deployed}><SectionLabel>Execution guardrails</SectionLabel><Breakdown title="Redeem ETH leg minimums" quotes={data.redeemQuote.componentQuotes} mins={data.redeemQuote.componentMins} unit="ETH" /></Panel>{data.txMessage ? <Toast text={data.txMessage} /> : null}</section>; }

export function PortfolioPage() {
  const data = useBentoData();
  const ethRound = data.ethFeedReads.data?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  const ethFeedDecimals = data.ethFeedReads.data?.[1]?.result as number | undefined;
  const ethStale = data.deployed && isFeedStale(ethRound?.[3]);
  const boxBalance = data.boxBalanceRead.data as bigint | undefined;
  const boxSupply = data.totalSupplyRead.data as bigint | undefined;
  const stockRows = MAG7_COMPONENTS.map((component, i) => {
    const walletBalance = (data.stockBalanceReads.data?.[i]?.result as bigint | undefined) ?? 0n;
    const vaultShare = boxBalance && boxSupply && boxSupply > 0n ? (((data.backingData?.[2]?.[i] ?? 0n) * boxBalance) / boxSupply) : 0n;
    const balance = walletBalance + vaultShare;
    const feed = data.feedInfo[i];
    const stale = data.deployed && isFeedStale(feed?.updatedAt);
    return {
      symbol: component.symbol,
      name: component.name,
      kind: vaultShare > 0n && walletBalance === 0n ? "via MAG7 box" : "underlying stock",
      amount: data.deployed ? formatBig(balance) : SOON,
      usd: stale ? "market closed" : data.deployed ? formatUsd1e18(usdFromBalance(balance, feed?.answer, feed?.decimals)) : SOON,
    };
  });
  const hasHoldings =
    !!boxBalance ||
    stockRows.some((_, i) => ((data.stockBalanceReads.data?.[i]?.result as bigint | undefined) ?? 0n) > 0n) ||
    ((data.ethBalanceRead.data?.value ?? 0n) > 0n);

  if (!data.isConnected) {
    return (
      <Panel>
        <SectionLabel>Portfolio</SectionLabel>
        <h1 className="mt-2 text-4xl font-black text-white">Connect to view holdings</h1>
        <p className="mt-3 text-sm text-zinc-400">Connect a wallet to read live ETH, MAG7, stock balances, and pending claims.</p>
        <div className="mt-5"><WalletPanel /></div>
      </Panel>
    );
  }

  const totalBoxSupply = data.totalSupplyRead.data as bigint | undefined;
  const supplyShare = (() => { if (!data.deployed || !boxBalance || !totalBoxSupply || totalBoxSupply === 0n) return undefined; const bps = Number((boxBalance * 1000000n) / totalBoxSupply) / 10000; return bps >= 0.01 ? `${bps.toFixed(2)}% of all MAG7` : "<0.01% of all MAG7"; })();
  const ethUsd = ethStale
    ? "market closed"
    : data.deployed
      ? formatUsd1e18(usdFromBalance(data.ethBalanceRead.data?.value, ethRound?.[1], ethFeedDecimals))
      : SOON;

  return (
    <section className="space-y-6">
      <Panel muted={!data.deployed}>
        <SectionLabel>Portfolio</SectionLabel>
        <h1 className="mt-2 text-4xl font-black text-white">Wallet holdings</h1>
        {!data.deployed ? <DisabledHint /> : null}
        {supplyShare ? <p className="mt-3 font-mono text-sm text-[#f5a623]">{supplyShare}</p> : null}
        {data.deployed && !hasHoldings ? (
          <div className="mt-6 rounded-2xl border border-[#f5a623]/10 bg-black/25 p-6 text-sm text-zinc-500">No MAG7, component stock, or ETH holdings found for this wallet.</div>
        ) : null}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/60">
              <tr><th className="py-3">Asset</th><th>Type</th><th>Amount</th><th>USD value</th></tr>
            </thead>
            <tbody>
              <HoldingRow name="ETH" kind="native" amount={data.ethBalanceRead.data ? formatBig(data.ethBalanceRead.data.value, 18, 6) : data.deployed ? "—" : SOON} usd={ethUsd} />
              <HoldingRow name="MAG7 Box" kind="box token" amount={data.deployed ? formatBig(boxBalance) : SOON} usd={data.deployed ? formatUsd1e18(usdFromNav(boxBalance, data.navRead.data as bigint | undefined)) : SOON} />
              {stockRows.map((row) => <HoldingRow key={row.symbol} name={`${row.symbol} · ${row.name}`} kind={row.kind} amount={row.amount} usd={row.usd} />)}
            </tbody>
          </table>
        </div>
      </Panel>
      <ClaimsSection data={data} />
    </section>
  );
}

export function ClaimsPage() { return <PortfolioPage />; }

function HoldingRow({ name, kind, amount, usd }: { name: string; kind: string; amount: string; usd: string }) {
  return <tr className="border-t border-[#f5a623]/10"><td className="py-4 text-zinc-100">{name}</td><td className="text-zinc-500">{kind}</td><td className="font-mono text-zinc-300">{amount}</td><td className="font-mono text-zinc-300">{usd}</td></tr>;
}

function ClaimsSection({ data }: { data: ReturnType<typeof useBentoData> }) {
  return (
    <Panel muted={!data.deployed}>
      <SectionLabel>Claims</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold text-white">Pending failed-leg claims</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MAG7_COMPONENTS.map((component, i) => {
          const amount = data.claimsReads.data?.[i]?.result as bigint | undefined;
          return <div key={component.symbol} className="rounded-2xl border border-[#f5a623]/15 bg-black/30 p-4"><SectionLabel>{component.symbol}</SectionLabel><div className="mt-2 font-mono text-sm text-zinc-300">{data.deployed ? amount ? formatBig(amount) : "0" : SOON}</div><button onClick={() => data.claim(component.token)} disabled={!amount || !data.isConnected || data.writePending} className="mt-3 rounded-full border border-[#f5a623]/35 px-3 py-2 text-xs font-semibold text-[#f5a623] disabled:opacity-40">Execute</button></div>;
        })}
      </div>
      {data.txMessage ? <Toast text={data.txMessage} /> : null}
    </Panel>
  );
}

export function BentoPage() {
  const data = useBentoData();
  const feeCollectorBalance = useBalance({ address: contracts.feeCollector, chainId: robinhood.id, query: { enabled: !isZeroAddress(contracts.feeCollector), staleTime: 0 } });
  const bentoSupply = data.bentoSupplyRead.data as bigint | undefined;
  const burned = (() => { if (!data.bentoConfigured || bentoSupply === undefined) return data.bentoConfigured ? "—" : SOON; const initial = 1_000_000_000n * 10n ** 18n; return `${formatBig(bentoSupply < initial ? initial - bentoSupply : 0n, 18, 2)} BENTO`; })();
  const feesCollected = data.bentoConfigured && feeCollectorBalance.data ? `${formatBig(feeCollectorBalance.data.value, 18, 5)} ETH` : data.bentoConfigured ? "—" : SOON;

  return (
    <section className="space-y-6">
      <Panel muted={!data.bentoConfigured}>
        <SectionLabel>BENTO token</SectionLabel>
        <h1 className="mt-2 text-4xl font-black text-white">Buyback-and-burn token</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">BENTO is the protocol token, launched on pons.family with a fixed 1B supply and a locked trading pool. Box fees fund a buyback-and-burn loop. No pool price section is shown until live data exists.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Total supply" value={data.bentoConfigured ? `${formatBig(data.bentoSupplyRead.data as bigint | undefined, 18, 2)} BENTO` : SOON} emptyChart={false} dim={!data.bentoConfigured} />
          <StatCard label="Cumulative burned" value={burned} caption={data.bentoConfigured ? "1B initial supply minus current supply" : "launching soon"} emptyChart={false} dim={!data.bentoConfigured} />
          <StatCard label="Fees awaiting buyback" value={feesCollected} caption={data.bentoConfigured ? "ETH held by FeeCollector" : "launching soon"} emptyChart={false} dim={!data.bentoConfigured} />
        </div>
        <div className="mt-6 rounded-2xl border border-[#f5a623]/10 bg-black/25 p-4">
          <SectionLabel>Contract</SectionLabel>
          {data.bentoConfigured ? <a href={explorerAddress(contracts.bentoToken)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-mono text-sm text-[#f5a623]">{short(contracts.bentoToken)} <ExternalLink className="h-3 w-3" /></a> : <p className="mt-2 font-mono text-sm text-zinc-500">{SOON}</p>}
        </div>
      </Panel>
      <Panel>
        <SectionLabel>Mechanic</SectionLabel>
        <h2 className="mt-2 text-2xl font-semibold text-white">How buyback-and-burn works</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">Protocol fees from box mint/redeem accumulate in the FeeCollector. A keeper can execute the buyback once a Sushi V2 BENTO/WETH pool exists, and purchased BENTO is sent to the burn destination. Until that pool is seeded, fees accumulate in the collector. This page only reports live on-chain figures after contracts are configured.</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">Fee revenue is intended to fund an independent audit before any cap increases, ahead of BENTO buyback-and-burn.</p>
      </Panel>
    </section>
  );
}

export function DocsPage() { return <InfoPage title="Docs" label="Protocol mechanics" rows={[["How mint works", "User deposits ETH, protocol fee is separated, net ETH is split by MAG7 weights, adapter routes acquire the underlying stocks, and the box token is minted to the recipient if slippage checks pass."], ["How redeem works", "User approves MAG7 and burns box tokens to receive either the underlying stocks or ETH through reverse routes. FeedStale displays as market closed."], ["Fee schedule", "Launch settings come from contract reads after deployment. Before deployment the interface shows launching soon, not placeholder financial claims."], ["Stock splits", "Robinhood tokenized stocks may rebase via a multiplier. Bento reads live balances and UI balances instead of caching split-sensitive values."], ["Issuer pauses", "If a stock transfer is paused, Bento records a raw-unit pending claim for that component and lets users claim after the issuer unpauses."], ["BENTO buyback-burn", "Box fees route to FeeCollector mechanics designed to buy BENTO and burn it once a Sushi V2 BENTO/WETH pool exists. BENTO itself is launched on pons.family with a fixed supply and locked pool."], ["Open stats API", "GET /api/stats returns live NAV, TVL, per-component reserves, box supply and BENTO burn totals as public JSON with open CORS. Free to use for bots, dashboards and integrations; data refreshes about every 30 seconds."], ["Integrity", "No mocked TVL, no invented boxes, no audit badge. Proof of reserves is on-chain and price feeds are by Chainlink."]]} />; }
export function FAQPage() { return <InfoPage title="FAQ" label="Risk and custody" rows={[["Is this audited?", "No. Bento is unaudited and external review is pending. No auditor badge or logo is shown."], ["What if Robinhood pauses a token?", "Redeem handles available components and records paused components as claims for later pull after transfers resume."], ["How is this different from unbacked index memecoins?", "The product centers proof of reserves: box supply is designed to be backed by tokenized stocks held in a vault and visible on-chain."], ["What are the fees?", "Fee values are live after contracts are deployed. In pre-launch mode this UI does not render fake fee revenue or TVL."], ["Who holds custody?", "A dedicated MAG7 vault holds components and is controlled by BoxEngine. Vault links are hidden until the vault address is configured."]]} />; }
export function GuidePage() {
  const [netMsg, setNetMsg] = useState("");
  const [copied, setCopied] = useState("");
  async function addNetwork() {
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) throw new Error("No wallet detected. Install MetaMask first.");
      await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x1237", chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"], blockExplorerUrls: ["https://robinhoodchain.blockscout.com"] }] });
      setNetMsg("Robinhood Chain added. You can switch to it in your wallet.");
    } catch (error) { setNetMsg(friendlyError(error) ?? "Failed to add network."); }
  }
  async function copy(text: string, key: string) { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1500); } catch {} }
  const steps: [string, React.ReactNode][] = [
    ["1 · Get a wallet", <span key="s1">Install <a href="https://metamask.io" className="text-[#f5a623] hover:underline">MetaMask</a> (or any EVM wallet) as a browser extension or mobile app and back up your seed phrase.</span>],
    ["2 · Add Robinhood Chain", <span key="s2">One click below, or add manually: RPC <span className="font-mono text-zinc-200">rpc.mainnet.chain.robinhood.com</span>, chain ID <span className="font-mono text-zinc-200">4663</span>, currency ETH, explorer <span className="font-mono text-zinc-200">robinhoodchain.blockscout.com</span>.</span>],
    ["3 · Bridge ETH in", <span key="s3">Move ETH to Robinhood Chain using the official bridge or an exchange that supports withdrawals to it. Even a small amount works, mints start tiny.</span>],
    ["4 · Mint MAG7", <span key="s4">Open <Link href="/mint" className="text-[#f5a623] hover:underline">Mint</Link>, connect your wallet, enter an ETH or USDG amount, press Quote mint, then Mint. Your ETH is split across the seven underlying tokenized stocks and you receive MAG7 box tokens.</span>],
    ["5 · See it in your wallet", <span key="s5">Import the MAG7 token contract below into your wallet to see the balance. Your holdings also show on the <Link href="/portfolio" className="text-[#f5a623] hover:underline">Portfolio</Link> page, including your share of the underlying stocks.</span>],
    ["6 · Exit anytime", <span key="s6">Use <Link href="/redeem" className="text-[#f5a623] hover:underline">Redeem</Link> to burn MAG7 back into ETH, or take delivery of the underlying tokenized stocks directly.</span>],
  ];
  const cas: [string, Address][] = [["MAG7 box token", contracts.mag7BoxToken], ["BENTO", contracts.bentoToken]];
  return <section className="mx-auto w-full max-w-3xl"><Panel className="p-7 sm:p-10"><SectionLabel>Getting started</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Onboarding guide</h1><p className="mt-3 text-sm leading-6 text-zinc-400">From zero to holding a MAG7 box in six steps. No prior on-chain experience needed.</p><div className="mt-6"><Action onClick={addNetwork} large>Add Robinhood Chain to wallet</Action>{netMsg ? <p className="mt-3 font-mono text-xs text-zinc-400">{netMsg}</p> : null}</div><div className="mt-8 space-y-4">{steps.map(([t, body]) => <div key={t} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5"><SectionLabel>{t}</SectionLabel><p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p></div>)}</div><div className="mt-8"><SectionLabel>Token contracts</SectionLabel><div className="mt-3 space-y-2">{cas.map(([label, addr]) => isZeroAddress(addr) ? null : <button key={label} onClick={() => copy(addr, label)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#f5a623]/15 bg-black/25 px-4 py-3 text-left hover:border-[#f5a623]/40"><span className="text-sm text-zinc-300">{label}</span><span className="flex items-center gap-2 font-mono text-xs text-zinc-500">{short(addr)}{copied === label ? <Check className="h-3 w-3 text-[#22c55e]" /> : <Copy className="h-3 w-3" />}</span></button>)}</div></div><p className="mt-8 text-xs leading-5 text-zinc-600">Bento is unaudited. Only deposit what you can afford to lose. Proof of reserves is on-chain, see <Link href="/reserves" className="text-zinc-500 hover:text-[#f5a623]">Reserves</Link>.</p></Panel></section>;
}

function InfoPage({ title, label, rows }: { title: string; label: string; rows: [string, string][] }) { return <Panel><SectionLabel>{label}</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">{title}</h1><div className="mt-6 grid gap-4 md:grid-cols-2">{rows.map(([q, a]) => <div key={q} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5"><SectionLabel>{q}</SectionLabel><p className="mt-3 text-sm leading-6 text-zinc-300">{a}</p></div>)}</div></Panel>; }
function Footer() { return <footer className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"><div className="flex flex-col gap-3 rounded-3xl border border-[#f5a623]/15 bg-[#10100e] px-5 py-4 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><Info className="h-4 w-4 text-[#f5a623]" /><span>1 box = a claim on its underlying tokenized equities</span></div><div className="flex flex-wrap gap-3"><a href="https://github.com/bentoetf/bento-contracts" className="text-zinc-500 hover:text-[#f5a623]">Unaudited · v1.0.0-rc3</a><Link href="/reserves" className="text-zinc-500 hover:text-[#f5a623]">Proof of reserves: on-chain</Link></div></div></footer>; }

