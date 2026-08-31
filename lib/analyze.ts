import { LogEntry, AnalysisResult, ParsedBot, UrlCategory, CrawledPage, TimelinePoint } from "./types";
import { detectBot, isBot } from "./botDetection";
import { format } from "date-fns";

export function analyze(entries: LogEntry[]): AnalysisResult {
  if (!entries.length) {
    return {
      entries: [],
      period: { start: new Date(), end: new Date() },
      hosts: [],
      totalRequests: 0,
      uniqueUrls: 0,
      detectedBots: 0,
      httpCodes: {},
      bots: [],
      urlCategories: [],
      crawledPages: [],
      timelineData: [],
    };
  }

  const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const daysDiff = Math.max((end.getTime() - start.getTime()) / 86400000, 1);

  const hosts = [...new Set(entries.map((e) => e.host).filter(Boolean))] as string[];

  // HTTP codes
  const httpCodes: Record<number, number> = {};
  for (const e of entries) {
    httpCodes[e.statusCode] = (httpCodes[e.statusCode] ?? 0) + 1;
  }

  // Bot detection
  const botsMap = new Map<string, ParsedBot>();
  for (const e of entries) {
    const bot = detectBot(e.userAgent);
    if (bot) {
      const existing = botsMap.get(bot.name);
      if (existing) {
        existing.requests++;
        existing.uniqueUrls.add(e.path);
        if (e.timestamp < existing.firstSeen) existing.firstSeen = e.timestamp;
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
        existing.statusCodes[e.statusCode] = (existing.statusCodes[e.statusCode] ?? 0) + 1;
      } else {
        botsMap.set(bot.name, {
          name: bot.name,
          provider: bot.provider,
          category: bot.category,
          requests: 1,
          uniqueUrls: new Set([e.path]),
          firstSeen: e.timestamp,
          lastSeen: e.timestamp,
          statusCodes: { [e.statusCode]: 1 },
        });
      }
    }
  }
  const bots = [...botsMap.values()].sort((a, b) => b.requests - a.requests);

  // URL categories (level 1 segments)
  const urlMap = new Map<string, { requests: number; urls: Set<string> }>();
  for (const e of entries) {
    const seg = getLevel1(e.path);
    const existing = urlMap.get(seg);
    if (existing) {
      existing.requests++;
      existing.urls.add(e.path);
    } else {
      urlMap.set(seg, { requests: 1, urls: new Set([e.path]) });
    }
  }
  const urlCategories: UrlCategory[] = [...urlMap.entries()]
    .map(([path, { requests, urls }]) => ({
      path,
      requests,
      uniqueUrls: urls.size,
      reqPerDay: Math.round((requests / daysDiff) * 100) / 100,
    }))
    .sort((a, b) => b.requests - a.requests);

  // Crawled pages
  const pageMap = new Map<string, { total: number; bot: number; bots: Set<string>; lastSeen: Date }>();
  for (const e of entries) {
    const existing = pageMap.get(e.path);
    const botInfo = detectBot(e.userAgent);
    if (existing) {
      existing.total++;
      if (botInfo) { existing.bot++; existing.bots.add(botInfo.name); }
      if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
    } else {
      pageMap.set(e.path, {
        total: 1,
        bot: botInfo ? 1 : 0,
        bots: botInfo ? new Set([botInfo.name]) : new Set(),
        lastSeen: e.timestamp,
      });
    }
  }
  const crawledPages: CrawledPage[] = [...pageMap.entries()]
    .filter(([, v]) => v.bot > 0)
    .map(([path, { total, bot, bots, lastSeen }]) => ({
      path,
      requests: total,
      botPercent: Math.round((bot / total) * 100),
      bots: bots.size,
      lastSeen,
    }))
    .sort((a, b) => b.requests - a.requests);

  // Timeline (hourly buckets grouped by day)
  const timelineMap = new Map<string, { users: number; searchEngines: number; aiBots: number; others: number }>();
  for (const e of entries) {
    const key = format(e.timestamp, "MM/dd");
    const existing = timelineMap.get(key) ?? { users: 0, searchEngines: 0, aiBots: 0, others: 0 };
    const bot = detectBot(e.userAgent);
    if (!bot) {
      existing.users++;
    } else if (bot.category === "Search engines") {
      existing.searchEngines++;
    } else if (bot.category === "AI bots") {
      existing.aiBots++;
    } else {
      existing.others++;
    }
    timelineMap.set(key, existing);
  }
  const timelineData: TimelinePoint[] = [...timelineMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      users: v.users,
      searchEngines: v.searchEngines,
      aiBots: v.aiBots,
      others: v.others,
      total: v.users + v.searchEngines + v.aiBots + v.others,
    }));

  return {
    entries: sorted,
    period: { start, end },
    hosts,
    totalRequests: entries.length,
    uniqueUrls: new Set(entries.map((e) => e.path)).size,
    detectedBots: botsMap.size,
    httpCodes,
    bots,
    urlCategories,
    crawledPages,
    timelineData,
  };
}

function getLevel1(path: string): string {
  try {
    const clean = path.split("?")[0];
    const parts = clean.split("/").filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : "/";
  } catch {
    return "/";
  }
}

export function filterEntries(
  entries: LogEntry[],
  opts: { botFilter?: string; codeFilter?: number | null }
): LogEntry[] {
  return entries.filter((e) => {
    if (opts.codeFilter && e.statusCode !== opts.codeFilter) return false;
    if (opts.botFilter) {
      const bot = detectBot(e.userAgent);
      if (!bot || bot.name !== opts.botFilter) return false;
    }
    return true;
  });
}

export function isBotEntry(e: LogEntry): boolean {
  return isBot(e.userAgent);
}
