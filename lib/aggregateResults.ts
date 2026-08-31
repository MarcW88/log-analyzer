type ApiResult = {
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
  urlCategories: { path: string; requests: number; uniqueUrls: number; reqPerDay: number }[];
  crawledPages: { path: string; requests: number; botPercent: number; bots: number; lastSeen: string }[];
  timelineData: { date: string; users: number; searchEngines: number; aiBots: number; others: number; total: number }[];
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
};

export function aggregateResults(results: ApiResult[]): ApiResult {
  if (results.length === 0) throw new Error("No results to aggregate");
  if (results.length === 1) return results[0];

  let startDate = results[0].period.start;
  let endDate = results[0].period.end;

  const allHosts = new Set<string>();
  let totalRequests = 0;
  const httpCodes: Record<string, number> = {};
  const botsMap = new Map<string, ApiResult["bots"][number]>();
  const urlMap = new Map<string, { requests: number; uniqueUrls: number }>();
  const pagesMap = new Map<string, ApiResult["crawledPages"][number]>();
  const timelineMap = new Map<string, ApiResult["timelineData"][number]>();
  const allUrlPaths = new Set<string>();
  const allEntries: ApiResult["entries"] = [];

  for (const r of results) {
    if (r.period.start < startDate) startDate = r.period.start;
    if (r.period.end > endDate) endDate = r.period.end;

    r.hosts.forEach((h) => allHosts.add(h));
    totalRequests += r.totalRequests;

    for (const [code, count] of Object.entries(r.httpCodes)) {
      httpCodes[code] = (httpCodes[code] ?? 0) + count;
    }

    for (const bot of r.bots) {
      const ex = botsMap.get(bot.name);
      if (ex) {
        ex.requests += bot.requests;
        ex.uniqueUrls += bot.uniqueUrls;
        if (bot.firstSeen < ex.firstSeen) ex.firstSeen = bot.firstSeen;
        if (bot.lastSeen > ex.lastSeen) ex.lastSeen = bot.lastSeen;
        for (const [code, cnt] of Object.entries(bot.statusCodes)) {
          ex.statusCodes[code] = (ex.statusCodes[code] ?? 0) + cnt;
        }
      } else {
        botsMap.set(bot.name, { ...bot, statusCodes: { ...bot.statusCodes } });
      }
    }

    for (const cat of r.urlCategories) {
      allUrlPaths.add(cat.path);
      const ex = urlMap.get(cat.path);
      if (ex) {
        ex.requests += cat.requests;
        ex.uniqueUrls += cat.uniqueUrls;
      } else {
        urlMap.set(cat.path, { requests: cat.requests, uniqueUrls: cat.uniqueUrls });
      }
    }

    for (const page of r.crawledPages) {
      const ex = pagesMap.get(page.path);
      if (ex) {
        const totalReqs = ex.requests + page.requests;
        const botReqs = Math.round((ex.botPercent / 100) * ex.requests) +
                        Math.round((page.botPercent / 100) * page.requests);
        ex.requests = totalReqs;
        ex.botPercent = Math.round((botReqs / totalReqs) * 100);
        ex.bots = Math.max(ex.bots, page.bots);
        if (page.lastSeen > ex.lastSeen) ex.lastSeen = page.lastSeen;
      } else {
        pagesMap.set(page.path, { ...page });
      }
    }

    for (const pt of r.timelineData) {
      const ex = timelineMap.get(pt.date);
      if (ex) {
        ex.users += pt.users;
        ex.searchEngines += pt.searchEngines;
        ex.aiBots += pt.aiBots;
        ex.others += pt.others;
        ex.total += pt.total;
      } else {
        timelineMap.set(pt.date, { ...pt });
      }
    }

    allEntries.push(...r.entries);
  }

  const daysDiff = Math.max(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    1
  );

  const urlCategories = [...urlMap.entries()]
    .map(([path, { requests, uniqueUrls }]) => ({
      path,
      requests,
      uniqueUrls,
      reqPerDay: Math.round((requests / daysDiff) * 100) / 100,
    }))
    .sort((a, b) => b.requests - a.requests);

  const crawledPages = [...pagesMap.values()].sort((a, b) => b.requests - a.requests);

  const timelineData = [...timelineMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  const bots = [...botsMap.values()].sort((a, b) => b.requests - a.requests);

  const entries = allEntries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 1000);

  return {
    period: { start: startDate, end: endDate },
    hosts: [...allHosts],
    totalRequests,
    uniqueUrls: allUrlPaths.size,
    detectedBots: botsMap.size,
    httpCodes,
    bots,
    urlCategories,
    crawledPages,
    timelineData,
    entries,
  };
}
