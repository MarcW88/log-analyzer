import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export function middleware(req: NextRequest) {
  const base = req.nextUrl.origin;

  if (req.nextUrl.pathname === "/.well-known/oauth-protected-resource") {
    return NextResponse.json(
      {
        resource: `${base}/api/mcp`,
        authorization_servers: [base],
        bearer_methods_supported: ["header"],
        scopes_supported: ["mcp"],
      },
      { headers: CORS }
    );
  }

  if (req.nextUrl.pathname === "/.well-known/oauth-authorization-server") {
    return NextResponse.json(
      {
        issuer: base,
        authorization_endpoint: `${base}/api/oauth/authorize`,
        token_endpoint: `${base}/api/oauth/token`,
        registration_endpoint: `${base}/api/oauth/register`,
        scopes_supported: ["mcp"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      },
      { headers: CORS }
    );
  }
}

export const config = {
  matcher: ["/.well-known/:path*"],
};
