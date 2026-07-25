import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For AI Agents | Bento",
  description:
    "Connect an AI agent to Bento. Open JSON API and MCP server for live box NAVs, compositions, and mint/redeem instructions on Robinhood Chain.",
};

const MCP_URL = "https://bentoetf.com/api/mcp/mcp";
const API_URL = "https://bentoetf.com/api/boxes";

const mcpConfig = `{
  "mcpServers": {
    "bento": {
      "url": "${MCP_URL}"
    }
  }
}`;

const curlExample = `curl ${API_URL}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-2xl border border-[#f5a623]/15 bg-black/40 p-4 font-mono text-xs leading-5 text-zinc-300">
      {children}
    </pre>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f5a623]">{children}</p>;
}

export default function AgentsPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-[#f5a623]/15 bg-[#111]/80 p-7 sm:p-10">
        <Label>Agent access</Label>
        <h1 className="mt-2 text-4xl font-black text-white">Bento for AI agents</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Bento boxes are baskets of tokenized stocks on Robinhood Chain. Everything an agent needs to
          read, analyze, and trade them is exposed through an open JSON API and an MCP server. No API
          key, no signup.
        </p>

        <div className="mt-8">
          <Label>1 · MCP server</Label>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Streamable-HTTP MCP endpoint. Add it to any MCP-capable client (Claude, Cursor, custom
            agents) with one config entry:
          </p>
          <Code>{mcpConfig}</Code>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Tools: <span className="font-mono text-zinc-200">list_boxes</span> (all boxes with live NAV,
            TVL, composition, fees),{" "}
            <span className="font-mono text-zinc-200">get_box</span> (one box by symbol),{" "}
            <span className="font-mono text-zinc-200">how_to_trade</span> (chain, contract addresses,
            mint/redeem call patterns).
          </p>
        </div>

        <div className="mt-8">
          <Label>2 · JSON API</Label>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Prefer plain HTTP? The same data is one GET away, CORS-open, cached 30s:
          </p>
          <Code>{curlExample}</Code>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Returns every box with status, NAV, TVL, supply, component weights, token and zapper
            addresses, and on-chain backing detail for 1:1 backed boxes.
          </p>
        </div>

        <div className="mt-8">
          <Label>3 · Trade on-chain</Label>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Agents sign their own transactions. Robinhood Chain (id 4663), RPC{" "}
            <span className="font-mono text-zinc-200">rpc.mainnet.chain.robinhood.com</span>. Backed
            boxes mint/redeem through the BoxEngine; synthetic boxes mint/redeem in ETH at oracle NAV
            directly on the vault. The <span className="font-mono text-zinc-200">how_to_trade</span> MCP
            tool returns the exact contracts and call patterns, and reserves are verifiable on-chain.
          </p>
        </div>

        <p className="mt-10 text-xs leading-5 text-zinc-600">
          Bento is unaudited. This page is information, not investment advice. Agents and their
          operators are responsible for their own transactions.
        </p>
      </div>
    </section>
  );
}
