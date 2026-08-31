import { NextRequest, NextResponse } from "next/server";
import { parseApacheLogs } from "@/lib/parseApacheLogs";
import { parseVercelLogs } from "@/lib/parseVercelLogs";
import { analyze } from "@/lib/analyze";
import { detectBot } from "@/lib/botDetection";
import { isValidAccessToken } from "@/lib/oauth";
import { loadAnalysis } from "@/lib/cache";
import type { LogEntry } from "@/lib/types";

export const maxDuration = 60;

const MAX_LINES = 10_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

function rpc(id: unknown, result: unknown) {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function autoDetectFormat(content: string): "apache" | "vercel" {
  const firstLine = content.split("\n").find((l) => l.trim());
  if (!firstLine) return "apache";
  try {
    JSON.parse(firstLine.trim());
    return "vercel";
  } catch {
    return "apache";
  }
}

function parseLogs(content: string, format: "apache" | "vercel" | "auto"): LogEntry[] {
  const truncated = content.split("\n").slice(0, MAX_LINES).join("\n");
  const fmt = format === "auto" ? autoDetectFormat(truncated) : format;
  return fmt === "vercel" ? parseVercelLogs(truncated) : parseApacheLogs(truncated);
}

const TOOLS = [
  {
    name: "analyze_logs",
    description:
      "Parse and analyze Apache or Vercel NDJSON log content. Returns a full report: request stats, HTTP codes, top bots, URL categories, most crawled pages, and timeline.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Raw log file content (Apache combined format or Vercel NDJSON). Max ~10 000 lines.",
        },
        format: {
          type: "string",
          enum: ["apache", "vercel", "auto"],
          description: "Log format. Default: auto (detected from first line).",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "detect_bot",
    description: "Check if a User-Agent string belongs to a known bot. Returns the bot name, provider, and category, or confirms it is a human visitor.",
    inputSchema: {
      type: "object",
      properties: {
        user_agent: { type: "string", description: "The User-Agent string to check." },
      },
      required: ["user_agent"],
    },
  },
  {
    name: "filter_entries",
    description: "Parse log content and return filtered log entries as a table. Useful for drilling down into specific status codes, bots, or URL patterns.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw log file content (Apache or Vercel NDJSON)." },
        format: {
          type: "string",
          enum: ["apache", "vercel", "auto"],
          description: "Log format. Default: auto.",
        },
        status_code: {
          type: "number",
          description: "Only return entries with this HTTP status code.",
        },
        bot_only: {
          type: "boolean",
          description: "If true, return only bot traffic. If false, return only human traffic.",
        },
        path_contains: {
          type: "string",
          description: "Only return entries whose path contains this substring.",
        },
        limit: {
          type: "number",
          description: "Max entries to return. Default: 50, max: 200.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "get_last_analysis",
    description:
      "Return the full analysis report from the last log file imported via the Log Analyzer UI. No parameters needed — reads the server-side cache. Use this instead of analyze_logs when the user has already uploaded logs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_top_bots",
    description:
      "List the top bots from the last imported log analysis (cached). Optional: filter by category (search_engine, ai_bot, seo_tool…) and set how many to return.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by bot category (e.g. ai_bot, search_engine, seo_tool)." },
        limit: { type: "number", description: "Max bots to return. Default: 15." },
      },
    },
  },
  {
    name: "get_top_pages",
    description:
      "List the most crawled pages from the last imported log analysis (cached). Optional: filter pages whose path contains a substring and set min bot percentage.",
    inputSchema: {
      type: "object",
      properties: {
        path_contains: { type: "string", description: "Only return pages whose path contains this string." },
        min_bot_percent: { type: "number", description: "Only return pages with at least this bot percentage (0-100)." },
        limit: { type: "number", description: "Max pages to return. Default: 20." },
      },
    },
  },
];

// ── Tool handlers ──────────────────────────────────────────────────

function handleGetLastAnalysis(): string {
  const c = loadAnalysis();
  if (!c) {
    return [
      "❌ **No cached analysis found.**",
      "",
      "Upload a log file via the Log Analyzer UI first, then call this tool again.",
      "Alternatively, use `analyze_logs` and pass the raw log content directly.",
    ].join("\n");
  }

  const saved = new Date(c.savedAt).toLocaleString("fr-FR");
  const period = `${new Date(c.period.start).toLocaleString("fr-FR")} → ${new Date(c.period.end).toLocaleString("fr-FR")}`;

  const codeLines = Object.entries(c.httpCodes)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([code, count]) => `  - HTTP ${code}: ${(count as number).toLocaleString()}`)
    .join("\n");

  const topBots = c.bots.slice(0, 8)
    .map((b) => `  - **${b.name}** (${b.category}) — ${b.requests.toLocaleString()} req, ${b.uniqueUrls} unique URLs`)
    .join("\n");

  const topUrls = c.urlCategories.slice(0, 8)
    .map((u) => `  - \`${u.path}\` — ${u.requests.toLocaleString()} req (${u.uniqueUrls} unique, ${u.reqPerDay}/day)`)
    .join("\n");

  const topPages = c.crawledPages.slice(0, 8)
    .map((p) => `  - \`${p.path}\` — ${p.requests} req, **${p.botPercent}%** bots`)
    .join("\n");

  return [
    `## Log Analysis Report _(cached ${saved})_`,
    ``,
    `**Period:** ${period}`,
    `**Hosts:** ${c.hosts.length ? c.hosts.join(", ") : "—"}`,
    ``,
    `### Overview`,
    `- **Total requests:** ${c.totalRequests.toLocaleString()}`,
    `- **Unique URLs:** ${c.uniqueUrls.toLocaleString()}`,
    `- **Distinct bots:** ${c.detectedBots}`,
    `- **Bot traffic:** ${c.botPercent}%`,
    ``,
    `### HTTP Status Codes`,
    codeLines || "  — none",
    ``,
    `### Top Bots`,
    topBots || "  — no bots detected",
    ``,
    `### URL Categories (top segments)`,
    topUrls || "  — none",
    ``,
    `### Most Crawled Pages`,
    topPages || "  — none",
  ].join("\n");
}

function handleGetTopBots(args: Record<string, unknown>): string {
  const c = loadAnalysis();
  if (!c) return "❌ No cached analysis found. Upload logs via the UI first.";

  const category = typeof args.category === "string" ? args.category.toLowerCase() : null;
  const limit = Math.min(typeof args.limit === "number" ? args.limit : 15, 50);

  let bots = c.bots;
  if (category) bots = bots.filter((b) => b.category.toLowerCase().includes(category));
  bots = bots.slice(0, limit);

  if (!bots.length) return `No bots found${category ? ` matching category "${category}"` : ""}.`;

  const header = `**${bots.length} bot(s)**${category ? ` — category: ${category}` : ""}:\n`;
  const rows = bots.map((b, i) =>
    `${i + 1}. **${b.name}** (${b.provider} · ${b.category})` +
    `\n   ${b.requests.toLocaleString()} req · ${b.uniqueUrls} unique URLs` +
    `\n   First: ${new Date(b.firstSeen).toLocaleDateString("fr-FR")} · Last: ${new Date(b.lastSeen).toLocaleDateString("fr-FR")}`
  );
  return header + rows.join("\n");
}

function handleGetTopPages(args: Record<string, unknown>): string {
  const c = loadAnalysis();
  if (!c) return "❌ No cached analysis found. Upload logs via the UI first.";

  const pathFilter = typeof args.path_contains === "string" ? args.path_contains.toLowerCase() : null;
  const minBot = typeof args.min_bot_percent === "number" ? args.min_bot_percent : 0;
  const limit = Math.min(typeof args.limit === "number" ? args.limit : 20, 100);

  let pages = c.crawledPages;
  if (pathFilter) pages = pages.filter((p) => p.path.toLowerCase().includes(pathFilter));
  if (minBot > 0) pages = pages.filter((p) => p.botPercent >= minBot);
  pages = pages.slice(0, limit);

  if (!pages.length) return "No pages match the given filters.";

  const header = `**${pages.length} page(s)**:\n`;
  const rows = pages.map((p, i) =>
    `${i + 1}. \`${p.path}\`` +
    `\n   ${p.requests} req total · **${p.botPercent}%** bots (${p.bots} bot req)` +
    `\n   Last seen: ${new Date(p.lastSeen).toLocaleDateString("fr-FR")}`
  );
  return header + rows.join("\n");
}

function handleDetectBot(args: Record<string, unknown>): string {
  const ua = (args.user_agent as string)?.trim();
  if (!ua) return "❌ user_agent is required.";
  const bot = detectBot(ua);
  if (!bot) return `✅ **Human visitor** — no known bot signature matched.\n\`${ua.slice(0, 120)}\``;
  return [
    `🤖 **Bot detected**`,
    `**Name:** ${bot.name}`,
    `**Provider:** ${bot.provider}`,
    `**Category:** ${bot.category}`,
    `**User-Agent:** \`${ua.slice(0, 120)}\``,
  ].join("\n");
}

function handleAnalyzeLogs(args: Record<string, unknown>): string {
  const content = (args.content as string) ?? "";
  if (!content.trim()) return "❌ content is required.";

  const format = (args.format as "apache" | "vercel" | "auto") ?? "auto";
  const entries = parseLogs(content, format);

  if (!entries.length) {
    return "❌ No valid log entries found. Check the format (apache / vercel) and content.";
  }

  const result = analyze(entries);

  const period = `${result.period.start.toLocaleString("en-US")} → ${result.period.end.toLocaleString("en-US")}`;
  const botPercent = result.totalRequests > 0
    ? Math.round((result.entries.filter((e) => detectBot(e.userAgent)).length / result.totalRequests) * 100)
    : 0;

  const codeLines = Object.entries(result.httpCodes)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([code, count]) => `  - HTTP ${code}: ${(count as number).toLocaleString()}`)
    .join("\n");

  const topBots = result.bots.slice(0, 8)
    .map((b) => `  - **${b.name}** (${b.category}) — ${b.requests.toLocaleString()} req, ${b.uniqueUrls.size} unique URLs`)
    .join("\n");

  const topUrls = result.urlCategories.slice(0, 8)
    .map((u) => `  - \`${u.path}\` — ${u.requests.toLocaleString()} req (${u.uniqueUrls} unique, ${u.reqPerDay}/day)`)
    .join("\n");

  const topPages = result.crawledPages.slice(0, 8)
    .map((p) => `  - \`${p.path}\` — ${p.requests} req, **${p.botPercent}%** bots`)
    .join("\n");

  const lines = [
    `## Log Analysis Report`,
    ``,
    `**Period:** ${period}`,
    `**Format detected:** ${format === "auto" ? autoDetectFormat(content) : format}`,
    `**Lines parsed:** ${entries.length.toLocaleString()} (input capped at ${MAX_LINES.toLocaleString()})`,
    ``,
    `### Overview`,
    `- **Total requests:** ${result.totalRequests.toLocaleString()}`,
    `- **Unique URLs:** ${result.uniqueUrls.toLocaleString()}`,
    `- **Distinct bots:** ${result.detectedBots}`,
    `- **Bot traffic:** ${botPercent}%`,
    `- **Hosts:** ${result.hosts.length > 0 ? result.hosts.join(", ") : "—"}`,
    ``,
    `### HTTP Status Codes`,
    codeLines || "  — none",
    ``,
    `### Top Bots`,
    topBots || "  — no bots detected",
    ``,
    `### URL Categories (top segments)`,
    topUrls || "  — none",
    ``,
    `### Most Crawled Pages`,
    topPages || "  — none",
  ];

  return lines.join("\n");
}

function handleFilterEntries(args: Record<string, unknown>): string {
  const content = (args.content as string) ?? "";
  if (!content.trim()) return "❌ content is required.";

  const format = (args.format as "apache" | "vercel" | "auto") ?? "auto";
  let entries = parseLogs(content, format);

  if (!entries.length) return "❌ No valid log entries found.";

  if (typeof args.status_code === "number") {
    entries = entries.filter((e) => e.statusCode === args.status_code);
  }

  if (typeof args.bot_only === "boolean") {
    entries = entries.filter((e) => {
      const isBot = !!detectBot(e.userAgent);
      return args.bot_only ? isBot : !isBot;
    });
  }

  if (typeof args.path_contains === "string" && args.path_contains) {
    const q = (args.path_contains as string).toLowerCase();
    entries = entries.filter((e) => e.path.toLowerCase().includes(q));
  }

  const limit = Math.min(typeof args.limit === "number" ? args.limit : 50, 200);
  const slice = entries.slice(0, limit);

  if (!slice.length) return "No entries match the given filters.";

  const header = `**${entries.length} matching entries** (showing ${slice.length}):\n`;
  const rows = slice.map((e) => {
    const bot = detectBot(e.userAgent);
    const botLabel = bot ? ` [${bot.name}]` : "";
    const ts = e.timestamp.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `- \`${ts}\` **${e.statusCode}** ${e.method} \`${e.path}\`${botLabel}`;
  });

  return header + rows.join("\n");
}

// ── HTTP handlers ──────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return json({ status: "ok", server: "log-analyzer-mcp", version: "1.0.0" });
}

export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token || !isValidAccessToken(token)) {
    const base = `https://${req.headers.get("host") ?? ""}`;
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }),
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }

  let body: { jsonrpc: string; method: string; params?: Record<string, unknown>; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { method, params, id } = body;

  if (method === "initialize") {
    return rpc(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "log-analyzer", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === "tools/list") {
    return rpc(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const name = params?.name as string;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    try {
      let result = "";
      if (name === "analyze_logs")         result = handleAnalyzeLogs(args);
      else if (name === "detect_bot")       result = handleDetectBot(args);
      else if (name === "filter_entries")   result = handleFilterEntries(args);
      else if (name === "get_last_analysis") result = handleGetLastAnalysis();
      else if (name === "get_top_bots")     result = handleGetTopBots(args);
      else if (name === "get_top_pages")    result = handleGetTopPages(args);
      else return rpc(id, { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
      return rpc(id, { content: [{ type: "text", text: result }] });
    } catch (err) {
      return rpc(id, {
        content: [{ type: "text", text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      });
    }
  }

  if (!id) return new Response(null, { status: 202, headers: CORS_HEADERS });

  return rpcError(id, -32601, `Method not found: ${method}`);
}
