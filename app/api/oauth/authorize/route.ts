import { NextRequest, NextResponse } from "next/server";
import { signPayload } from "@/lib/oauth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function authPage(params: { redirectUri: string; state: string; codeChallenge: string; error?: string }) {
  const { redirectUri, state, codeChallenge, error } = params;
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Log Analyzer</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;padding:40px 36px;max-width:400px;width:92%;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e2e8f0}
    .logo{display:flex;align-items:center;gap:10px;margin-bottom:28px}
    .logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px}
    h1{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px}
    .sub{color:#64748b;font-size:13px;line-height:1.6;margin-bottom:24px}
    label{display:block;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
    input[type=password]{width:100%;padding:10px 13px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;color:#0f172a;outline:none;transition:border .15s,box-shadow .15s}
    input[type=password]:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
    .error{background:#fef2f2;border:1px solid #fecaca;color:#ef4444;font-size:13px;padding:9px 13px;border-radius:7px;margin-bottom:16px}
    .btn{width:100%;padding:11px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;margin-top:16px;transition:opacity .15s}
    .btn:hover{opacity:.9}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">📊</div>
      <span style="font-weight:700;font-size:16px;color:#0f172a">Log Analyzer</span>
    </div>
    <h1>Authorize access</h1>
    <p class="sub">ChatGPT is requesting access to your Log Analyzer. Enter your MCP secret key to allow it.</p>
    ${error ? `<div class="error">❌ Invalid secret key — please try again.</div>` : ""}
    <form method="POST">
      <label>MCP Secret Key</label>
      <input type="password" name="api_key" placeholder="••••••••••••••••••••••••••••••••" autofocus required />
      <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}" />
      <input type="hidden" name="state" value="${esc(state)}" />
      <input type="hidden" name="code_challenge" value="${esc(codeChallenge)}" />
      <button class="btn" type="submit">Authorize →</button>
    </form>
    <div class="footer">Your key is never stored — only used to issue an access token.</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const redirectUri = sp.get("redirect_uri") ?? "";
  const state = sp.get("state") ?? "";
  const codeChallenge = sp.get("code_challenge") ?? "";
  const error = sp.get("error") ?? undefined;

  if (!redirectUri) {
    return NextResponse.json({ error: "missing redirect_uri" }, { status: 400, headers: CORS });
  }

  return authPage({ redirectUri, state, codeChallenge, error });
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    body = Object.fromEntries(await req.formData() as FormData) as Record<string, string>;
  } else {
    body = await req.json().catch(() => ({}));
  }

  const { api_key, redirect_uri: redirectUri = "", state = "", code_challenge: codeChallenge = "" } = body;

  const expectedKey = process.env.MCP_SECRET;
  if (!expectedKey || api_key !== expectedKey) {
    const params = new URLSearchParams({ redirect_uri: redirectUri, state, code_challenge: codeChallenge, error: "1" });
    return NextResponse.redirect(`${new URL(req.url).origin}/api/oauth/authorize?${params}`, { status: 303 });
  }

  const code = signPayload({ codeChallenge, redirectUri, ts: Date.now() });
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString(), { status: 303 });
}
