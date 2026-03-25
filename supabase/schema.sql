-- Strategic Ops Labs — Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ASSETS
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  type text not null check (type in ('hotel','resort','mixed','commercial')),
  market text not null,
  rooms integer,
  status text not null default 'active' check (status in ('active','renovation','review','disposed')),
  address text,
  brand text,
  year_built integer,
  year_acquired integer,
  acquisition_price numeric,
  current_value numeric,
  notes text
);

-- FINANCIAL SNAPSHOTS (monthly per asset)
create table public.financials (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade,
  period_month integer not null,
  period_year integer not null,
  revenue numeric,
  gop numeric,
  noi numeric,
  ebitda numeric,
  rooms_available integer,
  rooms_sold integer,
  occupancy numeric,
  adr numeric,
  revpar numeric,
  budget_revenue numeric,
  budget_noi numeric,
  created_at timestamptz default now()
);

-- DEALS
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  market text,
  type text,
  rooms integer,
  ask_price numeric,
  price_per_key numeric,
  cap_rate numeric,
  stage text not null default 'prospecting' check (stage in ('prospecting','loi','due_diligence','closing','closed','dead')),
  score integer check (score >= 0 and score <= 100),
  notes text,
  expected_close date,
  broker text
);

-- DEAL CHECKLIST ITEMS
create table public.deal_checklist (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  item text not null,
  completed boolean default false,
  completed_at timestamptz,
  sort_order integer default 0
);

-- COMPETITIVE DATA
create table public.comp_data (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade,
  period_month integer not null,
  period_year integer not null,
  occ_index numeric,
  adr_index numeric,
  revpar_index numeric,
  comp_set_revpar numeric,
  comp_set_occ numeric,
  comp_set_adr numeric,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table public.assets enable row level security;
alter table public.financials enable row level security;
alter table public.deals enable row level security;
alter table public.deal_checklist enable row level security;
alter table public.comp_data enable row level security;

-- Policies: authenticated users can read/write all
create policy "authenticated read assets" on public.assets for select to authenticated using (true);
create policy "authenticated write assets" on public.assets for all to authenticated using (true);

create policy "authenticated read financials" on public.financials for select to authenticated using (true);
create policy "authenticated write financials" on public.financials for all to authenticated using (true);

create policy "authenticated read deals" on public.deals for select to authenticated using (true);
create policy "authenticated write deals" on public.deals for all to authenticated using (true);

create policy "authenticated read checklist" on public.deal_checklist for select to authenticated using (true);
create policy "authenticated write checklist" on public.deal_checklist for all to authenticated using (true);

create policy "authenticated read comp" on public.comp_data for select to authenticated using (true);
create policy "authenticated write comp" on public.comp_data for all to authenticated using (true);

-- SEED DATA (sample portfolio)
insert into public.assets (name, type, market, rooms, status, brand, year_acquired, acquisition_price, current_value) values
  ('The Peabody Memphis', 'hotel', 'Memphis, TN', 464, 'active', 'Independent', 2018, 95000000, 142000000),
  ('Embassy Suites Nashville', 'hotel', 'Nashville, TN', 208, 'active', 'Hilton', 2019, 58000000, 78000000),
  ('Gulf Shores Resort', 'resort', 'Gulf Shores, AL', 312, 'active', 'Independent', 2020, 88000000, 124000000),
  ('Hilton Garden Inn Atlanta', 'hotel', 'Atlanta, GA', 196, 'active', 'Hilton', 2017, 42000000, 54000000),
  ('Courtyard Birmingham', 'hotel', 'Birmingham, AL', 168, 'active', 'Marriott', 2021, 31000000, 38000000),
  ('Sandestin Beach Club', 'resort', 'Destin, FL', 280, 'active', 'Independent', 2022, 105000000, 118000000),
  ('Midtown Mixed-Use', 'mixed', 'Atlanta, GA', null, 'review', null, 2023, 38000000, 41000000),
  ('Brentwood Suites', 'hotel', 'Brentwood, TN', 142, 'renovation', 'IHG', 2022, 24000000, 28000000);

insert into public.deals (name, market, type, rooms, ask_price, price_per_key, cap_rate, stage, score, expected_close) values
  ('Savannah Historic Inn', 'Savannah, GA', 'hotel', 88, 19000000, 215909, 6.8, 'prospecting', 62, null),
  ('Knoxville Downtown Hotel', 'Knoxville, TN', 'hotel', 160, 42000000, 262500, 5.9, 'prospecting', 55, null),
  ('Destin Waterfront Resort', 'Destin, FL', 'resort', 280, 65000000, 232143, 7.1, 'loi', 74, '2026-06-30'),
  ('Chattanooga Boutique', 'Chattanooga, TN', 'hotel', 140, 28000000, 200000, 7.8, 'due_diligence', 81, '2026-05-15'),
  ('Brentwood Mixed-Use', 'Brentwood, TN', 'commercial', null, 42000000, null, 6.2, 'closing', 91, '2026-04-01');
