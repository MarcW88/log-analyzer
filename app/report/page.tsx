import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function safeDate(val: string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", opts ?? {});
}

async function getData() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await supabaseAdmin
    .from("log_analyses")
    .select("data, saved_at")
    .eq("id", "latest")
    .single();
  return data ?? null;
}

export default async function ReportPage() {
  const row = await getData();

  if (!row?.data) {
    return (
      <html><body style={{ fontFamily: "monospace", padding: "2rem" }}>
        <h1>Log Analyzer — No data yet</h1>
        <p>Upload log files via the Log Analyzer UI first.</p>
      </body></html>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = row.data as any;
  const saved = safeDate(row.saved_at);
  const periodStart = safeDate(d.period?.start);
  const periodEnd = safeDate(d.period?.end);

  const bots: Array<{name:string;provider:string;category:string;requests:number;uniqueUrls:number;firstSeen:string;lastSeen:string}> = d.bots ?? [];
  const pages: Array<{path:string;requests:number;botPercent:number;bots:number;lastSeen:string}> = d.crawledPages ?? [];
  const urlCats: Array<{path:string;requests:number;uniqueUrls:number;reqPerDay:number}> = d.urlCategories ?? [];
  const timeline: Array<{date:string;users:number;searchEngines:number;aiBots:number;others:number;total:number}> = d.timelineData ?? [];
  const httpCodes: Record<string,number> = d.httpCodes ?? {};

  const seo = bots.filter(b => b.category === "Search engines");
  const ai  = bots.filter(b => b.category === "AI bots");
  const other = bots.filter(b => b.category !== "Search engines" && b.category !== "AI bots");

  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 2rem; }
    h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.4rem; }
    .stats { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.5rem; min-width: 140px; }
    .stat-val { font-size: 1.8rem; font-weight: 700; color: #3b82f6; }
    .stat-lbl { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 2rem; }
    th { background: #f1f5f9; text-align: left; padding: 0.6rem 1rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
    td { padding: 0.55rem 1rem; font-size: 0.88rem; border-top: 1px solid #f1f5f9; }
    tr:hover td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
    .seo  { background: #dbeafe; color: #1d4ed8; }
    .ai   { background: #ede9fe; color: #6d28d9; }
    .social { background: #fce7f3; color: #be185d; }
    .other-badge { background: #f1f5f9; color: #475569; }
  `;

  return (
    <html lang="fr">
      <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Log Report</title><style>{css}</style></head>
      <body>
        <h1>📊 Log Analyzer — Rapport</h1>
        <p className="meta">Dernière mise à jour : {saved} · Période : {periodStart} → {periodEnd} · Hosts : {(d.hosts ?? []).join(", ") || "—"}</p>

        <div className="stats">
          <div className="stat"><div className="stat-val">{(d.totalRequests ?? 0).toLocaleString("fr-FR")}</div><div className="stat-lbl">Requêtes totales</div></div>
          <div className="stat"><div className="stat-val">{(d.uniqueUrls ?? 0).toLocaleString("fr-FR")}</div><div className="stat-lbl">URLs uniques</div></div>
          <div className="stat"><div className="stat-val">{d.detectedBots ?? 0}</div><div className="stat-lbl">Bots distincts</div></div>
          <div className="stat"><div className="stat-val">{d.botPercent ?? 0}%</div><div className="stat-lbl">Trafic bots</div></div>
        </div>

        <h2>🤖 Bots SEO ({seo.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Provider</th><th>Requêtes</th><th>URLs uniques</th><th>Première vue</th><th>Dernière vue</th></tr></thead>
          <tbody>{seo.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.provider}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td><td>{safeDate(b.firstSeen, {dateStyle:"short"})}</td><td>{safeDate(b.lastSeen, {dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>

        <h2>🧠 Bots IA ({ai.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Provider</th><th>Requêtes</th><th>URLs uniques</th><th>Première vue</th><th>Dernière vue</th></tr></thead>
          <tbody>{ai.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.provider}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td><td>{safeDate(b.firstSeen, {dateStyle:"short"})}</td><td>{safeDate(b.lastSeen, {dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>

        <h2>📦 Autres bots ({other.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Catégorie</th><th>Requêtes</th><th>URLs uniques</th></tr></thead>
          <tbody>{other.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.category}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td></tr>
          ))}</tbody>
        </table>

        <h2>🌐 Codes HTTP</h2>
        <table>
          <thead><tr><th>Code</th><th>Occurrences</th></tr></thead>
          <tbody>{Object.entries(httpCodes).sort(([,a],[,b]) => b-a).map(([code, count]) => (
            <tr key={code}><td><strong>HTTP {code}</strong></td><td>{count.toLocaleString("fr-FR")}</td></tr>
          ))}</tbody>
        </table>

        <h2>📁 Catégories d&apos;URLs (top 20)</h2>
        <table>
          <thead><tr><th>Segment</th><th>Requêtes</th><th>URLs uniques</th><th>Req/jour</th></tr></thead>
          <tbody>{urlCats.slice(0,20).map((u,i) => (
            <tr key={i}><td><code>{u.path}</code></td><td>{u.requests.toLocaleString("fr-FR")}</td><td>{u.uniqueUrls}</td><td>{u.reqPerDay}</td></tr>
          ))}</tbody>
        </table>

        <h2>🔍 Pages les plus crawlées (top 30)</h2>
        <table>
          <thead><tr><th>Page</th><th>Requêtes</th><th>% bots</th><th>Dernière vue</th></tr></thead>
          <tbody>{pages.slice(0,30).map((p,i) => (
            <tr key={i}><td><code>{p.path}</code></td><td>{p.requests.toLocaleString("fr-FR")}</td><td><strong>{p.botPercent}% (de cette URL)</strong></td><td>{safeDate(p.lastSeen, {dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>

        <h2>📅 Timeline par jour</h2>
        <table>
          <thead><tr><th>Date</th><th>Utilisateurs</th><th>Bots SEO</th><th>Bots IA</th><th>Autres</th><th>Total</th></tr></thead>
          <tbody>{timeline.map((t,i) => (
            <tr key={i}><td>{t.date}</td><td>{t.users.toLocaleString("fr-FR")}</td><td>{t.searchEngines.toLocaleString("fr-FR")}</td><td>{t.aiBots.toLocaleString("fr-FR")}</td><td>{t.others.toLocaleString("fr-FR")}</td><td><strong>{t.total.toLocaleString("fr-FR")}</strong></td></tr>
          ))}</tbody>
        </table>
      </body>
    </html>
  );
}
