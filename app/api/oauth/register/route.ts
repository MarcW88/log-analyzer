import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let redirectUris: string[] = [];
  try {
    const ct = req.headers.get("content-type") ?? "";
    const body = ct.includes("application/json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));
    redirectUris = body.redirect_uris ?? [];
  } catch { /* ignore */ }

  return NextResponse.json(
    {
      client_id: "log-analyzer-mcp-client",
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_name: "Log Analyzer MCP",
    },
    { headers: CORS }
  );
}
