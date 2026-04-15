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

-- SEED DATA (anonymized — codenames used in place of real property/deal names)
insert into public.assets (name, type, market, rooms, status, brand, year_acquired, acquisition_price, current_value) values
  ('Project Mallard',   'hotel',  'West Tennessee',      464, 'active',     'Independent', 2018, 95000000, 142000000),
  ('Project Harmony',   'hotel',  'Middle Tennessee',    208, 'active',     'Flag A',      2019, 58000000,  78000000),
  ('Project Shoreline', 'resort', 'Coastal Alabama',     312, 'active',     'Independent', 2020, 88000000, 124000000),
  ('Project Ironwood',  'hotel',  'Metro Georgia',       196, 'active',     'Flag A',      2017, 42000000,  54000000),
  ('Project Forge',     'hotel',  'Central Alabama',     168, 'active',     'Flag B',      2021, 31000000,  38000000),
  ('Project Dune',      'resort', 'Northwest Florida',   280, 'active',     'Independent', 2022, 105000000,118000000),
  ('Project Canvas',    'mixed',  'Metro Georgia',      null, 'review',     null,           2023, 38000000,  41000000),
  ('Project Briarwood', 'hotel',  'Suburban Tennessee',  142, 'renovation', 'Flag C',      2022, 24000000,  28000000);

insert into public.deals (name, market, type, rooms, ask_price, price_per_key, cap_rate, stage, score, expected_close) values
  ('Project Magnolia',    'Coastal Georgia',    'hotel',      88, 19000000, 215909, 6.8, 'prospecting',   62, null),
  ('Project Summit',      'East Tennessee',     'hotel',     160, 42000000, 262500, 5.9, 'prospecting',   55, null),
  ('Project Tidewater',   'Northwest Florida',  'resort',    280, 65000000, 232143, 7.1, 'loi',           74, '2026-06-30'),
  ('Project Lookout',     'Southeast Tennessee','hotel',     140, 28000000, 200000, 7.8, 'due_diligence', 81, '2026-05-15'),
  ('Project Cornerstone', 'Suburban Tennessee', 'commercial',null, 42000000, null,  6.2, 'closing',       91, '2026-04-01');
