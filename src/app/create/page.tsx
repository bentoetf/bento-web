"use client";

// Custom box builder on the main site: creates a coinless synthetic box via
// BoxFactory.createBoxWithoutCoin. No creator coin, no Pons launch, no drip;
// mint/redeem fees route 100% to the protocol wallet. For the coin+box+drip
// launch flow, use pad.bentoetf.com instead.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog, formatEther, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { boxFactoryAbi } from "@/config/box-factory-abi";
import { DEFAULT_STALENESS, selectableFeeds, type FeedEntry } from "@/config/feeds";
import { SYNTHETIC_BOX_ADDRESSES } from "@/config/contracts";

type Selected = { feed: FeedEntry; weightBps: number };

const BPS_TOTAL = 10_000;

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("User rejected")) return "Transaction rejected in wallet.";
  if (text.includes("InsufficientFee")) return "msg.value must equal the creation fee exactly.";
  if (text.includes("CreationsPaused")) return "Box creations are currently paused.";
  return text.slice(0, 240);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f5a623]/70">{children}</p>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[#f5a623]/15 bg-[#10100e] p-6 ${className}`}>{children}</section>;
}

export default function CreatePage() {
  const factory = SYNTHETIC_BOX_ADDRESSES.factory;
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const client = usePublicClient();
  const router = useRouter();

  const [selected, setSelected] = useState<Selected[]>([]);
  const [boxName, setBoxName] = useState("");
  const [boxSymbol, setBoxSymbol] = useState("");
  const [txHash, setTxHash] = useState<string>();
  const [txError, setTxError] = useState<string>();
  const [createdBox, setCreatedBox] = useState<string>();
  const [waiting, setWaiting] = useState(false);

  const creationFeeRead = useReadContract({ address: factory, abi: boxFactoryAbi, functionName: "creationFee", query: { staleTime: 60_000 } });
  const ownerRead = useReadContract({ address: factory, abi: boxFactoryAbi, functionName: "owner", query: { staleTime: 60_000 } });
  const creationFee = creationFeeRead.data as bigint | undefined;
  const isOwner = !!address && !!ownerRead.data && (ownerRead.data as string).toLowerCase() === address.toLowerCase();

  const feeds = useMemo(() => selectableFeeds(), []);
  const totalBps = selected.reduce((sum, s) => sum + s.weightBps, 0);
  const weightsValid = selected.length >= 1 && totalBps === BPS_TOTAL && selected.every((s) => s.weightBps > 0);
  const namesValid = boxName.trim().length >= 2 && /^[A-Za-z0-9]{2,10}$/.test(boxSymbol.trim());

  function toggleFeed(feed: FeedEntry) {
    setSelected((prev) => {
      const without = prev.filter((s) => s.feed.symbol !== feed.symbol);
      const next = without.length === prev.length ? [...prev, { feed, weightBps: 0 }] : without;
      // Auto-equal-weight on every membership change; users can fine-tune after.
      const even = Math.floor(BPS_TOTAL / (next.length || 1));
      return next.map((s, i) => ({ ...s, weightBps: i === next.length - 1 ? BPS_TOTAL - even * (next.length - 1) : even }));
    });
  }

  function setWeight(symbol: string, weightBps: number) {
    setSelected((prev) => prev.map((s) => (s.feed.symbol === symbol ? { ...s, weightBps: Math.max(0, Math.min(BPS_TOTAL, Math.round(weightBps))) } : s)));
  }

  async function launch() {
    setTxError(undefined);
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!weightsValid) throw new Error("Weights must total exactly 10000 bps.");
      if (!namesValid) throw new Error("Set a box name and a 2-10 char alphanumeric symbol.");
      if (creationFee === undefined) throw new Error("Creation fee not loaded from chain.");
      const components = selected.map((s) => ({
        adapter: s.feed.adapter as Address,
        weightBps: BigInt(s.weightBps),
        maxStaleness: BigInt(s.feed.suggestedStaleness || DEFAULT_STALENESS),
      }));
      // BoxType.Synthetic = 0; backedComponents unused for synthetic boxes.
      // Contract requires exact payment: owner pays 0, everyone else pays creationFee.
      const hash = await writeContractAsync({
        address: factory,
        abi: boxFactoryAbi,
        functionName: "createBoxWithoutCoin",
        args: [boxName.trim(), boxSymbol.trim().toUpperCase(), 0, components, []],
        value: isOwner ? 0n : creationFee,
      });
      setTxHash(hash);
      if (client) {
        setWaiting(true);
        try {
          const rcpt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
          for (const log of rcpt.logs) {
            try {
              const ev = decodeEventLog({ abi: boxFactoryAbi, data: log.data, topics: log.topics });
              if (ev.eventName === "BoxCreated") {
                setCreatedBox((ev.args as { box: string }).box);
                break;
              }
            } catch {
              // not a factory event, skip
            }
          }
        } finally {
          setWaiting(false);
        }
      }
    } catch (error) {
      setTxError(friendlyError(error));
    }
  }

  return (
    <div className="grid gap-6">
      <Panel>
        <SectionLabel>Create a custom box</SectionLabel>
        <h1 className="mt-3 text-4xl font-black text-white">Build your own box</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          Pick components, set weights, and deploy a synthetic box directly on-chain. No creator coin is launched:
          this is the plain box, priced by oracle feeds and backed by ETH collateral. Mint and redeem fees route to
          the protocol (and feed the BENTO burn). Want a coin with fee drip to holders too? Use the{" "}
          <a href="https://pad.bentoetf.com/create" className="text-[#f5a623] underline decoration-[#f5a623]/40 underline-offset-4">Launchpad</a> instead.
        </p>
        <p className="mt-3 font-mono text-xs text-zinc-500">
          creation fee: {creationFee !== undefined ? `${formatEther(creationFee)} ETH` : "loading..."}
          {isOwner ? " (waived for factory owner)" : ""}
        </p>
      </Panel>

      <Panel>
        <SectionLabel>1. Components</SectionLabel>
        <p className="mt-2 text-xs text-zinc-500">Pick one or more. Selecting auto-assigns equal weights; adjust below.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {feeds.map((feed) => {
            const active = selected.some((s) => s.feed.symbol === feed.symbol);
            return (
              <button
                key={feed.symbol}
                onClick={() => toggleFeed(feed)}
                className={`rounded-2xl border px-3 py-2 text-left transition ${active ? "border-[#f5a623]/60 bg-[#f5a623]/10 text-[#faecc9]" : "border-[#f5a623]/15 text-zinc-400 hover:border-[#f5a623]/40"}`}
              >
                <span className="block font-mono text-sm font-semibold">{feed.symbol}</span>
                <span className="block truncate text-[11px] text-zinc-500">{feed.name}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {selected.length > 0 ? (
        <Panel>
          <SectionLabel>2. Weights</SectionLabel>
          <p className="mt-2 text-xs text-zinc-500">Basis points, must total exactly 10000 (100%).</p>
          <div className="mt-4 grid gap-3">
            {selected.map((s) => (
              <div key={s.feed.symbol} className="flex items-center gap-4">
                <span className="w-20 font-mono text-sm text-zinc-200">{s.feed.symbol}</span>
                <input
                  type="number"
                  min={0}
                  max={BPS_TOTAL}
                  value={s.weightBps}
                  onChange={(e) => setWeight(s.feed.symbol, Number(e.target.value))}
                  className="w-32 rounded-xl border border-[#f5a623]/20 bg-black px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#f5a623]/60"
                />
                <span className="font-mono text-xs text-zinc-500">{(s.weightBps / 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <p className={`mt-4 font-mono text-xs ${totalBps === BPS_TOTAL ? "text-emerald-400" : "text-red-400"}`}>
            total: {totalBps} / {BPS_TOTAL} bps
          </p>
        </Panel>
      ) : null}

      {selected.length > 0 ? (
        <Panel>
          <SectionLabel>3. Name</SectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Box name (e.g. AI Infra Box)"
              value={boxName}
              onChange={(e) => setBoxName(e.target.value)}
              className="rounded-xl border border-[#f5a623]/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-[#f5a623]/60"
            />
            <input
              placeholder="Symbol (e.g. AIBOX)"
              value={boxSymbol}
              onChange={(e) => setBoxSymbol(e.target.value.toUpperCase())}
              className="rounded-xl border border-[#f5a623]/20 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-[#f5a623]/60"
            />
          </div>
        </Panel>
      ) : null}

      {selected.length > 0 ? (
        <Panel>
          <SectionLabel>4. Deploy</SectionLabel>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-500">
            One transaction deploys the box token and vault and registers it with the factory. Payment must be exactly
            the creation fee. The box is permissionless to mint and redeem from day one.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={launch}
              disabled={!isConnected || !weightsValid || !namesValid || isPending || waiting}
              className="rounded-2xl bg-[#f5a623] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Confirm in wallet..." : waiting ? "Deploying..." : "Create box"}
            </button>
            {!isConnected ? <span className="text-xs text-zinc-500">connect your wallet (top right) on Robinhood Chain</span> : null}
          </div>
          {txError ? <p className="mt-4 max-w-2xl text-xs leading-5 text-red-400">{txError}</p> : null}
          {txHash && !createdBox ? <p className="mt-4 font-mono text-xs text-zinc-400">tx sent: {txHash}</p> : null}
          {createdBox ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-emerald-300">Box deployed 🍱</p>
              <p className="mt-1 font-mono text-xs text-zinc-300">{createdBox}</p>
              <p className="mt-2 text-xs text-zinc-500">
                View it on the{" "}
                <a href={`https://pad.bentoetf.com/box/${createdBox}`} className="text-[#f5a623] underline underline-offset-4">box page</a>{" "}
                or head back to <Link href="/" className="text-[#f5a623] underline underline-offset-4">Boxes</Link>.
              </p>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
