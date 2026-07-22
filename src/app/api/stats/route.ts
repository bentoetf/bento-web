import { NextResponse } from "next/server";
import { createPublicClient, formatUnits, http } from "viem";
import { boxEngineAbi, contracts, erc20Abi, hasBentoAddresses, hasDeployAddresses, robinhood } from "@/config/contracts";

export const revalidate = 30;

const client = createPublicClient({ chain: robinhood, transport: http(robinhood.rpcUrls.default.http[0]) });

const BENTO_INITIAL_SUPPLY = 1_000_000_000n * 10n ** 18n;

export async function GET() {
  if (!hasDeployAddresses()) {
    return NextResponse.json({ status: "pre-launch", deployed: false }, { headers: cors() });
  }
  try {
    const boxId = contracts.boxId;
    const [nav, backing, boxSupply] = await Promise.all([
      client.readContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "navUsdPerBox", args: [boxId] }) as Promise<bigint>,
      client.readContract({ address: contracts.boxEngine, abi: boxEngineAbi, functionName: "backingDetailed", args: [boxId] }) as Promise<readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[], readonly bigint[]]>,
      client.readContract({ address: contracts.mag7BoxToken, abi: erc20Abi, functionName: "totalSupply" }) as Promise<bigint>,
    ]);
    const tvlUsd1e18 = backing[3].reduce((sum, v) => sum + v, 0n);

    let bentoBurned: string | null = null;
    if (hasBentoAddresses()) {
      try {
        const bentoSupply = (await client.readContract({ address: contracts.bentoToken, abi: erc20Abi, functionName: "totalSupply" })) as bigint;
        const burned = bentoSupply < BENTO_INITIAL_SUPPLY ? BENTO_INITIAL_SUPPLY - bentoSupply : 0n;
        bentoBurned = formatUnits(burned, 18);
      } catch {
        bentoBurned = null;
      }
    }

    return NextResponse.json(
      {
        status: "live",
        deployed: true,
        chainId: robinhood.id,
        boxes: [
          {
            boxId: Number(boxId),
            symbol: "MAG7",
            navUsd: formatUnits(nav, 18),
            tvlUsd: formatUnits(tvlUsd1e18, 18),
            supply: formatUnits(boxSupply, 18),
            components: backing[0].map((token, i) => ({
              token,
              balance: formatUnits(backing[1][i], 18),
              valueUsd: formatUnits(backing[3][i], 18),
            })),
          },
        ],
        bento: { burned: bentoBurned },
        updatedAt: new Date().toISOString(),
      },
      { headers: cors() },
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", deployed: true, error: error instanceof Error ? error.message.slice(0, 200) : "read failed" },
      { status: 502, headers: cors() },
    );
  }
}

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=30, s-maxage=30" };
}
