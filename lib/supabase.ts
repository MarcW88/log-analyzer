import { createClient } from "@supabase/supabase-js";

// Server-only — uses service role key, never exposed to client bundle
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
