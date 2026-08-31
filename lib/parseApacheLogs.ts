import { LogEntry } from "./types";

const APACHE_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+(\S+)\s+\S+"\s+(\d+)\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?/;

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseApacheDate(dateStr: string): Date {
  // Format: 06/Aug/2026:19:19:38 +0200
  const match = dateStr.match(
    /(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([+-]\d+)/
  );
  if (!match) return new Date(0);
  const [, day, mon, year, hh, mm, ss, tz] = match;
  const tzOffset = parseInt(tz.slice(0, 3)) * 60 + parseInt(tz.slice(0, 1) + tz.slice(3));
  const utcMs =
    Date.UTC(
      parseInt(year),
      MONTH_MAP[mon] ?? 0,
      parseInt(day),
      parseInt(hh),
      parseInt(mm),
      parseInt(ss)
    ) - tzOffset * 60000;
  return new Date(utcMs);
}

export function parseApacheLine(line: string): LogEntry | null {
  const m = APACHE_REGEX.exec(line);
  if (!m) return null;
  const [, ip, dateStr, method, path, status, sizeStr, referer, userAgent] = m;
  return {
    timestamp: parseApacheDate(dateStr),
    ip,
    method,
    path,
    statusCode: parseInt(status),
    size: sizeStr === "-" ? null : parseInt(sizeStr),
    referer: referer && referer !== "-" ? referer : null,
    userAgent: userAgent ?? "",
  };
}

export function parseApacheLogs(text: string): LogEntry[] {
  return text
    .split("\n")
    .map((line) => parseApacheLine(line.trim()))
    .filter((e): e is LogEntry => e !== null);
}
