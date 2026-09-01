-- Log Analyzer — Supabase table
-- Run this once in the Supabase SQL editor (same project as SEO-GEO-lab).

create table if not exists log_analyses (
  id         text primary key,          -- always 'latest' (single-row upsert)
  data       jsonb not null,
  saved_at   timestamptz default now()
);

-- Public read (so Claude.ai / MCP can query without auth)
alter table log_analyses enable row level security;

create policy "Public read" on log_analyses
  for select using (true);
