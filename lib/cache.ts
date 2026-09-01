import fs from "fs";
import path from "path";

const CACHE_PATH = path.join(process.cwd(), ".cache", "last-analysis.json");

export interface CachedBot {
  name: string;
  provider: string;
  category: string;
  requests: number;
  uniqueUrls: number;
  firstSeen: string;
  lastSeen: string;
  statusCodes: Record<number, number>;
}

export interface CachedPage {
  path: string;
  requests: number;
  botPercent: number;
  bots: number;
  lastSeen: string;
}

export interface CachedUrlCategory {
  path: string;
  requests: number;
  uniqueUrls: number;
  reqPerDay: number;
}

export interface CachedAnalysis {
  savedAt: string;
  period: { start: string; end: string };
  hosts: string[];
  totalRequests: number;
  uniqueUrls: number;
  detectedBots: number;
  botPercent: number;
  httpCodes: Record<number, number>;
  bots: CachedBot[];
  urlCategories: CachedUrlCategory[];
  crawledPages: CachedPage[];
  timelineData: unknown[];
}

let _memCache: CachedAnalysis | null = null;

export async function saveAnalysisToSupabase(data: CachedAnalysis): Promise<void> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const { supabaseAdmin } = await import("./supabase");
    await supabaseAdmin
      .from("log_analyses")
      .upsert({ id: "latest", data, saved_at: data.savedAt });
  } catch (err) {
    console.warn("[cache] Supabase save failed:", err);
  }
}

export function saveAnalysis(data: CachedAnalysis): void {
  _memCache = data;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data));
  } catch {
    // non-fatal: in-memory cache still works for the current process
  }
}

export function loadAnalysis(): CachedAnalysis | null {
  if (_memCache) return _memCache;
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf-8");
    _memCache = JSON.parse(raw) as CachedAnalysis;
    return _memCache;
  } catch {
    return null;
  }
}
