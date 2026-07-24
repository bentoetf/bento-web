import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const BASE = "https://bentoetf.com";

async function fetchBoxes() {
  const res = await fetch(`${BASE}/api/boxes`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`api/boxes returned ${res.status}`);
  return res.json();
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "list_boxes",
      "List all Bento boxes on Robinhood Chain with live NAV, TVL, composition, fees, status, and contract addresses.",
      {},
      async () => text(await fetchBoxes()),
    );

    server.tool(
      "get_box",
      "Get one Bento box by symbol (e.g. MAG7, AI3, SEMI6, CRYPTOEQ, SPYQQQ, ELON) with live NAV, TVL, composition, and addresses.",
      { symbol: z.string().describe("Box symbol, e.g. MAG7") },
      async ({ symbol }) => {
        const data = await fetchBoxes();
        const box = data.boxes?.find((b: { symbol: string }) => b.symbol.toLowerCase() === symbol.toLowerCase());
        if (!box) return text({ error: `unknown box ${symbol}`, known: data.boxes?.map((b: { symbol: string }) => b.symbol) });
        return text(box);
      },
    );

    server.tool(
      "how_to_trade",
      "Explain how an agent can mint or redeem Bento boxes on-chain: chain, contracts, and call patterns.",
      {},
      async () => {
        const data = await fetchBoxes();
        return text({
          chainId: data.chainId,
          rpc: data.rpc,
          explorer: "https://robinhoodchain.blockscout.com",
          engineBoxes: {
            engine: data.engine,
            mint: "BoxEngine.mintWithETH{value: ethIn}(boxId, minBoxOut, recipient) or mint with USDG via the box zapper (zapUSDG). Quote first with quoteMintETH(boxId, ethIn).",
            redeem: "Approve box token to engine, then BoxEngine.redeemForETH(boxId, boxIn, minEthOut, componentMins, recipient) or redeemForStocks(boxId, boxIn, recipient).",
            backing: "1:1 backed: vault holds the underlying tokenized stocks; verify with backingDetailed(boxId).",
          },
          syntheticBoxes: {
            mint: "vault.mint{value: ethIn}() returns shares; preview with previewMint(ethIn).",
            redeem: "vault.redeem(shares) returns ETH; preview with previewRedeem(shares).",
            backing: "ETH-collateralized, oracle-priced. NAV via navPerShare() (8 decimals, genesis $100).",
          },
          boxes: data.boxes?.map((b: { symbol: string; status: string; token?: string | null; vault?: string }) => ({
            symbol: b.symbol,
            status: b.status,
            address: b.token ?? b.vault ?? null,
          })),
        });
      },
    );
  },
  {},
  { basePath: "/api/mcp" },
);

export { handler as GET, handler as POST };
