import { NextRequest, NextResponse } from "next/server";
import pako from "pako";
import { parseApacheLogs } from "@/lib/parseApacheLogs";
import { parseVercelLogs } from "@/lib/parseVercelLogs";
import { analyze } from "@/lib/analyze";
import { detectBot } from "@/lib/botDetection";
import { saveAnalysis } from "@/lib/cache";
import { LogEntry } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const allEntries: LogEntry[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let text: string;

      const isGzip =
        file.name.endsWith(".gz") ||
        (buffer[0] === 0x1f && buffer[1] === 0x8b);

      if (isGzip) {
        try {
          const decompressed = pako.inflate(new Uint8Array(buffer));
          text = new TextDecoder().decode(decompressed);
        } catch {
          return NextResponse.json(
            { error: `Failed to decompress ${file.name}` },
            { status: 400 }
          );
        }
      } else {
        text = buffer.toString("utf-8");
      }

      const isVercelLog = text.trimStart().startsWith("{");

      const entries = isVercelLog
        ? parseVercelLogs(text)
        : parseApacheLogs(text);

      allEntries.push(...entries);
    }

    if (!allEntries.length) {
      return NextResponse.json({ error: "No valid log entries found" }, { status: 400 });
    }

    const result = analyze(allEntries);

    const botCount = result.entries.filter((e) => detectBot(e.userAgent)).length;
    const botPercent = result.totalRequests > 0
      ? Math.round((botCount / result.totalRequests) * 100)
      : 0;

    saveAnalysis({
      savedAt: new Date().toISOString(),
      period: {
        start: result.period.start.toISOString(),
        end: result.period.end.toISOString(),
      },
      hosts: result.hosts,
      totalRequests: result.totalRequests,
      uniqueUrls: result.uniqueUrls,
      detectedBots: result.detectedBots,
      botPercent,
      httpCodes: result.httpCodes,
      bots: result.bots.map((b) => ({
        name: b.name,
        provider: b.provider,
        category: b.category,
        requests: b.requests,
        uniqueUrls: b.uniqueUrls.size,
        firstSeen: b.firstSeen.toISOString(),
        lastSeen: b.lastSeen.toISOString(),
        statusCodes: b.statusCodes,
      })),
      urlCategories: result.urlCategories,
      crawledPages: result.crawledPages.map((p) => ({
        ...p,
        lastSeen: p.lastSeen.toISOString(),
      })),
      timelineData: result.timelineData,
    });

    // Serialize the result (Sets → arrays, Dates → ISO strings)
    return NextResponse.json({
      period: {
        start: result.period.start.toISOString(),
        end: result.period.end.toISOString(),
      },
      hosts: result.hosts,
      totalRequests: result.totalRequests,
      uniqueUrls: result.uniqueUrls,
      detectedBots: result.detectedBots,
      httpCodes: result.httpCodes,
      bots: result.bots.map((b) => ({
        name: b.name,
        provider: b.provider,
        category: b.category,
        requests: b.requests,
        uniqueUrls: b.uniqueUrls.size,
        firstSeen: b.firstSeen.toISOString(),
        lastSeen: b.lastSeen.toISOString(),
        statusCodes: b.statusCodes,
      })),
      urlCategories: result.urlCategories,
      crawledPages: result.crawledPages.map((p) => ({
        ...p,
        lastSeen: p.lastSeen.toISOString(),
      })),
      timelineData: result.timelineData,
      entries: result.entries.slice(0, 500).map((e) => ({
        timestamp: e.timestamp.toISOString(),
        ip: e.ip,
        method: e.method,
        path: e.path,
        statusCode: e.statusCode,
        size: e.size,
        userAgent: e.userAgent,
        host: e.host,
        source: e.source,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
