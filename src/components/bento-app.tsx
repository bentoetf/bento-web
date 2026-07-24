"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, Copy, ExternalLink, Info } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, formatUnits, parseEther, parseUnits, type Address } from "viem";
import { useAccount, useBalance, useConnect, useDisconnect, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { adapterAbi, boxEngineAbi, BOXES, boxBySymbol, contracts, erc20Abi, ETH_USD_FEED, feedAbi, hasBentoAddresses, hasDeployAddresses, hasZapperAddress, isSynthetic, PLACEHOLDER_ADDRESS, robinhood, syntheticBoxAbi, USDG_ADDRESS, USDG_DECIMALS, zapperAbi, type BoxInfo } from "@/config/contracts";
import { formatChangePercent, useBox24hChange, useBoxNavSeries, useDisplayNav } from "@/hooks/use-box-stats";
import { formatNav8, useSyntheticData } from "@/hooks/use-synthetic-box";

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
  { href: "/how-it-works", label: "How boxes work" },
  { href: "/roadmap", label: "Roadmap" },
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
function friendlyError(error?: unknown) { const text = error instanceof Error ? error.message : String(error || ""); if (!text) return undefined; if (text.includes("FeedStale")) return "market closed"; if (text.includes("PerTxMintCapExceeded")) return "Mint exceeds the per-transaction ETH cap."; if (text.includes("TvlCapExceeded")) return "Mint would exceed the box TVL cap."; if (text.includes("Slippage")) return "Slippage check failed. Try a smaller size or wider tolerance."; if (text.includes("User rejected")) return "Transaction rejected in wallet."; return text.slice(0, 220); }

function useBentoData(box: BoxInfo = BOXES[0]) {
  // A box only counts as deployed when the engine addresses exist AND the box's own
  // token contract exists (placeholder token = timelock execution still pending).
  const deployed = hasDeployAddresses() && !isZeroAddress(box.token);
  const comps = box.components;
  const boxZapperConfigured = box.zapper !== PLACEHOLDER_ADDRESS;
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
  const boxId = box.id;

  const navRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "navUsdPerBox", args: [boxId], query: { enabled: deployed } });
  const boxRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "boxes", args: [boxId], query: { enabled: deployed } });
  const capRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "perTxMintCapWei", args: [boxId], query: { enabled: deployed } });
  const backingRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "backingDetailed", args: [boxId], query: { enabled: deployed } });
  const boxBalanceRead = useReadContract({ address: box.token, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: deployed && !!address } });
  const totalSupplyRead = useReadContract({ address: box.token, abi: erc20Abi, functionName: "totalSupply", query: { enabled: deployed } });
  const feedReads = useReadContracts({ contracts: comps.flatMap((c) => [{ address: c.feed, abi: feedAbi, functionName: "latestRoundData" }, { address: c.feed, abi: feedAbi, functionName: "decimals" }]), query: { enabled: deployed } });
  const claimsReads = useReadContracts({ contracts: comps.map((c) => ({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "pendingClaims", args: [boxId, address || PLACEHOLDER_ADDRESS, c.token] })), query: { enabled: deployed && !!address, staleTime: 0 } });
  const stockBalanceReads = useReadContracts({ contracts: comps.map((c) => ({ address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [address || PLACEHOLDER_ADDRESS] })), query: { enabled: deployed && !!address, staleTime: 0 } });
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
  const capOnChain = capRead.data as bigint | undefined;
  // Engine returns 0 when no per-tx cap is set for a box; treat 0 as uncapped instead of a zero cap.
  const perTxCap: bigint | undefined = capOnChain === undefined ? (deployed ? undefined : contracts.perTxMintCapWei) : capOnChain > 0n ? capOnChain : undefined;
  const feedInfo = useMemo(() => comps.map((component, i) => { const round = feedReads.data?.[i * 2]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined; const decimals = feedReads.data?.[i * 2 + 1]?.result as number | undefined; return { component, answer: round?.[1], updatedAt: round?.[3], decimals }; }), [comps, feedReads.data]);

  async function quoteMint() {
    try {
      if (!publicClient || !deployed) throw new Error("Deploy addresses unavailable.");
      const value = parseEther(ethIn || "0");
      if (perTxCap !== undefined && value > perTxCap) throw new Error("PerTxMintCapExceeded");
      if (value <= 0n) throw new Error("Enter an ETH amount.");
      const simData = encodeFunctionData({ abi: boxEngineAbi, functionName: "simulateMint", args: [boxId, value] });
      const simResult = await publicClient.call({ to: contracts.boxEngine, data: simData, account: address });
      const boxOut = decodeFunctionResult({ abi: boxEngineAbi, functionName: "simulateMint", data: simResult.data ?? "0x" }) as unknown as bigint;
      const net = value - (value * mintFeeBps) / BPS;
      let remaining = net;
      const componentQuotes: bigint[] = [];
      for (let i = 0; i < comps.length; i++) {
        const part = i === comps.length - 1 ? remaining : (net * comps[i].weightBps) / BPS;
        remaining -= part;
        const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteETHToToken", args: [comps[i].token, part] });
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
      if (boxIn <= 0n) throw new Error(`Enter a ${box.symbol} amount.`);
      if (!backingData) throw new Error("Backing unavailable.");
      const supply = await publicClient.readContract({ address: box.token, abi: erc20Abi, functionName: "totalSupply" }) as bigint;
      const componentEthQuotes: bigint[] = [];
      for (let i = 0; i < comps.length; i++) {
        const componentAmount = (backingData[1][i] * boxIn) / supply;
        const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteTokenToETH", args: [comps[i].token, componentAmount] });
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
      if (!hasZapperAddress() || !boxZapperConfigured) throw new Error("USDG zapper not deployed yet.");
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
        for (let i = 0; i < comps.length; i++) {
          const part = i === comps.length - 1 ? remaining : (net * comps[i].weightBps) / BPS;
          remaining -= part;
          const data = encodeFunctionData({ abi: adapterAbi, functionName: "quoteETHToToken", args: [comps[i].token, part] });
          const result = await publicClient.call({ to: contracts.v4Adapter, data, account: address });
          componentMins.push(applySlippage(decodeFunctionResult({ abi: adapterAbi, functionName: "quoteETHToToken", data: result.data ?? "0x" }) as unknown as bigint, slippage));
        }
      }
      const approveHash = await writeContractAsync({ address: USDG_ADDRESS, abi: erc20Abi, functionName: "approve", args: [box.zapper, usdgAmount], chainId: robinhood.id });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      const recipient = resolveRecipient(giftRecipient, address);
      const hash = await writeContractAsync({ address: box.zapper, abi: zapperAbi, functionName: "mintWithUSDG", args: [boxId, usdgAmount, minEthOut, minBoxOut, componentMins, recipient], chainId: robinhood.id });
      setTxMessage(`USDG mint sent: ${hash}`);
    } catch (error) { setTxMessage(friendlyError(error)); }
  }
  async function redeemForEth() { try { if (!address) throw new Error("Connect wallet first."); if (!publicClient) throw new Error("Wallet client unavailable."); const boxIn = parseEther(redeemAmount || "0"); const approveHash = await writeContractAsync({ address: box.token, abi: erc20Abi, functionName: "approve", args: [contracts.boxEngine, boxIn], chainId: robinhood.id }); await publicClient.waitForTransactionReceipt({ hash: approveHash }); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "redeemForETH", args: [boxId, boxIn, redeemQuote.minEthOut || 0n, redeemQuote.componentMins || [], address], chainId: robinhood.id }); setTxMessage(`Redeem for ETH sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }
  async function redeemForStocks() { try { if (!address) throw new Error("Connect wallet first."); if (!publicClient) throw new Error("Wallet client unavailable."); const boxIn = parseEther(redeemAmount || "0"); const approveHash = await writeContractAsync({ address: box.token, abi: erc20Abi, functionName: "approve", args: [contracts.boxEngine, boxIn], chainId: robinhood.id }); await publicClient.waitForTransactionReceipt({ hash: approveHash }); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "redeemForStocks", args: [boxId, boxIn, address], chainId: robinhood.id }); setTxMessage(`Redeem for stocks sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }
  // Auto-quote so execution guardrails show live per-component data without a manual click.
  const quoteMintRef = useRef<() => Promise<void>>(async () => {});
  quoteMintRef.current = quoteMint;
  const quoteRedeemRef = useRef<() => Promise<void>>(async () => {});
  quoteRedeemRef.current = quoteRedeem;
  // Clear stale quotes when the selected box changes.
  useEffect(() => { setMintQuote({}); setRedeemQuote({}); }, [boxId]);
  useEffect(() => {
    if (!deployed || !publicClient) return;
    let ethValue = 0n;
    try { ethValue = parseEther(ethIn || "0"); } catch { ethValue = 0n; }
    if (ethValue <= 0n) return;
    const timer = setTimeout(() => { quoteMintRef.current(); }, 500);
    return () => clearTimeout(timer);
  }, [deployed, publicClient, boxId, ethIn, slippage]);
  useEffect(() => {
    if (!deployed || !publicClient || !backingData) return;
    let boxValue = 0n;
    try { boxValue = parseEther(redeemAmount || "0"); } catch { boxValue = 0n; }
    if (boxValue <= 0n) return;
    const timer = setTimeout(() => { quoteRedeemRef.current(); }, 500);
    return () => clearTimeout(timer);
  }, [deployed, publicClient, boxId, redeemAmount, slippage, backingData]);

  async function claim(token: Address) { try { if (!address) throw new Error("Connect wallet first."); const hash = await writeContractAsync({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "claimPending", args: [boxId, token, address], chainId: robinhood.id }); setTxMessage(`Claim sent: ${hash}`); } catch (error) { setTxMessage(friendlyError(error)); } }

  return { box, comps, address, isConnected, deployed, bentoConfigured: hasBentoAddresses(), zapperConfigured: hasZapperAddress() && boxZapperConfigured, boxId, navRead, boxRead, capRead, backingRead, boxBalanceRead, stockBalanceReads, ethBalanceRead, ethFeedReads, bentoSupplyRead, bentoBalanceRead, totalSupplyRead, feedReads, claimsReads, boxData, backingData, tvlUsd, mintFeeBps, redeemFeeBps, tvlCap, perTxCap, feedInfo, ethIn, setEthIn, usdgIn, setUsdgIn, payAsset, setPayAsset, giftRecipient, setGiftRecipient, slippage, setSlippage, redeemAmount, setRedeemAmount, mintQuote, redeemQuote, txMessage, writePending, quoteMint, quoteRedeem, submitMint, submitMintUSDG, redeemForEth, redeemForStocks, claim };
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

// Inline SVG area sparkline for the 24h NAV index. No chart library; series is a relative index.
function NavSparkline({ series, change }: { series: number[] | null | undefined; change: number | null | undefined }) {
  if (series === undefined) return <div className="h-36 animate-pulse rounded-2xl bg-white/[0.03]" />;
  if (series === null || series.length < 2) return null;
  const w = 320;
  const h = 120;
  const pad = 6;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1e-9;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const color = change !== null && change !== undefined ? (change >= 0 ? "#22c55e" : "#ef4444") : "#f5a623";
  const gid = `nav-spark-${color.slice(1)}`;
  return (
    <div className="h-36 rounded-2xl border border-[#f5a623]/10 bg-black/25 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="24h NAV chart">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
      </svg>
    </div>
  );
}
function BoxArt({ box }: { box: BoxInfo }) { return <div className="relative aspect-square w-full max-w-[18rem] overflow-hidden rounded-3xl bg-black"><Image src={box.art} alt={`${box.name} artwork`} fill sizes="(min-width: 1280px) 17rem, 18rem" className="object-cover" priority /></div>; }
const BOX_TYPE_STYLES = {
  backed: { label: "1:1 BACKED", className: "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]" },
  synthetic: { label: "SYNTHETIC", className: "border-[#818cf8]/30 bg-[#818cf8]/10 text-[#818cf8]" },
  mixed: { label: "MIXED", className: "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]" },
} as const;
function BoxTypeBadge({ type }: { type: keyof typeof BOX_TYPE_STYLES }) {
  const s = BOX_TYPE_STYLES[type];
  return <Link href="/how-it-works" onClick={(e) => e.stopPropagation()} title="How boxes work" className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:brightness-125 ${s.className}`}>{s.label}</Link>;
}
function ProofBadge() { return <Link href="/reserves" className="inline-flex items-center gap-2 rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 px-3 py-2 text-xs font-semibold text-[#22c55e]"><Check className="h-3.5 w-3.5" /> <span className="font-mono uppercase tracking-[0.16em]">Proof of reserves</span><span className="text-zinc-300">100% backed by on-chain reserves</span></Link>; }
function SyntheticProofBadge() { return <Link href="/reserves" className="inline-flex items-center gap-2 rounded-full border border-[#818cf8]/25 bg-[#818cf8]/10 px-3 py-2 text-xs font-semibold text-[#818cf8]"><Info className="h-3.5 w-3.5" /> <span className="font-mono uppercase tracking-[0.16em]">Synthetic</span><span className="text-zinc-300">ETH-collateralized, oracle-priced NAV</span></Link>; }
function FormInput({ label, value, onChange, suffix, large = false }: { label: string; value: string; onChange: (v: string) => void; suffix: string; large?: boolean }) { return <label className="block"><SectionLabel>{label}</SectionLabel><div className="mt-2 flex rounded-2xl border border-[#f5a623]/20 bg-black/45"><input className={`min-w-0 flex-1 bg-transparent px-4 py-4 font-mono font-black text-zinc-100 outline-none tabular-nums ${large ? "text-5xl sm:text-7xl" : "text-lg"}`} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" /><span className="px-4 py-4 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{suffix}</span></div></label>; }
function Action({ children, onClick, disabled, variant = "filled", large = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "filled" | "outline"; large?: boolean }) { return <button onClick={onClick} disabled={disabled} className={`rounded-2xl px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40 ${large ? "w-full py-5" : ""} ${variant === "filled" ? "bg-[#f5a623] text-black hover:brightness-110" : "border border-[#f5a623]/45 text-[#f5a623] hover:bg-[#f5a623]/10"}`}>{children}</button>; }
function Warning({ text }: { text: string }) { return <div className="mt-4 rounded-2xl border border-[#f5a623]/25 bg-[#f5a623]/10 p-3 text-sm text-[#f7c66b]"><AlertTriangle className="mr-2 inline h-4 w-4" />{text}</div>; }
function DisabledHint() { if (hasDeployAddresses()) return null; return <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-600">Launching soon: visible for review, disabled until contract addresses are configured.</p>; }
function Toast({ text }: { text: string }) { return <div className="fixed bottom-4 left-4 right-4 z-20 rounded-2xl border border-[#f5a623]/20 bg-[#10100e] p-4 font-mono text-xs text-zinc-100 sm:left-auto sm:w-[28rem]">{text}</div>; }

// ---------------- Synthetic box panels (SyntheticBox ERC20 vaults) ----------------
// These read live from the vault: navPerShare (8 dec), previewMint/previewRedeem, totalCollateral,
// ethUsdPrice. Mint is payable mint() with ETH; redeem burns shares for ETH.

function SyntheticNote() { return <div className="mt-4 rounded-2xl border border-[#818cf8]/25 bg-[#818cf8]/10 p-3 text-sm text-[#c7d2fe]"><Info className="mr-2 inline h-4 w-4" />Synthetic box: the vault holds ETH collateral only, not the underlying stocks. NAV is priced by Chainlink feeds. Mint with ETH, redeem for ETH.</div>; }

function SyntheticMintPanel({ box, onSelect }: { box: BoxInfo; onSelect: (b: BoxInfo) => void }) {
  const s = useSyntheticData(box);
  const sharesOut = s.mintPreview?.[0];
  const fee = s.mintPreview?.[1];
  return <section className="mx-auto w-full max-w-3xl"><Panel className="p-7 sm:p-10"><div className="flex items-center gap-3"><SectionLabel>Mint {box.symbol}</SectionLabel><BoxTypeBadge type="synthetic" /></div><h1 className="mt-2 text-4xl font-black text-white">Enter ETH</h1><div className="mt-5"><BoxSelector selected={box} onSelect={onSelect} /></div><div className="mt-6"><FormInput label="ETH amount" value={s.ethIn} onChange={s.setEthIn} suffix="ETH" large /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard label="NAV per share" value={formatNav8(s.nav)} caption="oracle-priced, genesis $100" emptyChart={false} /><StatCard label={`Protocol fee (${s.mintFeeBps.toString()} bps)`} value={fee !== undefined ? `${formatBig(fee, 18, 6)} ETH` : "—"} emptyChart={false} /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard label="Quote shares out" value={sharesOut !== undefined ? `${formatBig(sharesOut)} ${box.symbol}` : "—"} emptyChart={false} /><StatCard label="Your balance" value={s.balance !== undefined ? `${formatBig(s.balance)} ${box.symbol}` : "—"} emptyChart={false} /></div>{s.paused ? <Warning text="Mint is paused for this box." /> : null}<SyntheticNote /><div className="mt-6"><Action onClick={s.submitMint} disabled={!s.isConnected || s.writePending || !!s.paused} large>{s.isConnected ? "Mint with ETH" : "Connect wallet to mint"}</Action></div><SyntheticComponentBreakdown box={box} feedInfo={s.feedInfo} /></Panel>{s.txMessage ? <Toast text={s.txMessage} /> : null}</section>;
}

function SyntheticRedeemPanel({ box, onSelect }: { box: BoxInfo; onSelect: (b: BoxInfo) => void }) {
  const s = useSyntheticData(box);
  const ethOut = s.redeemPreview?.[0];
  const fee = s.redeemPreview?.[1];
  return <section className="mx-auto w-full max-w-3xl"><Panel className="p-7 sm:p-10"><div className="flex items-center gap-3"><SectionLabel>Redeem {box.symbol}</SectionLabel><BoxTypeBadge type="synthetic" /></div><h1 className="mt-2 text-4xl font-black text-white">Exit to ETH</h1><div className="mt-5"><BoxSelector selected={box} onSelect={onSelect} /></div><div className="mt-5"><StatCard label="Connected balance" value={s.balance !== undefined ? `${formatBig(s.balance)} ${box.symbol}` : "—"} emptyChart={false} /></div><div className="mt-5"><FormInput label={`${box.symbol} amount`} value={s.redeemShares} onChange={s.setRedeemShares} suffix={box.symbol} large /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard label="NAV per share" value={formatNav8(s.nav)} emptyChart={false} /><StatCard label={`Redeem fee (${s.redeemFeeBps.toString()} bps)`} value={fee !== undefined ? `${formatBig(fee, 18, 6)} ETH` : "—"} emptyChart={false} /></div><div className="mt-5"><StatCard label="ETH out" value={ethOut !== undefined ? `${formatBig(ethOut, 18, 6)} ETH` : "—"} emptyChart={false} /></div>{s.redeemFloored ? <Warning text="Pro-rata solvency cap applies: NAV payout exceeds your pro-rata share of vault collateral, so ETH out is floored to the pro-rata amount. The vault never owes more ETH than it holds." /> : null}{s.paused ? <Warning text="Redeem is paused for this box." /> : null}<SyntheticNote /><div className="mt-6"><Action onClick={s.submitRedeem} disabled={!s.isConnected || s.writePending || !!s.paused} large>{s.isConnected ? "Redeem for ETH" : "Connect wallet to redeem"}</Action></div></Panel>{s.txMessage ? <Toast text={s.txMessage} /> : null}</section>;
}

function SyntheticComponentBreakdown({ box, feedInfo }: { box: BoxInfo; feedInfo: ReturnType<typeof useSyntheticData>["feedInfo"] }) {
  return <details open className="mt-5 rounded-2xl border border-[#818cf8]/15 bg-black/25 p-4"><summary className="flex cursor-pointer list-none items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#818cf8]"><span>Basket components (oracle-priced)</span><ChevronDown className="h-4 w-4" /></summary><div className="mt-4 space-y-2 text-sm">{box.components.map((c, i) => { const info = feedInfo[i]; const price = info?.answer !== undefined && info?.decimals !== undefined ? `$${formatBig(info.answer, info.decimals, 2)}` : "—"; return <div key={c.symbol} className="rounded-2xl bg-[#10100e] p-3"><div className="flex justify-between"><span className="font-mono font-semibold text-white">{c.symbol} · {c.name}</span><span className="font-mono text-zinc-500">{(Number(c.weightBps) / 100).toFixed(2)}%</span></div><div className="mt-2 font-mono text-xs text-zinc-400">Feed price: {price} · age {feedAge(info?.updatedAt)}</div></div>; })}</div></details>;
}

function SyntheticReservesPanel({ box, onSelect }: { box: BoxInfo; onSelect: (b: BoxInfo) => void }) {
  const s = useSyntheticData(box);
  const collateralUsd = s.collateral !== undefined && s.ethUsd !== undefined ? (s.collateral * s.ethUsd) / 10n ** 8n : undefined;
  // supply is 1e18 shares, nav is 1e8 USD/share -> scale to 1e18 USD for formatUsd1e18.
  const liabUsd1e18 = s.supply !== undefined && s.nav !== undefined ? ((s.supply * s.nav) / 10n ** 18n) * 10n ** 10n : undefined;
  const solvency = (() => { if (collateralUsd === undefined || liabUsd1e18 === undefined) return undefined; if (liabUsd1e18 === 0n) return "no supply yet"; return `${(Number((collateralUsd * 10000n) / liabUsd1e18) / 100).toFixed(2)}%`; })();
  return <Panel><div className="flex items-center gap-3"><SectionLabel>Reserves</SectionLabel><BoxTypeBadge type="synthetic" /></div><h1 className="mt-3 text-4xl font-black text-white">{box.symbol} collateral</h1><div className="mt-4"><BoxSelector selected={box} onSelect={onSelect} /></div><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">This is a synthetic box. It does not hold the underlying stocks. The vault holds plain ETH as collateral and prices the basket through Chainlink feeds. Shown below: actual ETH in the vault and the NAV-implied liabilities.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><StatCard label="Vault ETH collateral" value={s.vaultEth !== undefined ? `${formatBig(s.vaultEth, 18, 6)} ETH` : "—"} caption={collateralUsd !== undefined ? formatUsd1e18(collateralUsd) : undefined} emptyChart={false} /><StatCard label="NAV-implied liabilities" value={liabUsd1e18 !== undefined ? formatUsd1e18(liabUsd1e18) : "—"} caption="totalSupply × navPerShare" emptyChart={false} /><StatCard label="Collateral / liabilities" value={solvency ?? "—"} caption="pro-rata floor guarantees ≥ payout" emptyChart={false} /></div><div className="mt-6 grid gap-4 md:grid-cols-3"><StatCard label="NAV per share" value={formatNav8(s.nav)} emptyChart={false} /><StatCard label="Share supply" value={s.supply !== undefined ? `${formatBig(s.supply)} ${box.symbol}` : "—"} emptyChart={false} /><StatCard label="Accrued fee ETH" value={s.vaultEth !== undefined && s.collateral !== undefined ? `${formatBig(s.vaultEth - s.collateral > 0n ? s.vaultEth - s.collateral : 0n, 18, 6)} ETH` : "—"} emptyChart={false} /></div><SyntheticComponentBreakdown box={box} feedInfo={s.feedInfo} /><p className="mt-6 text-xs leading-6 text-zinc-500">Vault address <a href={explorerAddress(box.token)} target="_blank" rel="noreferrer" className="font-mono text-zinc-400 underline decoration-[#818cf8]/30 underline-offset-4">{short(box.token)}</a>. Collateral and NAV are live chain reads; no underlying stock reserves exist for synthetic boxes.</p></Panel>;
}

function SyntheticPortfolioPanel({ box, onSelect }: { box: BoxInfo; onSelect: (b: BoxInfo) => void }) {
  const s = useSyntheticData(box);
  const boxUsd1e18 = s.balance !== undefined && s.nav !== undefined ? ((s.balance * s.nav) / 10n ** 18n) * 10n ** 10n : undefined;
  const ethUsd1e18 = s.ethBalance !== undefined && s.ethUsd !== undefined ? (s.ethBalance * s.ethUsd) / 10n ** 8n : undefined;
  if (!s.isConnected) {
    return <Panel><div className="flex items-center gap-3"><SectionLabel>Portfolio</SectionLabel><BoxTypeBadge type="synthetic" /></div><h1 className="mt-2 text-4xl font-black text-white">Connect to view holdings</h1><p className="mt-3 text-sm text-zinc-400">Connect a wallet to read your ETH and {box.symbol} share balances.</p><div className="mt-5"><WalletPanel /></div></Panel>;
  }
  const supplyShare = (() => { if (!s.balance || !s.supply || s.supply === 0n) return undefined; const bps = Number((s.balance * 1000000n) / s.supply) / 10000; return bps >= 0.01 ? `${bps.toFixed(2)}% of all ${box.symbol}` : `<0.01% of all ${box.symbol}`; })();
  return <section className="space-y-6"><Panel><div className="flex items-center gap-3"><SectionLabel>Portfolio</SectionLabel><BoxTypeBadge type="synthetic" /></div><h1 className="mt-2 text-4xl font-black text-white">Wallet holdings</h1><div className="mt-4"><BoxSelector selected={box} onSelect={onSelect} /></div>{supplyShare ? <p className="mt-3 font-mono text-sm text-[#818cf8]">{supplyShare}</p> : null}<div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/60"><tr><th className="py-3">Asset</th><th>Type</th><th>Amount</th><th>USD value</th></tr></thead><tbody><HoldingRow name="ETH" kind="native" amount={s.ethBalance !== undefined ? formatBig(s.ethBalance, 18, 6) : "—"} usd={ethUsd1e18 !== undefined ? formatUsd1e18(ethUsd1e18) : "—"} /><HoldingRow name={box.name} kind="synthetic box token" amount={formatBig(s.balance)} usd={boxUsd1e18 !== undefined ? formatUsd1e18(boxUsd1e18) : "—"} /></tbody></table></div><p className="mt-4 text-xs leading-6 text-zinc-500">Synthetic boxes track price exposure only; there are no underlying stock balances to display.</p></Panel></section>;
}

function useSelectedBox(): [BoxInfo, (box: BoxInfo) => void] {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<BoxInfo>(() => boxBySymbol(searchParams.get("box")));
  function select(box: BoxInfo) {
    setSelected(box);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("box", box.symbol);
      window.history.replaceState(null, "", url.toString());
    }
  }
  return [selected, select];
}

function BoxSelector({ selected, onSelect }: { selected: BoxInfo; onSelect: (box: BoxInfo) => void }) {
  return <div className="flex flex-wrap gap-2">{BOXES.map((box) => <button key={box.symbol} type="button" onClick={() => onSelect(box)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition ${selected.symbol === box.symbol ? "border-[#f5a623] bg-[#f5a623]/15 text-[#f5a623]" : "border-[#f5a623]/20 text-zinc-500 hover:text-zinc-300"}`}><span className="relative h-4 w-4 overflow-hidden rounded-[4px] bg-black"><Image src={box.thumb} alt="" fill sizes="16px" className="object-cover" /></span>{box.symbol}</button>)}</div>;
}

export function OverviewPage() {
  return <Suspense><OverviewPageInner /></Suspense>;
}

function OverviewPageInner() {
  const [selectedBox, selectBox] = useSelectedBox();
  const data = useBentoData(selectedBox);
  const synthetic = isSynthetic(selectedBox);
  const liveNav = data.deployed || synthetic;
  const overviewFeeBalance = useBalance({ address: contracts.feeCollector, chainId: robinhood.id, query: { enabled: !isZeroAddress(contracts.feeCollector), staleTime: 0 } });
  const overviewFees = !isZeroAddress(contracts.feeCollector) && overviewFeeBalance.data !== undefined ? `${formatBig(overviewFeeBalance.data.value, 18, 5)} ETH` : undefined;
  const heroNav = useDisplayNav(selectedBox, liveNav);
  const heroChange = useBox24hChange(selectedBox, liveNav);
  const heroSeries = useBoxNavSeries(selectedBox, liveNav);
  // Synthetic TVL comes from the vault collateral, not the engine backing table.
  const synthCollateralRead = useReadContract({ address: selectedBox.token, abi: syntheticBoxAbi, functionName: "totalCollateral", query: { enabled: synthetic } });
  const synthEthUsdRead = useReadContract({ address: selectedBox.token, abi: syntheticBoxAbi, functionName: "ethUsdPrice", query: { enabled: synthetic } });
  const synthTvl = (() => { if (!synthetic) return undefined; const c = synthCollateralRead.data as bigint | undefined; const e = synthEthUsdRead.data as bigint | undefined; return c !== undefined && e !== undefined ? (c * e) / 10n ** 8n : undefined; })();
  const navValue = liveNav ? formatUsd1e18(heroNav) : "$—.————";
  const moveValue = liveNav ? formatChangePercent(heroChange) : "$—.————";
  const tvlValue = liveNav ? formatUsd1e18(synthetic ? synthTvl : data.tvlUsd) : "—";
  const bentoBurned = (() => { const supply = data.bentoSupplyRead.data as bigint | undefined; if (!data.bentoConfigured || supply === undefined) return undefined; const initial = 1_000_000_000n * 10n ** 18n; return supply < initial ? initial - supply : 0n; })();
  return <><section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><Panel className="min-h-[33rem] p-7 sm:p-8"><div className="grid h-full gap-8 xl:grid-cols-[17rem_minmax(0,1fr)_minmax(19rem,0.95fr)]"><div className="flex items-start justify-center xl:justify-start"><BoxArt box={selectedBox} /></div><div className="flex flex-col justify-center"><SectionLabel>Featured box</SectionLabel><h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">{selectedBox.name}</h1><p className="mt-4 max-w-md text-base leading-7 text-zinc-400">{selectedBox.description}</p><div className="mt-5"><BoxSelector selected={selectedBox} onSelect={selectBox} /></div><div className="mt-6">{synthetic ? <SyntheticProofBadge /> : <ProofBadge />}</div></div><div className="flex flex-col justify-center"><SectionLabel>NAV (on-chain)</SectionLabel><div className="mt-3"><Value large dim={!liveNav}>{navValue}</Value></div>{!liveNav ? <p className="mt-2 text-sm text-zinc-500">launching soon</p> : null}<p className="mt-2 font-mono text-sm text-zinc-500">24h change: {moveValue}</p><div className="mt-5"><NavSparkline series={heroSeries} change={heroChange} /></div><div className="mt-5 flex gap-3"><Link href={`/mint?box=${selectedBox.symbol}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f5a623] px-6 py-3 text-sm font-semibold text-black hover:brightness-110"><ArrowUpRight className="h-4 w-4" />Mint</Link><Link href={`/redeem?box=${selectedBox.symbol}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f5a623]/45 px-6 py-3 text-sm font-semibold text-[#f5a623] hover:bg-[#f5a623]/10"><ArrowDownRight className="h-4 w-4" />Redeem</Link></div></div></div></Panel><aside className="grid gap-4"><StatCard label={`${selectedBox.symbol} TVL`} value={tvlValue} caption={liveNav ? (synthetic ? "ETH collateral in vault" : "on-chain backing") : "launching soon"} dim={!liveNav} /><StatCard label="BENTO burned" value={bentoBurned !== undefined ? `${formatBig(bentoBurned, 18, 2)} BENTO` : "—"} caption={bentoBurned !== undefined ? "every mint burns BENTO" : "launching soon"} dim={bentoBurned === undefined} /><StatCard label="Fees collected" value={overviewFees ?? "—"} caption={overviewFees !== undefined ? "ETH awaiting buyback" : "launching soon"} dim={overviewFees === undefined} /></aside></section><section><SectionLabel>Index boxes</SectionLabel><div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{BOXES.map((box) => <BoxCard key={box.symbol} box={box} deployed={data.deployed} selected={selectedBox.symbol === box.symbol} onSelect={() => selectBox(box)} />)}<Panel className="flex min-h-[18rem] items-center justify-center border-dashed"><div className="text-center"><SectionLabel>More boxes soon</SectionLabel><p className="mt-3 text-sm text-zinc-500">New boxes appear here only after real contracts, feeds, and reserves exist.</p></div></Panel></div></section><RoadmapSection /></>;
}

type RoadmapItem = { title: string; body: string; done?: boolean };
type RoadmapPhase = { phase: string; title: string; status: "live" | "in progress" | "in testing" | "planned"; blurb: string; items: RoadmapItem[] };

const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    phase: "Phase 1", title: "Foundation", status: "live",
    blurb: "The core protocol: reserve-backed index boxes with on-chain proof, live on Robinhood Chain.",
    items: [
      { title: "MAG7 Box", body: "Seven tokenized megacaps in one box, fully backed by vault reserves.", done: true },
      { title: "AI3 Box", body: "NVDA, AMD and MU with live Chainlink feeds and real on-chain liquidity.", done: true },
      { title: "Pay with USDG", body: "Mint boxes directly with USDG. One transaction swaps to ETH and mints through the same reserve-backed path.", done: true },
      { title: "Proof of reserves", body: "Vault balances are public and must cover box supply. No mocked numbers.", done: true },
      { title: "BENTO buyback and burn", body: "Box fees route to buying BENTO and burning it.", done: true },
      { title: "Open stats API", body: "Public JSON endpoint with live NAV, TVL, reserves and burn totals for bots and dashboards.", done: true },
    ],
  },
  {
    phase: "Phase 2", title: "Expansion", status: "live",
    blurb: "A much wider menu. Synthetic boxes track prices through Chainlink feeds with ETH collateral, so components no longer need DEX liquidity on Robinhood Chain.",
    items: [
      { title: "Synthetic boxes", body: "SEMI6, CRYPTOEQ and SPYQQQ are live. 35+ equity feeds deployed on-chain: SPY, QQQ, COIN, MSTR, semis, space and more.", done: true },
      { title: "Box type labels", body: "Every box is clearly labeled 1:1 BACKED or SYNTHETIC, with a full explainer page.", done: true },
      { title: "24/7 minting", body: "Mint and redeem around the clock: ETH or USDG while markets are open, USDG at the official close price when they are closed. Built and tested; ships with the next box deploys." },
      { title: "Elon Box", body: "SpaceX and Tesla in one box, 50/50. Fork-tested; ships through the 24h timelock." },
      { title: "More 1:1 boxes", body: "New backed boxes as feeds and liquidity come online, deployed through the timelock." },
    ],
  },
  {
    phase: "Phase 3", title: "BentoPad", status: "in testing",
    blurb: "Permissionless box creation. Anyone builds a basket, launches it with its own coin, and earns from it.",
    items: [
      { title: "Create your own box", body: "Pick components and weights from every supported feed, deploy a synthetic box in one transaction." },
      { title: "Creator coins", body: "Each box launches with its own tradable coin through the Pons launcher, LP locked permanently." },
      { title: "Creator fee share", body: "Trading fees split between the protocol and box creators. Token-side fees burn automatically." },
      { title: "Box registry", body: "Every BentoPad box is on-chain, discoverable, and labeled by type." },
    ],
  },
  {
    phase: "Phase 4", title: "Utility", status: "planned",
    blurb: "Box tokens become productive assets, not just exposure.",
    items: [
      { title: "LP with box tokens", body: "Box/USDG pools for one-click buys and live charts. Mint/redeem arbitrage keeps price pinned to NAV." },
      { title: "Boxes as collateral", body: "A Chainlink-compatible NAV oracle enables isolated lending markets where box tokens back USDG borrowing." },
      { title: "Earn on your box", body: "Lending yield on box tokens surfaces in an earn view. Tokenized stocks that earn." },
      { title: "Recurring buys", body: "Set-and-forget DCA into any box, for example 50 USDG of MAG7 every week." },
    ],
  },
  {
    phase: "Phase 5", title: "BENTO Utility", status: "planned",
    blurb: "With box creation permissionless, BENTO becomes the key to standing out and paying less.",
    items: [
      { title: "Featured box curation", body: "BENTO-weighted signal decides which community boxes get featured placement on the site." },
      { title: "Creator boosts", body: "Hold BENTO for a larger creator fee share and discounted box creation." },
      { title: "Fee alignment", body: "Protocol fee knobs stay aligned with BENTO holders as the box menu grows." },
    ],
  },
];

const PHASE_STATUS_STYLES: Record<RoadmapPhase["status"], string> = {
  live: "border-[#22c55e]/40 text-[#22c55e]",
  "in progress": "border-[#f5a623]/40 text-[#f5a623]",
  "in testing": "border-[#f5a623]/40 text-[#f5a623]",
  planned: "border-zinc-600/60 text-zinc-400",
};

function RoadmapSection() {
  return <section><Panel className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><SectionLabel>Roadmap</SectionLabel><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Synthetic boxes, BentoPad, boxes as collateral and more. See what is live, what is in testing, and what ships next.</p></div><Link href="/roadmap" className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#f5a623]/45 px-5 py-2.5 text-sm font-semibold text-[#f5a623] hover:bg-[#f5a623]/10">View the roadmap<ArrowUpRight className="h-4 w-4" /></Link></Panel></section>;
}

export function RoadmapPage() {
  return <section className="mx-auto w-full max-w-4xl">
    <Panel className="p-7 sm:p-10">
      <SectionLabel>Roadmap</SectionLabel>
      <h1 className="mt-2 text-4xl font-black text-white">The Bento roadmap</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">In the order they unlock. No dates promised; everything ships through the 24h timelock and gets announced when live.</p>
      <div className="relative mt-10">
        <div className="absolute bottom-5 left-[11px] top-1 w-px bg-gradient-to-b from-[#f5a623]/60 via-[#f5a623]/25 to-transparent" aria-hidden />
        <ol className="space-y-8">
          {ROADMAP_PHASES.map((p) => (
            <li key={p.phase} className="relative pl-10">
              <span className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-[#10100e] ${p.status === "live" ? "border-[#22c55e]/60" : p.status === "planned" ? "border-zinc-600" : "border-[#f5a623]/60"}`} aria-hidden>
                <span className={`h-2 w-2 rounded-full ${p.status === "live" ? "bg-[#22c55e]" : p.status === "planned" ? "bg-zinc-600" : "bg-[#f5a623]"}`} />
              </span>
              <div className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white"><span className="font-mono text-xs font-normal uppercase tracking-[0.18em] text-zinc-500">{p.phase}</span> · {p.title}</h2>
                  <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${PHASE_STATUS_STYLES[p.status]}`}>{p.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{p.blurb}</p>
                <ul className="mt-4 space-y-3">
                  {p.items.map((item) => (
                    <li key={item.title} className="flex items-start gap-3 text-sm leading-6">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.done ? "bg-[#22c55e]" : "bg-zinc-600"}`} aria-hidden />
                      <span className="text-zinc-400"><span className="text-zinc-200">{item.title}.</span> {item.body}{item.done ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#22c55e]">live</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-8 text-xs leading-6 text-zinc-500">Order can change. Nothing here is a promise of returns; Bento is unaudited and every change goes through the public 24h timelock before it is live.</p>
    </Panel>
  </section>;
}

function BoxCard({ box, deployed, selected = false, onSelect }: { box: BoxInfo; deployed: boolean; selected?: boolean; onSelect?: () => void }) {
  const synthetic = isSynthetic(box);
  // Synthetic boxes read live from their own vault and do not depend on the engine deploy flag.
  const liveNav = deployed || synthetic;
  const displayNav = useDisplayNav(box, liveNav);
  const change24h = useBox24hChange(box, liveNav);
  const backingRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "backingDetailed", args: [box.id], query: { enabled: deployed && !synthetic } });
  const synthCollateralRead = useReadContract({ address: box.token, abi: syntheticBoxAbi, functionName: "totalCollateral", query: { enabled: synthetic } });
  const synthEthUsdRead = useReadContract({ address: box.token, abi: syntheticBoxAbi, functionName: "ethUsdPrice", query: { enabled: synthetic } });
  const backing = backingRead.data as BackingData | undefined;
  let tvlUsd = backing?.[3]?.reduce((sum, v) => sum + v, 0n);
  if (synthetic) {
    const collateral = synthCollateralRead.data as bigint | undefined;
    const ethUsd = synthEthUsdRead.data as bigint | undefined;
    // TVL = ETH collateral * ETH/USD (8 dec), scaled to 1e18 USD.
    tvlUsd = collateral !== undefined && ethUsd !== undefined ? (collateral * ethUsd) / 10n ** 8n : undefined;
  }
  const nav = liveNav ? formatUsd1e18(displayNav) : "$—.————";
  const move = liveNav ? formatChangePercent(change24h) : "—";
  const tvl = liveNav ? formatUsd1e18(tvlUsd) : "—";
  return <Panel className={`min-h-[18rem] transition ${onSelect ? "cursor-pointer hover:border-[#f5a623]/40" : ""} ${selected ? "border-[#f5a623]/60 ring-1 ring-[#f5a623]/40" : ""}`}><div role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined} className="outline-none"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="relative h-12 w-12 overflow-hidden rounded-xl bg-black"><Image src={box.thumb} alt={`${box.name} thumbnail`} fill sizes="48px" className="object-cover" loading="lazy" /></div><div><h2 className="text-2xl font-semibold text-white">{box.name}</h2><span className="mt-1 inline-flex items-center gap-2"><span className="inline-flex rounded-full border border-[#f5a623]/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f5a623]">{box.symbol}</span><BoxTypeBadge type={box.boxType} /></span></div></div>{selected ? <span className="rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f5a623]">Selected</span> : null}</div><p className="mt-5 text-sm leading-6 text-zinc-500">{box.description}</p><p className="mt-2 font-mono text-xs text-zinc-600">{box.componentSummary}</p><div className="mt-6 divide-y divide-[#f5a623]/10 border-y border-[#f5a623]/10"><MetricRow label="NAV" value={nav} dim={!deployed} /><MetricRow label="24h change" value={move} dim={!deployed} /><MetricRow label="TVL" value={tvl} dim={!deployed} /></div></div><div className="mt-5 flex gap-3"><Link href={`/mint?box=${box.symbol}`} className="inline-flex items-center gap-2 rounded-2xl bg-[#f5a623] px-4 py-2 text-xs font-semibold text-black hover:brightness-110"><ArrowUpRight className="h-3.5 w-3.5" />Mint</Link><Link href={`/redeem?box=${box.symbol}`} className="inline-flex items-center gap-2 rounded-2xl border border-[#f5a623]/45 px-4 py-2 text-xs font-semibold text-[#f5a623] hover:bg-[#f5a623]/10"><ArrowDownRight className="h-3.5 w-3.5" />Redeem</Link></div></Panel>;
}
function MetricRow({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3"><SectionLabel>{label}</SectionLabel><span className={`font-mono text-sm font-bold tabular-nums text-zinc-100 ${dim ? "opacity-40" : ""}`}>{value}</span></div>; }

export function ReservesPage() {
  return <Suspense><ReservesPageInner /></Suspense>;
}

function ReservesPageInner() {
  const [selectedBox, selectBox] = useSelectedBox();
  return isSynthetic(selectedBox) ? <SyntheticReservesPanel box={selectedBox} onSelect={selectBox} /> : <EngineReservesPanel selectedBox={selectedBox} selectBox={selectBox} />;
}

function EngineReservesPanel({ selectedBox, selectBox }: { selectedBox: BoxInfo; selectBox: (b: BoxInfo) => void }) {
  const data = useBentoData(selectedBox);
  const sym = selectedBox.symbol;
  const vaultConfigured = !isZeroAddress(contracts.mag7Vault) && selectedBox.id === 1n;
  const totalSupply = data.totalSupplyRead.data as bigint | undefined;
  const backingRatio = (() => { if (!data.deployed || totalSupply === undefined || data.tvlUsd === undefined) return undefined; if (totalSupply === 0n) return "no supply yet"; const nav = data.navRead.data as bigint | undefined; if (nav === undefined) return undefined; const liabilities = (totalSupply * nav) / 10n ** 18n; if (liabilities === 0n) return "no supply yet"; const ratio = Number((data.tvlUsd * 10000n) / liabilities) / 100; return `${ratio.toFixed(2)}%`; })();
  return <Panel muted={!data.deployed}><SectionLabel>Proof of reserves</SectionLabel><h1 className="mt-3 text-4xl font-black text-white">{sym} reserve table</h1><div className="mt-4"><BoxSelector selected={selectedBox} onSelect={selectBox} /></div><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">Vault explorer links remain hidden until the vault env var is set. Token links are component token contracts, never zero-address placeholders.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><StatCard label="Total backing" value={data.deployed ? formatUsd1e18(data.tvlUsd) : SOON} emptyChart={false} /><StatCard label="Box supply" value={data.deployed && totalSupply !== undefined ? `${formatBig(totalSupply)} ${sym}` : SOON} emptyChart={false} /><StatCard label="Backing ratio" value={backingRatio ?? (data.deployed ? "—" : SOON)} emptyChart={false} /></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/60"><tr><th className="py-3">Stock</th><th>Token</th><th>Weight</th><th>Amount held</th><th>Feed price</th><th>Feed age</th><th>USD value</th>{vaultConfigured ? <th>Verify</th> : null}</tr></thead><tbody>{data.comps.map((c, i) => { const price = data.deployed && data.feedInfo[i]?.answer !== undefined && data.feedInfo[i]?.decimals !== undefined ? `$${formatBig(data.feedInfo[i].answer, data.feedInfo[i].decimals, 2)}` : SOON; return <tr key={c.symbol} className="border-t border-[#f5a623]/10"><td className="py-4"><div className="flex items-center gap-3"><StockLogo symbol={c.symbol} /><div><div className="font-mono font-bold text-white">{c.symbol}</div><div className="text-xs text-zinc-500">{c.name}</div></div></div></td><td><a href={explorerAddress(c.token)} target="_blank" rel="noreferrer" className="font-mono text-xs text-zinc-400 underline decoration-[#f5a623]/20 underline-offset-4">{short(c.token)}</a></td><td><WeightBar bps={c.weightBps} /></td><td className="font-mono text-zinc-400">{data.deployed ? formatBig(data.backingData?.[2]?.[i]) : SOON}</td><td className="font-mono text-zinc-400">{price}</td><td className="font-mono text-zinc-400">{data.deployed ? feedAge(data.feedInfo[i]?.updatedAt) : SOON}</td><td className="font-mono text-zinc-400">{data.deployed ? formatUsd1e18(data.backingData?.[3]?.[i]) : SOON}</td>{vaultConfigured ? <td><a href={explorerAddress(contracts.mag7Vault)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#f5a623]/25 px-3 py-2 font-mono text-xs text-[#f5a623]">Vault <ExternalLink className="h-3 w-3" /></a></td> : null}</tr>; })}</tbody></table></div><DisabledHint /></Panel>;
}

function StockLogo({ symbol }: { symbol: string }) { return <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#f5a623]/25 bg-black font-mono text-xs font-black text-[#f5a623]">{symbol.slice(0, 2)}</div>; }
function WeightBar({ bps }: { bps: bigint }) { const pct = Number(bps) / 100; return <div className="min-w-[10rem]"><div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500"><span>Weight</span><span>{pct.toFixed(2)}%</span></div><div className="h-2 rounded-full bg-black"><div className="h-2 rounded-full bg-[#f5a623]" style={{ width: `${pct}%` }} /></div></div>; }

export function MintPage() {
  return <Suspense><MintPageInner /></Suspense>;
}

function MintPageInner() {
  const [selectedBox, selectBox] = useSelectedBox();
  return isSynthetic(selectedBox) ? <SyntheticMintPanel box={selectedBox} onSelect={selectBox} /> : <EngineMintPanel selectedBox={selectedBox} selectBox={selectBox} />;
}

function EngineMintPanel({ selectedBox, selectBox }: { selectedBox: BoxInfo; selectBox: (b: BoxInfo) => void }) {
  const data = useBentoData(selectedBox);
  const usingUsdg = data.payAsset === "USDG";
  const overPerTx = (() => { try { return !usingUsdg && data.perTxCap !== undefined && parseEther(data.ethIn || "0") > data.perTxCap; } catch { return false; } })();
  const thinPoolWarning = selectedBox.components.some((c) => c.thinPoolWarning) && Number(data.ethIn || "0") > 0.05 && !usingUsdg;
  return <section className="mx-auto w-full max-w-3xl"><Panel muted={!data.deployed} className="p-7 sm:p-10"><SectionLabel>Mint {selectedBox.symbol}</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Enter {usingUsdg ? "USDG" : "ETH"}</h1><div className="mt-5"><BoxSelector selected={selectedBox} onSelect={selectBox} /></div><div className="mt-6 flex gap-2">{(["ETH", "USDG"] as const).map((asset) => <button key={asset} type="button" onClick={() => data.setPayAsset(asset)} disabled={asset === "USDG" && !data.zapperConfigured} className={`rounded-full border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition ${data.payAsset === asset ? "border-[#f5a623] bg-[#f5a623]/15 text-[#f5a623]" : "border-[#f5a623]/20 text-zinc-500 hover:text-zinc-300"} ${asset === "USDG" && !data.zapperConfigured ? "cursor-not-allowed opacity-40" : ""}`}>{asset}{asset === "USDG" && !data.zapperConfigured ? " · soon" : ""}</button>)}</div><div className="mt-6">{usingUsdg ? <FormInput label="USDG amount" value={data.usdgIn} onChange={data.setUsdgIn} suffix="USDG" large /> : <FormInput label="ETH amount" value={data.ethIn} onChange={data.setEthIn} suffix="ETH" large />}</div><div className="mt-5"><FormInput label="Send to (optional, gift a box)" value={data.giftRecipient} onChange={data.setGiftRecipient} suffix="0x…" /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><FormInput label="Slippage" value={data.slippage} onChange={data.setSlippage} suffix="%" /><StatCard label="Protocol fee" value={data.deployed ? (usingUsdg ? `${(Number(data.usdgIn || "0") * Number(data.mintFeeBps) / 10000).toFixed(4)} USDG eq.` : `${formatBig(parseSafeEther(data.ethIn) * data.mintFeeBps / BPS, 18, 6)} ETH`) : SOON} emptyChart={false} /></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard label="Quote box out" value={data.mintQuote.boxOut ? `${formatBig(data.mintQuote.boxOut)} ${selectedBox.symbol}` : data.mintQuote.error || (data.deployed ? "—" : SOON)} emptyChart={false} /><StatCard label="Minimum box out" value={data.mintQuote.minBoxOut ? formatBig(data.mintQuote.minBoxOut) : data.deployed ? "—" : SOON} emptyChart={false} /></div>{overPerTx ? <Warning text="This input exceeds the per-transaction mint cap." /> : null}{thinPoolWarning ? <Warning text="Size may exceed ~1% price impact on thinner MSFT/META pools. Consider smaller chunks." /> : null}{usingUsdg ? <Warning text="USDG mint swaps to ETH first (approve + mint, two transactions). Quote shown is for the ETH path; expect a small extra swap fee." /> : null}<div className="mt-8"><Action onClick={data.quoteMint} disabled={!data.deployed} large>Quote mint</Action></div><div className="mt-3"><Action onClick={usingUsdg ? data.submitMintUSDG : data.submitMint} disabled={!data.isConnected || data.writePending || (usingUsdg ? !data.zapperConfigured : !data.mintQuote.minBoxOut)} variant="outline" large>{usingUsdg ? "Mint with USDG" : "Mint"}</Action></div><Breakdown title="Execution guardrails" components={selectedBox.components} quotes={data.mintQuote.componentQuotes} mins={data.mintQuote.componentMins} unit="tokens" deployed={data.deployed} /><DisabledHint /></Panel>{data.txMessage ? <Toast text={data.txMessage} /> : null}</section>;
}

function Breakdown({ title, components, quotes, mins, unit, deployed }: { title: string; components: BoxInfo["components"]; quotes?: bigint[]; mins?: bigint[]; unit: string; deployed?: boolean }) { const fallback = deployed ? "quoting…" : SOON; return <details open className="mt-5 rounded-2xl border border-[#f5a623]/15 bg-black/25 p-4"><summary className="flex cursor-pointer list-none items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f5a623]"><span>{title}</span><ChevronDown className="h-4 w-4" /></summary><div className="mt-4 space-y-2 text-sm">{components.map((c, i) => <div key={c.symbol} className="rounded-2xl bg-[#10100e] p-3"><div className="flex justify-between"><span className="font-mono font-semibold text-white">{c.symbol}{c.thinPoolWarning ? " · thin" : ""}</span><span className="font-mono text-zinc-500">{unit}</span></div><div className="mt-2 grid gap-1 font-mono text-xs text-zinc-400"><span>Quote: {quotes?.[i] !== undefined ? formatBig(quotes[i], 18, unit === "ETH" ? 6 : 4) : fallback}</span><span>Minimum: {mins?.[i] !== undefined ? formatBig(mins[i], 18, unit === "ETH" ? 6 : 4) : fallback}</span></div></div>)}</div></details>; }

export function RedeemPage() { return <Suspense><RedeemPageInner /></Suspense>; }

function RedeemPageInner() { const [selectedBox, selectBox] = useSelectedBox(); return isSynthetic(selectedBox) ? <SyntheticRedeemPanel box={selectedBox} onSelect={selectBox} /> : <EngineRedeemPanel selectedBox={selectedBox} selectBox={selectBox} />; }

function EngineRedeemPanel({ selectedBox, selectBox }: { selectedBox: BoxInfo; selectBox: (b: BoxInfo) => void }) { const data = useBentoData(selectedBox); const sym = selectedBox.symbol; const pendingClaims = data.claimsReads.data?.some((r) => ((r.result as bigint | undefined) ?? 0n) > 0n); return <section className="grid gap-5 lg:grid-cols-2"><Panel muted={!data.deployed}>{pendingClaims ? <Link href="/portfolio" className="mb-5 block rounded-2xl border border-[#f5a623]/20 bg-[#f5a623]/10 p-3 text-sm text-[#f5a623]">You have pending failed-leg claims. Open Portfolio to execute claims.</Link> : null}<SectionLabel>Redeem {sym}</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Exit route</h1><div className="mt-5"><BoxSelector selected={selectedBox} onSelect={selectBox} /></div><div className="mt-5"><StatCard label="Connected balance" value={data.boxBalanceRead.data ? `${formatBig(data.boxBalanceRead.data as bigint)} ${sym}` : data.deployed ? "—" : SOON} emptyChart={false} /></div><div className="mt-5"><FormInput label={`${sym} amount`} value={data.redeemAmount} onChange={data.setRedeemAmount} suffix={sym} large /></div><div className="mt-5"><FormInput label="Slippage" value={data.slippage} onChange={data.setSlippage} suffix="%" /></div><div className="mt-5 grid gap-4"><StatCard label="Redeem fee" value={data.deployed ? `${formatBig(parseSafeEther(data.redeemAmount) * data.redeemFeeBps / BPS, 18, 6)} ${sym}` : SOON} emptyChart={false} /><StatCard label="ETH quote" value={data.redeemQuote.ethOut ? `${formatBig(data.redeemQuote.ethOut, 18, 6)} ETH` : data.redeemQuote.error || (data.deployed ? "—" : SOON)} emptyChart={false} /><StatCard label="Minimum ETH out" value={data.redeemQuote.minEthOut ? `${formatBig(data.redeemQuote.minEthOut, 18, 6)} ETH` : data.deployed ? "—" : SOON} emptyChart={false} /></div><div className="mt-5 flex flex-wrap gap-3"><Action onClick={data.quoteRedeem} disabled={!data.deployed}>Quote ETH path</Action><Action onClick={data.redeemForEth} disabled={!data.isConnected || data.writePending} variant="outline">Redeem for ETH</Action><Action onClick={data.redeemForStocks} disabled={!data.isConnected || data.writePending} variant="outline">Redeem for stocks</Action></div><DisabledHint /></Panel><Panel muted={!data.deployed}><SectionLabel>Execution guardrails</SectionLabel><Breakdown title="Redeem ETH leg minimums" components={selectedBox.components} quotes={data.redeemQuote.componentQuotes} mins={data.redeemQuote.componentMins} unit="ETH" deployed={data.deployed} /></Panel>{data.txMessage ? <Toast text={data.txMessage} /> : null}</section>; }

export function PortfolioPage() {
  return <Suspense><PortfolioPageInner /></Suspense>;
}

function PortfolioPageInner() {
  const [selectedBox, selectBox] = useSelectedBox();
  return isSynthetic(selectedBox) ? <SyntheticPortfolioPanel box={selectedBox} onSelect={selectBox} /> : <EnginePortfolioPanel selectedBox={selectedBox} selectBox={selectBox} />;
}

function EnginePortfolioPanel({ selectedBox, selectBox }: { selectedBox: BoxInfo; selectBox: (b: BoxInfo) => void }) {
  const data = useBentoData(selectedBox);
  const sym = selectedBox.symbol;
  const ethRound = data.ethFeedReads.data?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  const ethFeedDecimals = data.ethFeedReads.data?.[1]?.result as number | undefined;
  const ethStale = data.deployed && isFeedStale(ethRound?.[3]);
  const boxBalance = data.boxBalanceRead.data as bigint | undefined;
  const boxSupply = data.totalSupplyRead.data as bigint | undefined;
  const stockRows = data.comps.map((component, i) => {
    const walletBalance = (data.stockBalanceReads.data?.[i]?.result as bigint | undefined) ?? 0n;
    const vaultShare = boxBalance && boxSupply && boxSupply > 0n ? (((data.backingData?.[2]?.[i] ?? 0n) * boxBalance) / boxSupply) : 0n;
    const balance = walletBalance + vaultShare;
    const feed = data.feedInfo[i];
    const stale = data.deployed && isFeedStale(feed?.updatedAt);
    return {
      symbol: component.symbol,
      name: component.name,
      kind: vaultShare > 0n && walletBalance === 0n ? `via ${sym} box` : "underlying stock",
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
        <p className="mt-3 text-sm text-zinc-400">Connect a wallet to read live ETH, box token, stock balances, and pending claims.</p>
        <div className="mt-5"><WalletPanel /></div>
      </Panel>
    );
  }

  const totalBoxSupply = data.totalSupplyRead.data as bigint | undefined;
  const supplyShare = (() => { if (!data.deployed || !boxBalance || !totalBoxSupply || totalBoxSupply === 0n) return undefined; const bps = Number((boxBalance * 1000000n) / totalBoxSupply) / 10000; return bps >= 0.01 ? `${bps.toFixed(2)}% of all ${sym}` : `<0.01% of all ${sym}`; })();
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
        <div className="mt-4"><BoxSelector selected={selectedBox} onSelect={selectBox} /></div>
        {!data.deployed ? <DisabledHint /> : null}
        {supplyShare ? <p className="mt-3 font-mono text-sm text-[#f5a623]">{supplyShare}</p> : null}
        {data.deployed && !hasHoldings ? (
          <div className="mt-6 rounded-2xl border border-[#f5a623]/10 bg-black/25 p-6 text-sm text-zinc-500">No {sym}, component stock, or ETH holdings found for this wallet.</div>
        ) : null}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5a623]/60">
              <tr><th className="py-3">Asset</th><th>Type</th><th>Amount</th><th>USD value</th></tr>
            </thead>
            <tbody>
              <HoldingRow name="ETH" kind="native" amount={data.ethBalanceRead.data ? formatBig(data.ethBalanceRead.data.value, 18, 6) : data.deployed ? "—" : SOON} usd={ethUsd} />
              <HoldingRow name={selectedBox.name} kind="box token" amount={data.deployed ? formatBig(boxBalance) : SOON} usd={data.deployed ? formatUsd1e18(usdFromNav(boxBalance, data.navRead.data as bigint | undefined)) : SOON} />
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
        {data.comps.map((component, i) => {
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
    ["1 · Get a wallet", <span key="s1">Install <a href="https://metamask.io" className="text-[#f5a623] hover:underline">MetaMask</a> (or any EVM wallet) as a browser extension or mobile app and back up your seed phrase. On mobile, open this site inside your wallet&apos;s built-in browser (MetaMask and Trust both have one) so Connect can find it.</span>],
    ["2 · Add Robinhood Chain", <span key="s2">One click below, or add manually: RPC <span className="font-mono text-zinc-200">rpc.mainnet.chain.robinhood.com</span>, chain ID <span className="font-mono text-zinc-200">4663</span>, currency ETH, explorer <span className="font-mono text-zinc-200">robinhoodchain.blockscout.com</span>.</span>],
    ["3 · Bridge ETH in", <span key="s3">Move ETH to Robinhood Chain using the official bridge or an exchange that supports withdrawals to it. Even a small amount works, mints start tiny.</span>],
    ["4 · Mint MAG7", <span key="s4">Open <Link href="/mint" className="text-[#f5a623] hover:underline">Mint</Link>, connect your wallet, enter an ETH or USDG amount, press Quote mint, then Mint. Your ETH is split across the seven underlying tokenized stocks and you receive MAG7 box tokens.</span>],
    ["5 · See it in your wallet", <span key="s5">Import the MAG7 token contract below into your wallet to see the balance. Your holdings also show on the <Link href="/portfolio" className="text-[#f5a623] hover:underline">Portfolio</Link> page, including your share of the underlying stocks.</span>],
    ["6 · Exit anytime", <span key="s6">Use <Link href="/redeem" className="text-[#f5a623] hover:underline">Redeem</Link> to burn MAG7 back into ETH, or take delivery of the underlying tokenized stocks directly.</span>],
  ];
  const cas: [string, Address][] = [["MAG7 box token", contracts.mag7BoxToken], ["BENTO", contracts.bentoToken]];
  return <section className="mx-auto w-full max-w-3xl"><Panel className="p-7 sm:p-10"><SectionLabel>Getting started</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">Onboarding guide</h1><p className="mt-3 text-sm leading-6 text-zinc-400">From zero to holding a MAG7 box in six steps. No prior on-chain experience needed.</p><div className="mt-6"><Action onClick={addNetwork} large>Add Robinhood Chain to wallet</Action>{netMsg ? <p className="mt-3 font-mono text-xs text-zinc-400">{netMsg}</p> : null}</div><div className="mt-8 space-y-4">{steps.map(([t, body]) => <div key={t} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5"><SectionLabel>{t}</SectionLabel><p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p></div>)}</div><div className="mt-8"><SectionLabel>Token contracts</SectionLabel><div className="mt-3 space-y-2">{cas.map(([label, addr]) => isZeroAddress(addr) ? null : <button key={label} onClick={() => copy(addr, label)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#f5a623]/15 bg-black/25 px-4 py-3 text-left hover:border-[#f5a623]/40"><span className="text-sm text-zinc-300">{label}</span><span className="flex items-center gap-2 font-mono text-xs text-zinc-500">{short(addr)}{copied === label ? <Check className="h-3 w-3 text-[#22c55e]" /> : <Copy className="h-3 w-3" />}</span></button>)}</div></div><p className="mt-8 text-xs leading-5 text-zinc-600">Bento is unaudited. Only deposit what you can afford to lose. Proof of reserves is on-chain, see <Link href="/reserves" className="text-zinc-500 hover:text-[#f5a623]">Reserves</Link>.</p></Panel></section>;
}

export function HowItWorksPage() {
  const faq: [string, string][] = [
    ["Which type should I pick?", "If you want a claim on real reserves you can redeem for the underlying tokens, use a 1:1 backed box. If you want exposure to assets that have no DEX liquidity on Robinhood Chain, synthetic boxes cover a much wider menu once they launch."],
    ["Do synthetic boxes hold the stocks?", "No. A synthetic box holds ETH collateral and tracks component prices through Chainlink feeds. You own exposure to the price, not the underlying tokens."],
    ["What happens if a price feed pauses?", "For synthetic boxes, mint and redeem halt until the feed resumes. That is a safety measure: the protocol will not price the box on stale data."],
    ["Can I redeem a synthetic box for stocks?", "No. Synthetic boxes mint and redeem in ETH at oracle NAV. Only 1:1 backed boxes support delivery of the underlying tokenized stocks."],
    ["What is a mixed box?", "A planned future type where some components are held 1:1 in the vault and the rest are tracked synthetically. Not live yet."],
    ["Is any of this audited?", "No. Bento is unaudited. Proof of reserves for backed boxes is verifiable on-chain, but that is not a substitute for an audit. Only deposit what you can afford to lose."],
  ];
  return <section className="mx-auto w-full max-w-4xl space-y-6">
    <Panel className="p-7 sm:p-10">
      <SectionLabel>Box types</SectionLabel>
      <h1 className="mt-2 text-4xl font-black text-white">How boxes work</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">Every Bento box is a token that tracks a basket of assets. There are two ways a box can do that, and the difference matters for what you actually own. A third type combining both is planned.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-[#22c55e]/20 bg-black/25 p-6">
          <BoxTypeBadge type="backed" />
          <h2 className="mt-4 text-xl font-semibold text-white">1:1 Backed</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">The box vault holds the actual tokenized stocks on Robinhood Chain. When you mint, your ETH is swapped on a DEX into the underlying components and deposited into the vault. When you redeem, you get ETH from selling those reserves, or the tokens themselves delivered to your wallet.</p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
            <li><span className="text-zinc-200">You own:</span> a claim on real reserves, verifiable on-chain.</li>
            <li><span className="text-zinc-200">Trust model:</span> proof of reserves. The vault balance is public and must cover box supply.</li>
            <li><span className="text-zinc-200">Limits:</span> each component needs both a Chainlink feed and DEX liquidity, max 10 components per box. That keeps the menu narrow.</li>
          </ul>
          <p className="mt-4 font-mono text-xs text-zinc-500">Current boxes: MAG7, AI3</p>
        </div>
        <div className="rounded-2xl border border-[#818cf8]/20 bg-black/25 p-6">
          <BoxTypeBadge type="synthetic" />
          <h2 className="mt-4 text-xl font-semibold text-white">Synthetic</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">The box tracks component prices through Chainlink oracles only. No underlying stocks are held; the vault holds ETH as collateral. You mint with ETH and redeem for ETH at the oracle-priced NAV. You get the price exposure, not ownership of the assets.</p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
            <li><span className="text-zinc-200">You own:</span> an ETH-collateralized claim that tracks the basket price.</li>
            <li><span className="text-zinc-200">Trust model:</span> oracle integrity plus a collateral floor in the vault. If feeds pause, mint and redeem halt for safety.</li>
            <li><span className="text-zinc-200">Limits:</span> any feed-listed asset works, no DEX liquidity needed, unlimited components. Wide menu, but nothing to take delivery of.</li>
          </ul>
          <p className="mt-4 font-mono text-xs text-zinc-500">Current boxes: SEMI6, CRYPTOEQ, SPYQQQ</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-[#f59e0b]/20 bg-black/25 p-6">
        <BoxTypeBadge type="mixed" />
        <h2 className="mt-4 text-xl font-semibold text-white">Mixed <span className="font-mono text-xs font-normal uppercase tracking-[0.18em] text-zinc-500">future</span></h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Some components held 1:1 in the vault, others tracked synthetically. Useful when part of a basket has deep liquidity on-chain and part does not. Planned, not built.</p>
      </div>
    </Panel>
    <Panel className="p-7 sm:p-10">
      <SectionLabel>Tradeoffs, honestly</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold text-white">What you give up either way</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-400">
        <p><span className="font-semibold text-zinc-200">1:1 backed</span> gives you redeemability against real reserves: even if every oracle went dark, the tokens are in the vault and yours to claim. The cost is a narrow menu. Every component needs a live feed and enough DEX liquidity to mint and redeem without heavy slippage, and boxes cap out at 10 components. Thin pools also mean price impact on larger sizes.</p>
        <p><span className="font-semibold text-zinc-200">Synthetic</span> flips that. Any asset with a feed can go in a box, baskets can be as broad as an index, and there is no slippage from DEX routing. The cost is that you are trusting the oracle to price your position and the ETH collateral to cover it. You track the price of the basket; you never own the assets. A paused feed freezes mint and redeem until it resumes.</p>
        <p>Neither type is strictly better. Backed boxes are for people who want reserves they can point to. Synthetic boxes are for people who want breadth and accept oracle risk to get it.</p>
      </div>
    </Panel>
    <Panel className="p-7 sm:p-10">
      <SectionLabel>Mint and redeem</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold text-white">Mechanics by type</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5">
          <SectionLabel>1:1 backed mint</SectionLabel>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Send ETH. The protocol takes its fee, splits the rest by component weights, buys each tokenized stock on the DEX, and deposits them in the vault. You receive box tokens if all slippage checks pass.</p>
        </div>
        <div className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5">
          <SectionLabel>1:1 backed redeem</SectionLabel>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Burn box tokens. Choose ETH (reserves are sold back through the DEX) or direct delivery of your share of the underlying tokenized stocks.</p>
        </div>
        <div className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5">
          <SectionLabel>Synthetic mint</SectionLabel>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Send ETH. The oracle prices the basket, you receive box tokens at that NAV, and your ETH stays in the vault as collateral. No swaps, no slippage.</p>
        </div>
        <div className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5">
          <SectionLabel>Synthetic redeem</SectionLabel>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Burn box tokens, receive ETH from the vault at the current oracle NAV. If any component feed is paused, redeem waits until it resumes.</p>
        </div>
      </div>
    </Panel>
    <Panel className="p-7 sm:p-10">
      <SectionLabel>FAQ</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold text-white">Common questions</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{faq.map(([q, a]) => <div key={q} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5"><SectionLabel>{q}</SectionLabel><p className="mt-3 text-sm leading-6 text-zinc-300">{a}</p></div>)}</div>
      <p className="mt-8 text-xs leading-5 text-zinc-600">Proof of reserves for backed boxes is on-chain, see <Link href="/reserves" className="text-zinc-500 hover:text-[#f5a623]">Reserves</Link>. New to the app? Start with the <Link href="/guide" className="text-zinc-500 hover:text-[#f5a623]">Guide</Link>.</p>
    </Panel>
  </section>;
}

function InfoPage({ title, label, rows }: { title: string; label: string; rows: [string, string][] }) { return <Panel><SectionLabel>{label}</SectionLabel><h1 className="mt-2 text-4xl font-black text-white">{title}</h1><div className="mt-6 grid gap-4 md:grid-cols-2">{rows.map(([q, a]) => <div key={q} className="rounded-2xl border border-[#f5a623]/15 bg-black/25 p-5"><SectionLabel>{q}</SectionLabel><p className="mt-3 text-sm leading-6 text-zinc-300">{a}</p></div>)}</div></Panel>; }
function Footer() { return <footer className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"><div className="flex flex-col gap-3 rounded-3xl border border-[#f5a623]/15 bg-[#10100e] px-5 py-4 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><Info className="h-4 w-4 text-[#f5a623]" /><span>1 box = a claim on its underlying tokenized equities</span></div><div className="flex flex-wrap gap-3"><a href="https://x.com/BentoEtf" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-[#f5a623]">X: @BentoEtf</a><a href="https://github.com/bentoetf/bento-contracts" className="text-zinc-500 hover:text-[#f5a623]">Unaudited · v1.0.0-rc3</a><Link href="/reserves" className="text-zinc-500 hover:text-[#f5a623]">Proof of reserves: on-chain</Link></div></div></footer>; }

