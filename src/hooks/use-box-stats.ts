"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { boxEngineAbi, contracts, feedAbi, robinhood, type BoxInfo } from "@/config/contracts";

type Round = { roundId: bigint; answer: bigint; updatedAt: bigint };

const DAY_SECONDS = 86_400n;
const MAX_LINEAR_BATCH = 24;
const EXPONENTIAL_STEPS = [1n, 2n, 4n, 8n, 16n, 32n, 64n, 128n, 256n, 512n, 1024n];

// Module-level cache so the change is computed once per page load per box.
const changeCache = new Map<string, number | null>();
const inflight = new Map<string, Promise<number | null>>();

const SERIES_POINTS = 12;
const seriesCache = new Map<string, number[] | null>();
const seriesInflight = new Map<string, Promise<number[] | null>>();

function toRound(result: unknown): Round | undefined {
  const r = result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  if (!r || r[1] <= 0n || r[3] === 0n) return undefined;
  return { roundId: r[0], answer: r[1], updatedAt: r[3] };
}

async function fetchRounds(client: NonNullable<ReturnType<typeof usePublicClient>>, feed: `0x${string}`, roundIds: bigint[]): Promise<(Round | undefined)[]> {
  const results = await client.multicall({
    contracts: roundIds.map((id) => ({ address: feed, abi: feedAbi, functionName: "getRoundData", args: [id] } as const)),
    allowFailure: true,
  });
  return results.map((r) => (r.status === "success" ? toRound(r.result) : undefined));
}

// Find the feed price roughly 24h before `now` by walking round ids back from the latest round.
async function priceAgo(client: NonNullable<ReturnType<typeof usePublicClient>>, feed: `0x${string}`, latest: Round, target: bigint): Promise<bigint | undefined> {
  if (latest.updatedAt <= target) return latest.answer;
  // Exponential probe backwards to bracket the target timestamp.
  const probeIds = EXPONENTIAL_STEPS.map((s) => latest.roundId - s).filter((id) => id > 0n);
  const probes = await fetchRounds(client, feed, probeIds);
  let below: Round | undefined;
  let aboveId = latest.roundId;
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    if (!p) continue;
    if (p.updatedAt <= target) { below = p; break; }
    aboveId = p.roundId;
  }
  if (!below) return undefined;
  // Linear refine between the bracket if the gap is small enough; otherwise the probe answer is close enough.
  const gap = aboveId - below.roundId;
  if (gap > 1n && gap <= BigInt(MAX_LINEAR_BATCH)) {
    const ids: bigint[] = [];
    for (let id = below.roundId + 1n; id < aboveId; id++) ids.push(id);
    const fill = await fetchRounds(client, feed, ids);
    let best = below;
    for (const r of fill) {
      if (r && r.updatedAt <= target && r.updatedAt > best.updatedAt) best = r;
    }
    return best.answer;
  }
  return below.answer;
}

// Locate the round whose updatedAt is closest to (but not after) `target`, walking back from latest.
// Returns undefined when the feed history does not reach that far back.
async function roundAtOrBefore(client: NonNullable<ReturnType<typeof usePublicClient>>, feed: `0x${string}`, latest: Round, target: bigint): Promise<Round | undefined> {
  if (latest.updatedAt <= target) return latest;
  const probeIds = EXPONENTIAL_STEPS.map((s) => latest.roundId - s).filter((id) => id > 0n);
  const probes = await fetchRounds(client, feed, probeIds);
  let below: Round | undefined;
  for (const p of probes) {
    if (!p) continue;
    if (p.updatedAt <= target) { below = p; break; }
  }
  return below;
}

// Build a per-feed price series: sample rounds evenly between the round ~24h ago and the latest,
// then return (updatedAt, answer) pairs sorted by time.
async function feedSeries(client: NonNullable<ReturnType<typeof usePublicClient>>, feed: `0x${string}`, latest: Round, target: bigint): Promise<Round[] | undefined> {
  const start = await roundAtOrBefore(client, feed, latest, target);
  if (!start) return undefined;
  const span = latest.roundId - start.roundId;
  const ids: bigint[] = [];
  if (span <= BigInt(SERIES_POINTS)) {
    for (let id = start.roundId; id <= latest.roundId; id++) ids.push(id);
  } else {
    for (let k = 0; k < SERIES_POINTS; k++) ids.push(start.roundId + (span * BigInt(k)) / BigInt(SERIES_POINTS - 1));
  }
  const rounds = (await fetchRounds(client, feed, ids)).filter((r): r is Round => r !== undefined);
  if (rounds.length < 2) return undefined;
  rounds.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
  return rounds;
}

// Weighted box-level NAV index over the last 24h. Each component series is normalized to its
// first sample so the result is a relative index; the sparkline only needs the shape.
async function computeBoxSeries(client: NonNullable<ReturnType<typeof usePublicClient>>, box: BoxInfo): Promise<number[] | null> {
  try {
    const latestResults = await client.multicall({
      contracts: box.components.map((c) => ({ address: c.feed, abi: feedAbi, functionName: "latestRoundData" } as const)),
      allowFailure: true,
    });
    const now = BigInt(Math.floor(Date.now() / 1000));
    const target = now - DAY_SECONDS;
    const perFeed: { series: Round[]; weight: number }[] = [];
    for (let i = 0; i < box.components.length; i++) {
      const res = latestResults[i];
      const latest = res.status === "success" ? toRound(res.result) : undefined;
      if (!latest) continue;
      const series = await feedSeries(client, box.components[i].feed, latest, target);
      if (!series) continue;
      perFeed.push({ series, weight: Number(box.components[i].weightBps) / 10_000 });
    }
    const covered = perFeed.reduce((s, f) => s + f.weight, 0);
    if (covered < 0.5) return null;
    // Common sample timestamps across the window; per feed take the most recent round at or before t.
    const points: number[] = [];
    for (let k = 0; k < SERIES_POINTS; k++) {
      const t = target + ((now - target) * BigInt(k)) / BigInt(SERIES_POINTS - 1);
      let value = 0;
      for (const f of perFeed) {
        let pick = f.series[0];
        for (const r of f.series) { if (r.updatedAt <= t) pick = r; else break; }
        const base = Number(f.series[0].answer);
        if (base <= 0) continue;
        value += (Number(pick.answer) / base) * (f.weight / covered);
      }
      points.push(value);
    }
    return points;
  } catch {
    return null;
  }
}

/// Relative NAV index series over the last ~24h for the sparkline. Undefined while loading, null when unavailable.
export function useBoxNavSeries(box: BoxInfo, enabled: boolean): number[] | null | undefined {
  const client = usePublicClient({ chainId: robinhood.id });
  const [value, setValue] = useState<number[] | null | undefined>(() => seriesCache.get(box.symbol));

  useEffect(() => {
    if (!enabled || !client) return;
    const cached = seriesCache.get(box.symbol);
    if (cached !== undefined) { setValue(cached); return; }
    let cancelled = false;
    let promise = seriesInflight.get(box.symbol);
    if (!promise) {
      promise = computeBoxSeries(client, box).then((result) => {
        seriesCache.set(box.symbol, result);
        seriesInflight.delete(box.symbol);
        return result;
      });
      seriesInflight.set(box.symbol, promise);
    }
    promise.then((result) => { if (!cancelled) setValue(result); });
    return () => { cancelled = true; };
  }, [box, client, enabled]);

  return value;
}

async function computeBoxChange(client: NonNullable<ReturnType<typeof usePublicClient>>, box: BoxInfo): Promise<number | null> {
  try {
    const latestResults = await client.multicall({
      contracts: box.components.map((c) => ({ address: c.feed, abi: feedAbi, functionName: "latestRoundData" } as const)),
      allowFailure: true,
    });
    const now = BigInt(Math.floor(Date.now() / 1000));
    const target = now - DAY_SECONDS;
    let weighted = 0;
    let weightCovered = 0;
    for (let i = 0; i < box.components.length; i++) {
      const res = latestResults[i];
      const latest = res.status === "success" ? toRound(res.result) : undefined;
      if (!latest) continue;
      const past = await priceAgo(client, box.components[i].feed, latest, target);
      if (past === undefined || past <= 0n) continue;
      const change = Number(latest.answer - past) / Number(past);
      const weight = Number(box.components[i].weightBps) / 10_000;
      weighted += change * weight;
      weightCovered += weight;
    }
    if (weightCovered < 0.5) return null;
    return (weighted / weightCovered) * 100;
  } catch {
    return null;
  }
}

/// 24h box-level change in percent (weighted component feed changes). Undefined while loading, null when unavailable.
export function useBox24hChange(box: BoxInfo, enabled: boolean): number | null | undefined {
  const client = usePublicClient({ chainId: robinhood.id });
  const [value, setValue] = useState<number | null | undefined>(() => changeCache.get(box.symbol));

  useEffect(() => {
    if (!enabled || !client) return;
    const cached = changeCache.get(box.symbol);
    if (cached !== undefined) { setValue(cached); return; }
    let cancelled = false;
    let promise = inflight.get(box.symbol);
    if (!promise) {
      promise = computeBoxChange(client, box).then((result) => {
        changeCache.set(box.symbol, result);
        inflight.delete(box.symbol);
        return result;
      });
      inflight.set(box.symbol, promise);
    }
    promise.then((result) => { if (!cancelled) setValue(result); });
    return () => { cancelled = true; };
  }, [box, client, enabled]);

  return value;
}

export function formatChangePercent(change: number | null | undefined): string {
  if (change === null || change === undefined) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

/// Theoretical NAV for an empty box: engine mints genesis boxes at GENESIS_BOX_USD per box,
/// so a box with zero supply is worth exactly that until reserves exist. Switches to the
/// on-chain NAV automatically once navUsdPerBox returns a nonzero value.
export function useDisplayNav(box: BoxInfo, enabled: boolean): bigint | undefined {
  const navRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "navUsdPerBox", args: [box.id], query: { enabled } });
  const genesisRead = useReadContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "GENESIS_BOX_USD", query: { enabled } });
  const nav = navRead.data as bigint | undefined;
  if (nav !== undefined && nav > 0n) return nav;
  const genesis = genesisRead.data as bigint | undefined;
  if (nav === 0n && genesis !== undefined) return genesis;
  return nav;
}
