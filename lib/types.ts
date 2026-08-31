export interface LogEntry {
  timestamp: Date;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  size: number | null;
  referer: string | null;
  userAgent: string;
  host?: string;
  source?: string;
}

export interface ParsedBot {
  name: string;
  provider: string;
  category: string;
  requests: number;
  uniqueUrls: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  statusCodes: Record<number, number>;
}

export interface AnalysisResult {
  entries: LogEntry[];
  period: { start: Date; end: Date };
  hosts: string[];
  totalRequests: number;
  uniqueUrls: number;
  detectedBots: number;
  httpCodes: Record<number, number>;
  bots: ParsedBot[];
  urlCategories: UrlCategory[];
  crawledPages: CrawledPage[];
  timelineData: TimelinePoint[];
}

export interface UrlCategory {
  path: string;
  requests: number;
  uniqueUrls: number;
  reqPerDay: number;
}

export interface CrawledPage {
  path: string;
  requests: number;
  botPercent: number;
  bots: number;
  lastSeen: Date;
}

export interface TimelinePoint {
  date: string;
  users: number;
  searchEngines: number;
  aiBots: number;
  others: number;
  total: number;
}
