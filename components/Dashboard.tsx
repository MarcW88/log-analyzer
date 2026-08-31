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
  BarChart2,
  FileText,
  FolderSearch,
  List,
} from "lucide-react";
import clsx from "clsx";
import { detectBot } from "@/lib/botDetection";

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

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",        icon: BarChart2 },
  { id: "bots",      label: "Bot Activity",     icon: Bot },
  { id: "urls",      label: "URL Categories",   icon: FolderSearch },
  { id: "pages",     label: "Crawled Pages",    icon: FileText },
  { id: "entries",   label: "Log Entries",      icon: List },
];

function pathLevel(path: string): number {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.length;
}

export default function Dashboard({ data, onReset }: DashboardProps) {
  // Overview
  const [hostFilter, setHostFilter] = useState("all");

  // Bot Activity
  const [botCategoryFilter, setBotCategoryFilter] = useState("all");

  // URL Categories
  const [urlLevelFilter, setUrlLevelFilter] = useState("all");
  const [urlSearch, setUrlSearch] = useState("");

  // Crawled Pages
  const [pagesBotFilter, setPagesBotFilter] = useState("all");

  // Log Entries
  const [codeFilter, setCodeFilter] = useState<number | null>(null);
  const [entryTrafficFilter, setEntryTrafficFilter] = useState("all");
  const [entryBotCategoryFilter, setEntryBotCategoryFilter] = useState("all");
  const [entrySearch, setEntrySearch] = useState("");

  const sortedCodes = Object.entries(data.httpCodes)
    .map(([k, v]) => ({ code: parseInt(k), count: v }))
    .sort((a, b) => b.count - a.count);

  const filteredBots = useMemo(() =>
    botCategoryFilter === "all"
      ? data.bots
      : data.bots.filter((b) => b.category === botCategoryFilter),
    [data.bots, botCategoryFilter]
  );

  const filteredUrls = useMemo(() => {
    let list = data.urlCategories;
    if (urlSearch) list = list.filter((u) => u.path.toLowerCase().includes(urlSearch.toLowerCase()));
    if (urlLevelFilter !== "all") {
      const lvl = parseInt(urlLevelFilter);
      list = list.filter((u) => {
        const depth = pathLevel(u.path);
        return lvl === 3 ? depth >= 3 : depth === lvl;
      });
    }
    return list;
  }, [data.urlCategories, urlSearch, urlLevelFilter]);

  const filteredPages = useMemo(() => {
    if (pagesBotFilter === "all") return data.crawledPages;
    if (pagesBotFilter === "100") return data.crawledPages.filter((p) => p.botPercent === 100);
    if (pagesBotFilter === "50+") return data.crawledPages.filter((p) => p.botPercent > 50 && p.botPercent < 100);
    if (pagesBotFilter === "<50") return data.crawledPages.filter((p) => p.botPercent <= 50);
    return data.crawledPages;
  }, [data.crawledPages, pagesBotFilter]);

  const filteredEntries = useMemo(() => {
    return data.entries.filter((e) => {
      if (codeFilter && e.statusCode !== codeFilter) return false;
      if (entrySearch && !e.path.toLowerCase().includes(entrySearch.toLowerCase())) return false;
      if (hostFilter !== "all" && e.host !== hostFilter) return false;
      const bot = detectBot(e.userAgent);
      if (entryTrafficFilter === "bots" && !bot) return false;
      if (entryTrafficFilter === "users" && bot) return false;
      if (entryBotCategoryFilter !== "all") {
        if (!bot || bot.category !== entryBotCategoryFilter) return false;
      }
      return true;
    });
  }, [data.entries, codeFilter, entrySearch, hostFilter, entryTrafficFilter, entryBotCategoryFilter]);

  const botCategories = useMemo(() => [...new Set(data.bots.map((b) => b.category))].sort(), [data.bots]);

  const botPagination     = usePagination(filteredBots, 20);
  const urlPagination     = usePagination(filteredUrls, 15);
  const pagesPagination   = usePagination(filteredPages, 20);
  const entriesPagination = usePagination(filteredEntries, 20);

  const CAT_COLORS: Record<string, string> = {
    "Search engines": "#3b82f6",
    "AI bots": "#8b5cf6",
    "Social": "#ec4899",
    "Others": "#6b7280",
    "Users": "#10b981",
  };

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky top navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        {/* Row 1: title + meta + reset */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-gray-900 tracking-tight">Log Analyzer</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">
              {fmtDate(data.period.start)} → {fmtDate(data.period.end)}
            </span>
            {data.hosts.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-500 max-w-xs truncate">
                  {data.hosts.join(", ")}
                </span>
              </>
            )}
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw size={13} />
            New import
          </button>
        </div>

        {/* Row 2: section anchor links */}
        <nav className="flex items-center gap-1 px-6 py-0">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* ═══════════════════════════════════ OVERVIEW ═══════════ */}
        <section id="overview" className="scroll-mt-28 space-y-5">
          <SectionTitle icon={<BarChart2 size={16} />} title="Overview" />

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Activity size={18} className="text-blue-500" />}  label="Total requests"  value={data.totalRequests.toLocaleString()} />
            <StatCard icon={<Link2    size={18} className="text-purple-500" />} label="Unique URLs"     value={data.uniqueUrls.toLocaleString()} />
            <StatCard icon={<Bot      size={18} className="text-orange-500" />} label="Detected bots"  value={data.detectedBots.toLocaleString()} />
            <StatCard icon={<Globe    size={18} className="text-green-500"  />} label="Hosts / sources" value={data.hosts.length ? data.hosts.length.toString() : "—"} />
          </div>

          {/* Host filter */}
          {data.hosts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Host</span>
              <Dropdown
                value={hostFilter}
                onChange={setHostFilter}
                options={[
                  { value: "all", label: "All hosts" },
                  ...data.hosts.map((h) => ({ value: h, label: h })),
                ]}
              />
            </div>
          )}

          {/* HTTP codes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">HTTP codes</p>
            <div className="flex flex-wrap gap-2">
              {sortedCodes.map(({ code, count }) => (
                <button
                  key={code}
                  onClick={() => setCodeFilter(codeFilter === code ? null : code)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    codeFilter === code ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200 hover:border-gray-300",
                    statusColor(code)
                  )}
                >
                  <span className="font-bold">{code}</span>
                  <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Crawl timeline</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.timelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  {(["users","searchEngines","aiBots","others"] as const).map((k) => {
                    const colorKey = k === "searchEngines" ? "Search engines" : k === "aiBots" ? "AI bots" : k === "users" ? "Users" : "Others";
                    return (
                      <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CAT_COLORS[colorKey]} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CAT_COLORS[colorKey]} stopOpacity={0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend formatter={(v) => v === "searchEngines" ? "Search engines" : v === "aiBots" ? "AI bots" : v} />
                <Area type="monotone" dataKey="users"         stackId="1" stroke={CAT_COLORS["Users"]}          fill="url(#g-users)"         name="Users" />
                <Area type="monotone" dataKey="searchEngines" stackId="1" stroke={CAT_COLORS["Search engines"]} fill="url(#g-searchEngines)" name="searchEngines" />
                <Area type="monotone" dataKey="aiBots"        stackId="1" stroke={CAT_COLORS["AI bots"]}        fill="url(#g-aiBots)"        name="aiBots" />
                <Area type="monotone" dataKey="others"        stackId="1" stroke={CAT_COLORS["Others"]}         fill="url(#g-others)"        name="Others" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ═══════════════════════════════════ BOT ACTIVITY ═══════ */}
        <section id="bots" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Bot size={16} />} title="Bot Activity" badge={`${filteredBots.length} / ${data.bots.length} bots`} />
            <Dropdown
              value={botCategoryFilter}
              onChange={setBotCategoryFilter}
              options={[
                { value: "all", label: "All categories" },
                ...botCategories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <BotTable bots={botPagination.slice} total={data.totalRequests} />
            <Pagination
              page={botPagination.page} total={botPagination.total} count={filteredBots.length}
              onPrev={() => botPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => botPagination.setPage((p) => Math.min(botPagination.total, p + 1))}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════ URL CATEGORIES ═════ */}
        <section id="urls" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<FolderSearch size={16} />} title="URL Categories" badge={`${filteredUrls.length} paths`} />
            <div className="flex items-center gap-2">
              <Dropdown
                value={urlLevelFilter}
                onChange={setUrlLevelFilter}
                options={[
                  { value: "all", label: "All levels" },
                  { value: "0", label: "Root (/)" },
                  { value: "1", label: "Level 1" },
                  { value: "2", label: "Level 2" },
                  { value: "3", label: "Level 3+" },
                ]}
              />
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Filter paths…" value={urlSearch}
                  onChange={(e) => setUrlSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-48"
                />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">Path</th>
                  <th className="pb-2 pr-4 text-right">Requests</th>
                  <th className="pb-2 pr-4 text-right">URLs</th>
                  <th className="pb-2 text-right">Req / day</th>
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
              page={urlPagination.page} total={urlPagination.total} count={filteredUrls.length}
              onPrev={() => urlPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => urlPagination.setPage((p) => Math.min(urlPagination.total, p + 1))}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════ CRAWLED PAGES ══════ */}
        <section id="pages" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<FileText size={16} />} title="Crawled Pages" badge={`${filteredPages.length} pages`} />
            <Dropdown
              value={pagesBotFilter}
              onChange={setPagesBotFilter}
              options={[
                { value: "all",  label: "All pages" },
                { value: "100",  label: "100% bots" },
                { value: "50+",  label: ">50% bots" },
                { value: "<50",  label: "<50% bots" },
              ]}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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
                    <td className="py-2 pr-4 font-mono text-xs text-gray-800 max-w-sm truncate" title={p.path}>{p.path}</td>
                    <td className="py-2 pr-4 text-right font-medium">{p.requests}</td>
                    <td className="py-2 pr-4 text-right">
                      <span className={clsx(
                        "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                        p.botPercent === 100 ? "bg-orange-100 text-orange-700" :
                        p.botPercent > 50    ? "bg-amber-100 text-amber-700" :
                                               "bg-green-100 text-green-700"
                      )}>
                        {p.botPercent}%
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-500">{p.bots}</td>
                    <td className="py-2 text-right text-gray-400 text-xs">{fmtDate(p.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={pagesPagination.page} total={pagesPagination.total} count={filteredPages.length}
              onPrev={() => pagesPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => pagesPagination.setPage((p) => Math.min(pagesPagination.total, p + 1))}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════ LOG ENTRIES ════════ */}
        <section id="entries" className="scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <SectionTitle icon={<List size={16} />} title="Log Entries" badge={`${filteredEntries.length} entries`} />
            <div className="flex items-center gap-2 flex-wrap">
              <Dropdown
                value={entryTrafficFilter}
                onChange={(v) => { setEntryTrafficFilter(v); if (v === "users") setEntryBotCategoryFilter("all"); }}
                options={[
                  { value: "all",   label: "All traffic" },
                  { value: "bots",  label: "Bots only" },
                  { value: "users", label: "Users only" },
                ]}
              />
              {entryTrafficFilter !== "users" && (
                <Dropdown
                  value={entryBotCategoryFilter}
                  onChange={setEntryBotCategoryFilter}
                  options={[
                    { value: "all", label: "All categories" },
                    ...botCategories.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Filter by path…" value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
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
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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
                      <td className="py-1.5 pr-3 text-gray-400 text-xs whitespace-nowrap">{fmt(e.timestamp)}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs text-gray-800 max-w-xs truncate" title={e.path}>{e.path}</td>
                      <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-[200px] truncate" title={e.userAgent}>{e.userAgent || "—"}</td>
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
              page={entriesPagination.page} total={entriesPagination.total} count={filteredEntries.length}
              onPrev={() => entriesPagination.setPage((p) => Math.max(1, p - 1))}
              onNext={() => entriesPagination.setPage((p) => Math.min(entriesPagination.total, p + 1))}
            />
          </div>
        </section>

        <div className="h-12" />
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Dropdown({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer hover:border-gray-300 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {badge && (
        <span className="ml-1 text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

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
