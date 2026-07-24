import { NextResponse } from "next/server";
import { createPublicClient, formatUnits, http } from "viem";
import {
  ALL_BOXES,
  PLACEHOLDER_ADDRESS,
  boxEngineAbi,
  contracts,
  erc20Abi,
  hasDeployAddresses,
  robinhood,
  syntheticBoxAbi,
  type BoxInfo,
} from "@/config/contracts";

export const revalidate = 30;

const client = createPublicClient({ chain: robinhood, transport: http(robinhood.rpcUrls.default.http[0]) });

function isZero(addr: string) {
  return addr.toLowerCase() === PLACEHOLDER_ADDRESS;
}

function baseInfo(box: BoxInfo) {
  return {
    symbol: box.symbol,
    name: box.name,
    kind: box.kind,
    boxType: box.boxType,
    description: box.description,
    token: isZero(box.token) ? null : box.token,
    zapper: isZero(box.zapper) ? null : box.zapper,
    components: box.components.map((c) => ({
      symbol: c.symbol,
      name: c.name,
      token: isZero(c.token) ? null : c.token,
      feed: c.feed,
      weightBps: Number(c.weightBps),
    })),
  };
}

async function engineBox(box: BoxInfo) {
  const info = baseInfo(box);
  if (isZero(box.token) || !hasDeployAddresses()) {
    return { ...info, status: "launching-soon", boxId: Number(box.id) };
  }
  const [nav, backing, supply, boxData] = await Promise.all([
    client.readContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "navUsdPerBox", args: [box.id] }) as Promise<bigint>,
    client.readContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "backingDetailed", args: [box.id] }) as Promise<readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[], readonly bigint[]]>,
    client.readContract({ address: box.token, abi: erc20Abi, functionName: "totalSupply" }) as Promise<bigint>,
    client.readContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "boxes", args: [box.id] }) as Promise<readonly unknown[]>,
  ]);
  const tvlUsd1e18 = backing[3].reduce((sum, v) => sum + v, 0n);
  return {
    ...info,
    status: "live",
    boxId: Number(box.id),
    engine: contracts.boxEngine,
    navUsd: formatUnits(nav, 18),
    tvlUsd: formatUnits(tvlUsd1e18, 18),
    supply: formatUnits(supply, 18),
    backing: backing[0].map((token, i) => ({
      token,
      balance: formatUnits(backing[1][i], 18),
      valueUsd: formatUnits(backing[3][i], 18),
    })),
    raw: { boxData: serialize(boxData) },
  };
}

async function syntheticBox(box: BoxInfo) {
  const info = baseInfo(box);
  if (isZero(box.token)) {
    return { ...info, status: "launching-soon" };
  }
  const [nav, supply, collateral, mintFee, redeemFee, paused] = await Promise.all([
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "navPerShare" }) as Promise<bigint>,
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "totalSupply" }) as Promise<bigint>,
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "totalCollateral" }) as Promise<bigint>,
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "mintFeeBps" }) as Promise<bigint>,
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "redeemFeeBps" }) as Promise<bigint>,
    client.readContract({ address: box.token, abi: syntheticBoxAbi, functionName: "paused" }) as Promise<boolean>,
  ]);
  return {
    ...info,
    status: paused ? "paused" : "live",
    vault: box.token,
    navUsdPerShare: formatUnits(nav, 8),
    supply: formatUnits(supply, 18),
    collateralEth: formatUnits(collateral, 18),
    mintFeeBps: Number(mintFee),
    redeemFeeBps: Number(redeemFee),
  };
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

export async function GET() {
  try {
    const boxes = await Promise.all(
      ALL_BOXES.map(async (box) => {
        try {
          return box.kind === "engine" ? await engineBox(box) : await syntheticBox(box);
        } catch (error) {
          return {
            ...baseInfo(box),
            status: "error",
            error: error instanceof Error ? error.message.slice(0, 160) : "read failed",
          };
        }
      }),
    );
    return NextResponse.json(
      {
        chainId: robinhood.id,
        rpc: robinhood.rpcUrls.default.http[0],
        engine: contracts.boxEngine,
        boxes,
        updatedAt: new Date().toISOString(),
      },
      { headers: cors() },
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message.slice(0, 200) : "read failed" },
      { status: 502, headers: cors() },
    );
  }
}

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=30, s-maxage=30" };
}
