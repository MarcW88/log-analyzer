import { LogEntry } from "./types";

interface VercelProxy {
  path?: string;
  method?: string;
  statusCode?: number;
  userAgent?: string[];
  referer?: string;
  host?: string;
  timestamp?: number;
  region?: string;
}

interface VercelLogLine {
  timestamp?: number;
  statusCode?: number;
  level?: string;
  proxy?: VercelProxy;
  host?: string;
  path?: string;
  source?: string;
  projectName?: string;
}

export function parseVercelLine(line: string): LogEntry | null {
  if (!line.trim()) return null;
  try {
    const obj: VercelLogLine = JSON.parse(line);
    const proxy = obj.proxy ?? {};
    const path = proxy.path ?? obj.path ?? "/";
    const method = proxy.method ?? "GET";
    const statusCode = proxy.statusCode ?? obj.statusCode ?? 0;
    const userAgent = Array.isArray(proxy.userAgent)
      ? proxy.userAgent[0] ?? ""
      : (proxy.userAgent as string | undefined) ?? "";
    const referer = proxy.referer ?? null;
    const host = proxy.host ?? obj.host ?? "";
    const ts = proxy.timestamp ?? obj.timestamp ?? 0;
    return {
      timestamp: new Date(ts),
      ip: "",
      method,
      path,
      statusCode,
      size: null,
      referer,
      userAgent,
      host,
      source: obj.source,
    };
  } catch {
    return null;
  }
}

export function parseVercelLogs(text: string): LogEntry[] {
  return text
    .split("\n")
    .map((line) => parseVercelLine(line.trim()))
    .filter((e): e is LogEntry => e !== null);
}
