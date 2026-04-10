-- SOUL — Integrations Schema
-- Run this in your Supabase SQL editor after schema.sql

-- ── INTEGRATIONS CONFIG ───────────────────────────────────────────────────────
-- Stores credentials and config for each connected platform (one row per platform)

create table if not exists public.integrations (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null unique,   -- 'str' | 'profitsword' | 'lighthouse' | 'amadeus'
  enabled       boolean default false,
  credentials   jsonb,                  -- API keys, secrets (keep RLS tight)
  config        jsonb,                  -- property IDs, endpoints, filters
  last_sync_at  timestamptz,
  last_sync_status text,               -- 'success' | 'error' | 'running'
  last_sync_message text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── SYNC LOGS ─────────────────────────────────────────────────────────────────
-- One row per sync run for history / debugging

create table if not exists public.sync_logs (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  status        text,                   -- 'running' | 'success' | 'error'
  rows_synced   integer default 0,
  message       text
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.integrations enable row level security;
alter table public.sync_logs     enable row level security;

create policy "authenticated read integrations"  on public.integrations for select to authenticated using (true);
create policy "authenticated write integrations" on public.integrations for all    to authenticated using (true);

create policy "authenticated read sync_logs"     on public.sync_logs for select to authenticated using (true);
create policy "authenticated write sync_logs"    on public.sync_logs for all    to authenticated using (true);

-- ── SEED ROWS (one placeholder per platform) ─────────────────────────────────
insert into public.integrations (platform, enabled) values
  ('str',         false),
  ('profitsword', false),
  ('lighthouse',  false),
  ('amadeus',     false)
on conflict (platform) do nothing;
