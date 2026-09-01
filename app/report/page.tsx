import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const LIMIT = 50;

type SP = Promise<{ type?: string; p?: string }>;

function safeDate(val: string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", opts ?? {});
}

function fileType(path: string): string {
  const p = path.split("?")[0].toLowerCase();
  if (p.startsWith("/_next/")) return "Next.js";
  if (/\.(js|mjs|css)$/.test(p)) return "Asset";
  if (/\.(png|jpg|jpeg|gif|ico|svg|webp|avif|woff2?|ttf|eot)$/.test(p)) return "Asset";
  if (/\.json$/.test(p) || p.startsWith("/_next/data")) return "Asset";
  if (p.startsWith("/api/") || p === "/api") return "API";
  if (/\.(xml|txt|pdf|csv)$/.test(p)) return "Other";
  return "Page";
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

const TYPE_LABELS: Record<string, string> = {
  all: "Tous types", Page: "Pages HTML", "Next.js": "Next.js (_next)",
  API: "API", Asset: "Assets (JS/CSS/img)", Other: "Autres",
};

export default async function ReportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const typeFilter = sp.type ?? "all";
  const page = Math.max(1, parseInt(sp.p ?? "1") || 1);

  const row = await getData();

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;padding:2rem}
    h1{font-size:1.4rem;margin-bottom:.25rem}
    .meta{color:#64748b;font-size:.83rem;margin-bottom:1.5rem}
    nav{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:2rem;padding:.75rem 1rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px}
    nav a{font-size:.8rem;color:#3b82f6;text-decoration:none;padding:.25rem .6rem;border-radius:4px;border:1px solid #bfdbfe}
    nav a:hover{background:#eff6ff}
    nav strong{font-size:.8rem;color:#475569;align-self:center}
    h2{font-size:1rem;margin:2rem 0 .6rem;padding-bottom:.4rem;border-bottom:2px solid #e2e8f0}
    .stats{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
    .stat{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem 1.25rem;min-width:130px}
    .stat-val{font-size:1.5rem;font-weight:700;color:#3b82f6}
    .stat-lbl{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:1.5rem}
    th{background:#f1f5f9;text-align:left;padding:.55rem .9rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
    td{padding:.5rem .9rem;font-size:.85rem;border-top:1px solid #f1f5f9}
    tr:hover td{background:#f8fafc}
    .pag{display:flex;align-items:center;gap:1rem;margin:1rem 0 2rem;font-size:.85rem}
    .pag a{color:#3b82f6;text-decoration:none;padding:.3rem .8rem;border:1px solid #bfdbfe;border-radius:6px}
    .pag a:hover{background:#eff6ff}
    .pag span{color:#64748b}
    .filters{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}
    .filters a{font-size:.8rem;padding:.25rem .7rem;border-radius:99px;border:1px solid #e2e8f0;text-decoration:none;color:#475569}
    .filters a.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
  `;

  if (!row?.data) {
    return (
      <html><head><style>{css}</style></head>
      <body>
        <h1>Log Analyzer — Aucune donnée</h1>
        <p className="meta">Uploadez des logs via l&apos;app d&apos;abord.</p>
      </body></html>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = row.data as any;
  const saved = safeDate(row.saved_at);
  const periodStart = safeDate(d.period?.start);
  const periodEnd = safeDate(d.period?.end);

  type Bot = {name:string;provider:string;category:string;requests:number;uniqueUrls:number;firstSeen:string;lastSeen:string};
  type PageRow = {path:string;requests:number;botPercent:number;bots:number;lastSeen:string};
  type UrlCat = {path:string;requests:number;uniqueUrls:number;reqPerDay:number};
  type TL = {date:string;users:number;searchEngines:number;aiBots:number;others:number;total:number};

  const bots: Bot[] = d.bots ?? [];
  const allPages: PageRow[] = d.crawledPages ?? [];
  const allUrlCats: UrlCat[] = d.urlCategories ?? [];
  const timeline: TL[] = d.timelineData ?? [];
  const httpCodes: Record<string,number> = d.httpCodes ?? {};

  // Apply type filter
  const filteredPages = typeFilter === "all" ? allPages : allPages.filter(p => fileType(p.path) === typeFilter);
  const filteredUrls  = typeFilter === "all" ? allUrlCats : allUrlCats.filter(u => fileType(u.path) === typeFilter);

  // Pagination
  const totalPagesCount = Math.ceil(filteredPages.length / LIMIT);
  const totalUrlsCount  = Math.ceil(filteredUrls.length / LIMIT);
  const pagedPages = filteredPages.slice((page - 1) * LIMIT, page * LIMIT);
  const pagedUrls  = filteredUrls.slice((page - 1) * LIMIT, page * LIMIT);

  const seo   = bots.filter(b => b.category === "Search engines");
  const ai    = bots.filter(b => b.category === "AI bots");
  const other = bots.filter(b => b.category !== "Search engines" && b.category !== "AI bots");

  function pageUrl(t: string, pg: number) {
    return `/report?type=${t}&p=${pg}`;
  }

  const typeFilterLabel = TYPE_LABELS[typeFilter] ?? typeFilter;

  return (
    <html lang="fr">
      <head><meta charSet="utf-8" /><title>Log Report</title><style>{css}</style></head>
      <body>
        <h1>📊 Log Analyzer — Rapport</h1>
        <p className="meta">Mis à jour : {saved} · Période : {periodStart} → {periodEnd} · Hosts : {(d.hosts ?? []).join(", ") || "—"}</p>

        {/* Quick nav */}
        <nav>
          <strong>Liens rapides →</strong>
          <a href="/report">Vue d&apos;ensemble</a>
          <a href={pageUrl("Page", 1)}>Pages HTML</a>
          <a href={pageUrl("Next.js", 1)}>Next.js assets</a>
          <a href={pageUrl("API", 1)}>API</a>
          <a href={pageUrl("Asset", 1)}>JS/CSS/images</a>
          <a href={pageUrl("all", 1)}>Toutes les pages</a>
        </nav>

        {/* Overview stats */}
        <div className="stats">
          <div className="stat"><div className="stat-val">{(d.totalRequests ?? 0).toLocaleString("fr-FR")}</div><div className="stat-lbl">Requêtes totales</div></div>
          <div className="stat"><div className="stat-val">{(d.uniqueUrls ?? 0).toLocaleString("fr-FR")}</div><div className="stat-lbl">URLs uniques</div></div>
          <div className="stat"><div className="stat-val">{d.detectedBots ?? 0}</div><div className="stat-lbl">Bots distincts</div></div>
          <div className="stat"><div className="stat-val">{d.botPercent ?? 0}%</div><div className="stat-lbl">Trafic bots</div></div>
          <div className="stat"><div className="stat-val">{allPages.filter(p => fileType(p.path) === "Page").length.toLocaleString()}</div><div className="stat-lbl">Pages HTML crawlées</div></div>
        </div>

        {/* HTTP codes */}
        <h2>🌐 Codes HTTP</h2>
        <table>
          <thead><tr><th>Code</th><th>Occurrences</th><th>% du total</th></tr></thead>
          <tbody>{Object.entries(httpCodes).sort(([,a],[,b]) => (b as number)-(a as number)).map(([code, count]) => (
            <tr key={code}><td><strong>HTTP {code}</strong></td><td>{(count as number).toLocaleString("fr-FR")}</td>
            <td>{d.totalRequests ? ((count as number / d.totalRequests) * 100).toFixed(2) + "%" : "—"}</td></tr>
          ))}</tbody>
        </table>

        {/* Bots */}
        <h2>🔎 Bots SEO ({seo.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Provider</th><th>Requêtes</th><th>URLs uniques</th><th>1ère vue</th><th>Dernière vue</th></tr></thead>
          <tbody>{seo.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.provider}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td>
            <td>{safeDate(b.firstSeen,{dateStyle:"short"})}</td><td>{safeDate(b.lastSeen,{dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>

        <h2>🧠 Bots IA ({ai.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Provider</th><th>Requêtes</th><th>URLs uniques</th><th>1ère vue</th><th>Dernière vue</th></tr></thead>
          <tbody>{ai.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.provider}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td>
            <td>{safeDate(b.firstSeen,{dateStyle:"short"})}</td><td>{safeDate(b.lastSeen,{dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>

        <h2>📦 Autres bots ({other.length})</h2>
        <table>
          <thead><tr><th>Bot</th><th>Catégorie</th><th>Requêtes</th><th>URLs uniques</th></tr></thead>
          <tbody>{other.map((b,i) => (
            <tr key={i}><td>{b.name}</td><td>{b.category}</td><td>{b.requests.toLocaleString("fr-FR")}</td><td>{b.uniqueUrls}</td></tr>
          ))}</tbody>
        </table>

        {/* Timeline */}
        <h2>📅 Timeline par jour</h2>
        <table>
          <thead><tr><th>Date</th><th>Utilisateurs</th><th>Bots SEO</th><th>Bots IA</th><th>Autres</th><th>Total</th></tr></thead>
          <tbody>{timeline.map((t,i) => (
            <tr key={i}><td>{t.date}</td><td>{t.users.toLocaleString("fr-FR")}</td><td>{t.searchEngines.toLocaleString("fr-FR")}</td>
            <td>{t.aiBots.toLocaleString("fr-FR")}</td><td>{t.others.toLocaleString("fr-FR")}</td><td><strong>{t.total.toLocaleString("fr-FR")}</strong></td></tr>
          ))}</tbody>
        </table>

        {/* Paginated URL categories */}
        <h2>📁 Catégories d&apos;URLs — <em>{typeFilterLabel}</em> ({filteredUrls.length} segments · page {page}/{Math.max(1,totalUrlsCount)})</h2>
        <div className="filters">
          {Object.entries(TYPE_LABELS).map(([k,v]) => (
            <a key={k} href={pageUrl(k,1)} className={typeFilter === k ? "active" : ""}>{v}</a>
          ))}
        </div>
        <table>
          <thead><tr><th>Segment</th><th>Requêtes</th><th>URLs uniques</th><th>Req/jour</th></tr></thead>
          <tbody>{pagedUrls.map((u,i) => (
            <tr key={i}><td><code>{u.path}</code></td><td>{u.requests.toLocaleString("fr-FR")}</td><td>{u.uniqueUrls}</td><td>{u.reqPerDay}</td></tr>
          ))}</tbody>
        </table>
        <div className="pag">
          {page > 1 && <a href={pageUrl(typeFilter, page - 1)}>← Précédent</a>}
          <span>Page {page} / {Math.max(1, totalUrlsCount)} ({filteredUrls.length} résultats)</span>
          {page < totalUrlsCount && <a href={pageUrl(typeFilter, page + 1)}>Suivant →</a>}
        </div>

        {/* Paginated crawled pages */}
        <h2>� Pages crawlées — <em>{typeFilterLabel}</em> ({filteredPages.length} pages · page {page}/{Math.max(1,totalPagesCount)})</h2>
        <div className="filters">
          {Object.entries(TYPE_LABELS).map(([k,v]) => (
            <a key={k} href={pageUrl(k,1)} className={typeFilter === k ? "active" : ""}>{v}</a>
          ))}
        </div>
        <table>
          <thead><tr><th>Page</th><th>Requêtes</th><th title="% de bots parmi les requêtes vers cette URL spécifique">% bots/URL</th><th># bots</th><th>Dernière vue</th></tr></thead>
          <tbody>{pagedPages.map((p,i) => (
            <tr key={i}><td><code>{p.path}</code></td><td>{p.requests.toLocaleString("fr-FR")}</td>
            <td><strong>{p.botPercent}%</strong></td><td>{p.bots}</td><td>{safeDate(p.lastSeen,{dateStyle:"short"})}</td></tr>
          ))}</tbody>
        </table>
        <div className="pag">
          {page > 1 && <a href={pageUrl(typeFilter, page - 1)}>← Précédent</a>}
          <span>Page {page} / {Math.max(1, totalPagesCount)} ({filteredPages.length} résultats)</span>
          {page < totalPagesCount && <a href={pageUrl(typeFilter, page + 1)}>Suivant →</a>}
        </div>

      </body>
    </html>
  );
}
