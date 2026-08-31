"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Globe,
  Bot,
  Link2,
  Activity,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import clsx from "clsx";

interface AnalysisData {
  period: { start: string; end: string };
  hosts: string[];
  totalRequests: number;
  uniqueUrls: number;
  detectedBots: number;
  httpCodes: Record<string, number>;
  bots: {
    name: string;
    provider: string;
    category: string;
    requests: number;
    uniqueUrls: number;
    firstSeen: string;
    lastSeen: string;
    statusCodes: Record<string, number>;
  }[];
  urlCategories: {
    path: string;
    requests: number;
    uniqueUrls: number;
    reqPerDay: number;
  }[];
  crawledPages: {
    path: string;
    requests: number;
    botPercent: number;
    bots: number;
    lastSeen: string;
  }[];
  timelineData: {
    date: string;
    users: number;
    searchEngines: number;
    aiBots: number;
    others: number;
    total: number;
  }[];
  entries: {
    timestamp: string;
    ip: string;
    method: string;
    path: string;
    statusCode: number;
    size: number | null;
    userAgent: string;
    host?: string;
    source?: string;
  }[];
}

interface DashboardProps {
  data: AnalysisData;
  section: string;
  onReset: () => void;
}

const HTTP_COLORS: Record<number, string> = {
  200: "bg-emerald-100 text-emerald-800",
  201: "bg-emerald-100 text-emerald-800",
  204: "bg-teal-100 text-teal-700",
  206: "bg-cyan-100 text-cyan-700",
  301: "bg-amber-100 text-amber-800",
  302: "bg-amber-100 text-amber-700",
  304: "bg-gray-100 text-gray-600",
  307: "bg-orange-100 text-orange-700",
  400: "bg-red-100 text-red-700",
  401: "bg-red-100 text-red-700",
  403: "bg-red-100 text-red-800",
  404: "bg-rose-100 text-rose-800",
  500: "bg-red-200 text-red-900",
  503: "bg-red-200 text-red-900",
};

function statusColor(code: number) {
  return (
    HTTP_COLORS[code] ??
    (code < 300 ? "bg-green-100 text-green-700" :
     code < 400 ? "bg-amber-100 text-amber-700" :
     "bg-red-100 text-red-700")
  );
}

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function usePagination<T>(items: T[], rowsPerPage: number) {
  const [page, setPage] = useState(1);
  const total = Math.ceil(items.length / rowsPerPage);
  const slice = items.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return { slice, page, total, setPage };
}

export default function Dashboard({ data, section, onReset }: DashboardProps) {
  const [botFilter, setBotFilter] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const start = new Date(data.period.start);
  const end = new Date(data.period.end);

  const sortedCodes = Object.entries(data.httpCodes)
    .map(([k, v]) => ({ code: parseInt(k), count: v }))
    .sort((a, b) => b.count - a.count);

  const filteredEntries = useMemo(() => {
    return data.entries.filter((e) => {
      if (codeFilter && e.statusCode !== codeFilter) return false;
      if (searchQuery && !e.path.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [data.entries, codeFilter, searchQuery]);

  const botPagination = usePagination(data.bots, 20);
  const urlPagination = usePagination(
    searchQuery
      ? data.urlCategories.filter((u) => u.path.toLowerCase().includes(searchQuery))
      : data.urlCategories,
    15
  );
  const pagesPagination = usePagination(data.crawledPages, 20);
  const entriesPagination = usePagination(filteredEntries, 20);

  const categoryColors: Record<string, string> = {
    "Search engines": "#3b82f6",
    "AI bots": "#8b5cf6",
    "Social": "#ec4899",
    "Others": "#6b7280",
    "Users": "#10b981",
  };

  return (
    <div className="ml-56 min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {section === "global" && "Global View"}
            {section === "bots" && "Bot Activity"}
            {section === "urls" && "URL Categories"}
            {section === "pages" && "Crawled Pages"}
            {section === "entries" && "Log Entries"}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {fmtDate(data.period.start)} → {fmtDate(data.period.end)} ·{" "}
            {data.hosts.length > 0 ? data.hosts.join(", ") : "Multiple sources"}
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw size={14} />
          New import
        </button>
      </header>

      <main className="p-6 space-y-6">

        {/* === GLOBAL VIEW === */}
        {section === "global" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Activity size={18} className="text-blue-500" />} label="Requests" value={data.totalRequests.toLocaleString()} />
              <StatCard icon={<Link2 size={18} className="text-purple-500" />} label="Unique URLs" value={data.uniqueUrls.toLocaleString()} />
              <StatCard icon={<Bot size={18} className="text-orange-500" />} label="Detected bots" value={data.detectedBots.toLocaleString()} />
              <StatCard icon={<Globe size={18} className="text-green-500" />} label="Sources" value={data.hosts.length.toString()} />
            </div>

            {/* HTTP Codes */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">HTTP codes</h3>
              <div className="flex flex-wrap gap-3">
                {sortedCodes.map(({ code, count }) => (
                  <button
                    key={code}
                    onClick={() => setCodeFilter(codeFilter === code ? null : code)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                      codeFilter === code
                        ? "ring-2 ring-blue-500 border-blue-300"
                        : "border-gray-200 hover:border-gray-300",
                      statusColor(code)
                    )}
                  >
                    <span className="font-bold">{code}</span>
                    <span className="opacity-70">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Crawl timeline</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.timelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    {["searchEngines", "aiBots", "others", "users"].map((key) => (
                      <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={categoryColors[key === "searchEngines" ? "Search engines" : key === "aiBots" ? "AI bots" : key === "users" ? "Users" : "Others"]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={categoryColors[key === "searchEngines" ? "Search engines" : key === "aiBots" ? "AI bots" : key === "users" ? "Users" : "Others"]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend formatter={(v) => v === "searchEngines" ? "Search engines" : v === "aiBots" ? "AI bots" : v} />
                  <Area type="monotone" dataKey="users" stackId="1" stroke="#10b981" fill="url(#g-users)" name="Users" />
                  <Area type="monotone" dataKey="searchEngines" stackId="1" stroke="#3b82f6" fill="url(#g-searchEngines)" name="searchEngines" />
                  <Area type="monotone" dataKey="aiBots" stackId="1" stroke="#8b5cf6" fill="url(#g-aiBots)" name="aiBots" />
                  <Area type="monotone" dataKey="others" stackId="1" stroke="#6b7280" fill="url(#g-others)" name="Others" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bot summary top 5 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top bots</h3>
              <BotTable bots={data.bots.slice(0, 5)} total={data.totalRequests} compact />
            </div>
          </>
        )}

        {/* === BOT ACTIVITY === */}
        {section === "bots" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Bot activity · {data.bots.length} bots detected
            </h3>
            <BotTable bots={botPagination.slice} total={data.totalRequests} />
            <Pagination
              page={botPagination.page}
              total={botPagination.total}
              onPrev={() => botPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => botPagination.setPage((p) => Math.min(botPagination.total, p + 1))}
              count={data.bots.length}
            />
          </div>
        )}

        {/* === URL CATEGORIES === */}
        {section === "urls" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-gray-700">URL categories</h3>
              <div className="relative ml-auto">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter paths…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">Path</th>
                  <th className="pb-2 pr-4 text-right">Requests</th>
                  <th className="pb-2 pr-4 text-right">URLs</th>
                  <th className="pb-2 text-right">Req/day</th>
                </tr>
              </thead>
              <tbody>
                {urlPagination.slice.map((u) => (
                  <tr key={u.path} className="border-b border-gray-50 table-row-hover">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-800">{u.path}</td>
                    <td className="py-2 pr-4 text-right text-gray-700 font-medium">{u.requests}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{u.uniqueUrls}</td>
                    <td className="py-2 text-right text-gray-500">{u.reqPerDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={urlPagination.page}
              total={urlPagination.total}
              onPrev={() => urlPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => urlPagination.setPage((p) => Math.min(urlPagination.total, p + 1))}
              count={data.urlCategories.length}
            />
          </div>
        )}

        {/* === CRAWLED PAGES === */}
        {section === "pages" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Crawled pages · {data.crawledPages.length} pages
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">URL</th>
                  <th className="pb-2 pr-4 text-right">Req.</th>
                  <th className="pb-2 pr-4 text-right">% bots</th>
                  <th className="pb-2 pr-4 text-right">Bots</th>
                  <th className="pb-2 text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {pagesPagination.slice.map((p) => (
                  <tr key={p.path} className="border-b border-gray-50 table-row-hover">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-800 max-w-xs truncate" title={p.path}>{p.path}</td>
                    <td className="py-2 pr-4 text-right font-medium">{p.requests}</td>
                    <td className="py-2 pr-4 text-right">
                      <span className={clsx(
                        "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                        p.botPercent === 100 ? "bg-orange-100 text-orange-700" :
                        p.botPercent > 50 ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      )}>
                        {p.botPercent}%
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-500">{p.bots}</td>
                    <td className="py-2 text-right text-gray-500 text-xs">{fmtDate(p.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={pagesPagination.page}
              total={pagesPagination.total}
              onPrev={() => pagesPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => pagesPagination.setPage((p) => Math.min(pagesPagination.total, p + 1))}
              count={data.crawledPages.length}
            />
          </div>
        )}

        {/* === LOG ENTRIES === */}
        {section === "entries" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Log entries</h3>
              <div className="relative ml-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by path…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                {sortedCodes.map(({ code }) => (
                  <button
                    key={code}
                    onClick={() => setCodeFilter(codeFilter === code ? null : code)}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                      codeFilter === code ? "ring-2 ring-blue-400" : "border-gray-200",
                      statusColor(code)
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-2 pr-3">Time</th>
                    <th className="pb-2 pr-3">Path</th>
                    <th className="pb-2 pr-3">User agent</th>
                    <th className="pb-2 pr-3 text-center">Code</th>
                    {data.hosts.length > 0 && <th className="pb-2">Host</th>}
                  </tr>
                </thead>
                <tbody>
                  {entriesPagination.slice.map((e, i) => (
                    <tr key={i} className="border-b border-gray-50 table-row-hover">
                      <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{fmt(e.timestamp)}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs text-gray-800 max-w-xs truncate" title={e.path}>{e.path}</td>
                      <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-[200px] truncate" title={e.userAgent}>{e.userAgent || "-"}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-xs font-bold", statusColor(e.statusCode))}>
                          {e.statusCode}
                        </span>
                      </td>
                      {data.hosts.length > 0 && (
                        <td className="py-1.5 text-gray-400 text-xs truncate max-w-[120px]">{e.host ?? "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={entriesPagination.page}
              total={entriesPagination.total}
              onPrev={() => entriesPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => entriesPagination.setPage((p) => Math.min(entriesPagination.total, p + 1))}
              count={filteredEntries.length}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BotTable({
  bots,
  total,
  compact = false,
}: {
  bots: AnalysisData["bots"];
  total: number;
  compact?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
          <th className="pb-2 pr-4">Bot</th>
          <th className="pb-2 pr-4">Provider</th>
          <th className="pb-2 pr-4">Category</th>
          <th className="pb-2 pr-4 text-right">Requests</th>
          <th className="pb-2 pr-4 text-right">URLs</th>
          {!compact && <th className="pb-2 pr-4">First seen</th>}
          {!compact && <th className="pb-2">Last seen</th>}
          <th className="pb-2 text-right">% total</th>
        </tr>
      </thead>
      <tbody>
        {bots.map((bot) => (
          <tr key={bot.name} className="border-b border-gray-50 table-row-hover">
            <td className="py-2 pr-4 font-medium text-gray-900">{bot.name}</td>
            <td className="py-2 pr-4 text-gray-500">{bot.provider}</td>
            <td className="py-2 pr-4">
              <CategoryBadge category={bot.category} />
            </td>
            <td className="py-2 pr-4 text-right font-semibold">{bot.requests}</td>
            <td className="py-2 pr-4 text-right text-gray-500">{bot.uniqueUrls}</td>
            {!compact && <td className="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap">{fmt(bot.firstSeen)}</td>}
            {!compact && <td className="py-2 text-gray-400 text-xs whitespace-nowrap">{fmt(bot.lastSeen)}</td>}
            <td className="py-2 text-right text-gray-500">
              {total > 0 ? Math.round((bot.requests / total) * 100) : 0}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "Search engines": "bg-blue-100 text-blue-700",
  "AI bots": "bg-purple-100 text-purple-700",
  "Social": "bg-pink-100 text-pink-700",
  "Others": "bg-gray-100 text-gray-600",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600")}>
      {category}
    </span>
  );
}

function Pagination({
  page,
  total,
  onPrev,
  onNext,
  count,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  count: number;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>{count} items</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {page} / {total}
        </span>
        <button
          onClick={onNext}
          disabled={page === total}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
