// api/mcp.js — public MCP server (Streamable HTTP, stateless) at
// https://blueprint.realstack.app/mcp (vercel.json rewrites /mcp here).
//
// Connected in ChatGPT (developer mode → App Directory later) and in Claude as
// a custom connector. Exposes Blueprint's own calculators plus the
// open_in_blueprint handoff link — see src/lib/mcpTools.js for the tools.
//
// HARD RULE: no PricePoint / RentCast / Redfin / Mapbox / Ops data here. Do
// not import _rapid, _budget, _enrich, _address, sold-comps, pricepoint or any
// PricePoint module. Their terms and quotas don't allow re-serving the data.
//
// A new server + transport per request (stateless). The per-IP limit is
// generous because ChatGPT and Claude call from shared egress IPs — every user
// of a platform lands in one bucket. The real cost control is the handoff cap
// in _handoffs.js; the calculators are pure CPU.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { rateLimited } from './_ratelimit.js';
import { saveHandoff, detectClient, ipHash } from './_handoffs.js';
import { TOOLS } from '../src/lib/mcpTools.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
    return;
  }
  if (rateLimited(req, res, { limit: 300 })) return;

  const client = detectClient(req);
  const ctx = { saveHandoff: (row) => saveHandoff(row, { client, ipHash: ipHash(req) }) };
  const server = new McpServer(
    { name: 'mortgage-blueprint', title: 'Mortgage Blueprint', version: '1.0.0', websiteUrl: 'https://blueprint.realstack.app' },
    { instructions: 'Mortgage calculators from Mortgage Blueprint. Every interest rate must come from the user: ask for one they were quoted or want to test, and never invent or look one up. Results are educational estimates; always show the disclosure that comes with each result.' },
  );
  for (const t of TOOLS) server.registerTool(t.name, t.config, (args) => t.handler(args, ctx));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error.' }, id: null });
  }
}
