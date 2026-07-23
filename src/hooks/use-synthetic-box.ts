"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseEther, type Address } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { erc20Abi, feedAbi, robinhood, syntheticBoxAbi, type BoxInfo } from "@/config/contracts";

// NAV per share is 8-decimal USD; genesis is 100e8 ($100). We reuse the box feed proxies for
// per-component price display, but the vault's own navPerShare() is the source of truth for NAV.
export function useSyntheticData(box: BoxInfo) {
  const vault = box.token;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhood.id });
  const { writeContractAsync, isPending: writePending } = useWriteContract();

  const [ethIn, setEthIn] = useState("0.01");
  const [redeemShares, setRedeemShares] = useState("0");
  const [txMessage, setTxMessage] = useState<string>();

  const navRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "navPerShare", query: { staleTime: 15_000 } });
  const supplyRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "totalSupply", query: { staleTime: 15_000 } });
  const mintFeeRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "mintFeeBps", query: { staleTime: 60_000 } });
  const redeemFeeRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "redeemFeeBps", query: { staleTime: 60_000 } });
  const pausedRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "paused", query: { staleTime: 30_000 } });
  const ethUsdRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "ethUsdPrice", query: { staleTime: 30_000 } });
  const collateralRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "totalCollateral", query: { staleTime: 15_000 } });
  const balanceRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address, staleTime: 0 } });
  const vaultEthRead = useBalance({ address: vault, chainId: robinhood.id, query: { staleTime: 15_000 } });
  const ethBalanceRead = useBalance({ address, chainId: robinhood.id, query: { enabled: !!address, staleTime: 0 } });

  const feedReads = useReadContracts({
    contracts: box.components.flatMap((c) => [
      { address: c.feed, abi: feedAbi, functionName: "latestRoundData" },
      { address: c.feed, abi: feedAbi, functionName: "decimals" },
    ]),
    query: { staleTime: 30_000 },
  });
  const feedInfo = useMemo(() => box.components.map((component, i) => {
    const round = feedReads.data?.[i * 2]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
    const decimals = feedReads.data?.[i * 2 + 1]?.result as number | undefined;
    return { component, answer: round?.[1], updatedAt: round?.[3], decimals };
  }), [box.components, feedReads.data]);

  // Live preview reads, debounced through the query key changing with the input.
  const mintPreviewValue = safeEther(ethIn);
  const previewMintRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "previewMint", args: [mintPreviewValue], query: { enabled: mintPreviewValue > 0n, staleTime: 5_000 } });
  const redeemPreviewValue = safeEther(redeemShares);
  const previewRedeemRead = useReadContract({ address: vault, abi: syntheticBoxAbi, functionName: "previewRedeem", args: [redeemPreviewValue], query: { enabled: redeemPreviewValue > 0n, staleTime: 5_000 } });

  const nav = navRead.data as bigint | undefined;
  const supply = supplyRead.data as bigint | undefined;
  const mintFeeBps = (mintFeeRead.data as bigint | undefined) ?? 30n;
  const redeemFeeBps = (redeemFeeRead.data as bigint | undefined) ?? 30n;
  const paused = pausedRead.data as boolean | undefined;
  const ethUsd = ethUsdRead.data as bigint | undefined;
  const collateral = collateralRead.data as bigint | undefined;
  const balance = balanceRead.data as bigint | undefined;
  const mintPreview = previewMintRead.data as readonly [bigint, bigint] | undefined;
  const redeemPreview = previewRedeemRead.data as readonly [bigint, bigint] | undefined;

  // Liabilities = totalSupply * navPerShare, converted to ETH at the live ETH/USD price.
  const liabilitiesEth = useMemo(() => {
    if (supply === undefined || nav === undefined || ethUsd === undefined || ethUsd === 0n) return undefined;
    const usd8 = (supply * nav) / 10n ** 18n; // 8-decimal USD
    return (usd8 * 10n ** 18n) / ethUsd;
  }, [supply, nav, ethUsd]);

  // Redeem is floored to pro-rata collateral. Detect when the NAV payout would exceed pro-rata.
  const redeemFloored = useMemo(() => {
    if (!redeemPreview || supply === undefined || supply === 0n || collateral === undefined || nav === undefined || ethUsd === undefined || ethUsd === 0n) return false;
    const usd8 = (redeemPreviewValue * nav) / 10n ** 18n;
    const navEth = ethUsd === 0n ? 0n : (usd8 * 10n ** 18n) / ethUsd;
    const proRataEth = (redeemPreviewValue * collateral) / supply;
    return navEth > proRataEth;
  }, [redeemPreview, redeemPreviewValue, supply, collateral, nav, ethUsd]);

  async function submitMint() {
    try {
      if (!address) throw new Error("Connect wallet first.");
      const value = safeEther(ethIn);
      if (value <= 0n) throw new Error("Enter an ETH amount.");
      const hash = await writeContractAsync({ address: vault, abi: syntheticBoxAbi, functionName: "mint", args: [], value, chainId: robinhood.id });
      setTxMessage(`Mint sent: ${hash}`);
    } catch (error) { setTxMessage(friendly(error)); }
  }
  async function submitRedeem() {
    try {
      if (!address) throw new Error("Connect wallet first.");
      const shares = safeEther(redeemShares);
      if (shares <= 0n) throw new Error(`Enter a ${box.symbol} amount.`);
      const hash = await writeContractAsync({ address: vault, abi: syntheticBoxAbi, functionName: "redeem", args: [shares], chainId: robinhood.id });
      setTxMessage(`Redeem sent: ${hash}`);
    } catch (error) { setTxMessage(friendly(error)); }
  }

  return {
    box, kind: "synthetic" as const, address, isConnected, writePending,
    nav, supply, mintFeeBps, redeemFeeBps, paused, ethUsd, collateral, balance,
    liabilitiesEth, redeemFloored, feedInfo,
    vaultEth: vaultEthRead.data?.value, ethBalance: ethBalanceRead.data?.value,
    mintPreview, redeemPreview,
    ethIn, setEthIn, redeemShares, setRedeemShares, txMessage,
    submitMint, submitRedeem,
  };
}

function safeEther(value: string): bigint { try { return parseEther(value || "0"); } catch { return 0n; } }
function friendly(error?: unknown): string {
  const text = error instanceof Error ? error.message : String(error || "");
  if (text.includes("Paused")) return "Mint and redeem are paused.";
  if (text.includes("StaleOracle") || text.includes("StaleEthOracle")) return "market closed (stale price feed)";
  if (text.includes("User rejected")) return "Transaction rejected in wallet.";
  if (text.includes("ZeroAmount")) return "Amount too small.";
  return text.slice(0, 220) || "Transaction failed.";
}

// NAV per share (8 decimals) formatted as USD.
export function formatNav8(nav?: bigint): string {
  if (nav === undefined) return "$—.——";
  return `$${Number(formatUnits(nav, 8)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// 24h synthetic NAV change from the weighted component feeds, mirroring the engine box change hook.
export function useSynthetic24hChange(box: BoxInfo): number | null | undefined {
  const client = usePublicClient({ chainId: robinhood.id });
  const [value, setValue] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const latest = await client.multicall({ contracts: box.components.map((c) => ({ address: c.feed as Address, abi: feedAbi, functionName: "latestRoundData" } as const)), allowFailure: true });
        const now = BigInt(Math.floor(Date.now() / 1000));
        const target = now - 86_400n;
        let weighted = 0; let covered = 0;
        for (let i = 0; i < box.components.length; i++) {
          const r = latest[i];
          const round = r.status === "success" ? (r.result as readonly [bigint, bigint, bigint, bigint, bigint]) : undefined;
          if (!round || round[1] <= 0n) continue;
          const past = await priceAgo(client, box.components[i].feed as Address, round[0], round[1], round[3], target);
          if (past === undefined || past <= 0n) continue;
          const change = Number(round[1] - past) / Number(past);
          const w = Number(box.components[i].weightBps) / 10_000;
          weighted += change * w; covered += w;
        }
        if (!cancelled) setValue(covered < 0.5 ? null : (weighted / covered) * 100);
      } catch { if (!cancelled) setValue(null); }
    })();
    return () => { cancelled = true; };
  }, [box, client]);
  return value;
}

async function priceAgo(client: NonNullable<ReturnType<typeof usePublicClient>>, feed: Address, latestId: bigint, latestAnswer: bigint, latestUpdated: bigint, target: bigint): Promise<bigint | undefined> {
  if (latestUpdated <= target) return latestAnswer;
  const steps = [1n, 2n, 4n, 8n, 16n, 32n, 64n, 128n, 256n, 512n, 1024n];
  const ids = steps.map((s) => latestId - s).filter((id) => id > 0n);
  const res = await client.multicall({ contracts: ids.map((id) => ({ address: feed, abi: feedAbi, functionName: "getRoundData", args: [id] } as const)), allowFailure: true });
  for (const r of res) {
    if (r.status !== "success") continue;
    const round = r.result as readonly [bigint, bigint, bigint, bigint, bigint];
    if (round[1] > 0n && round[3] > 0n && round[3] <= target) return round[1];
  }
  return undefined;
}
