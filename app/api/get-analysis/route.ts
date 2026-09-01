import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(null);
  }
  const { data } = await supabaseAdmin
    .from("log_analyses")
    .select("data")
    .eq("id", "latest")
    .single();
  return NextResponse.json(data?.data ?? null);
}
