import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const data = await req.json();
  const dateId = (data.period?.start as string | undefined)?.slice(0, 10) ?? "unknown";
  const savedAt = new Date().toISOString();

  const { error } = await supabaseAdmin.from("log_analyses").upsert([
    { id: dateId, data, saved_at: savedAt },
    { id: "latest", data, saved_at: savedAt },
  ]);

  if (error) {
    console.error("[save-analysis]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: dateId });
}
