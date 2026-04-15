-- SOUL Portfolio Seed (anonymized)
-- All property names, markets, brands, and notes have been replaced with codenames.
-- Run in Supabase SQL editor

-- 1. Clear dependent tables first
truncate table public.financials   restart identity cascade;
truncate table public.comp_data    restart identity cascade;
truncate table public.asset_capex  restart identity cascade;
truncate table public.room_types   restart identity cascade;
truncate table public.assets       restart identity cascade;

-- 2. Insert anonymized portfolio
insert into public.assets
  (name, type, market, brand, rooms, status, year_acquired, acquisition_price, notes)
values

-- ── DIRECT INVESTMENTS ─────────────────────────────────────────────────────

('Project Terminus',
 'hotel', 'Mid-South Tennessee', 'Flag A', 111, 'active',
 2019, null, null),

('Project Crimson',
 'hotel', 'Central Alabama', 'Flag A', 167, 'active',
 2015, null, null),

('Project Delta',
 'hotel', 'Southeast Louisiana', 'Flag B', 94, 'active',
 2021, null, null),

('Project Launchpad',
 'hotel', 'Central Florida Coast', 'Flag C', 163, 'active',
 null, null, null),

('Project Teton',
 'hotel', 'Wyoming Mountain Region', 'Flag A', 37, 'active',
 2022, null, null),

('Project Monument',
 'hotel', 'DC Metro', 'Flag C', 156, 'active',
 2019, 38000000, null),

('Project Goldfield',
 'hotel', 'Central Colorado', 'Independent', 108, 'active',
 2022, null, null),

('Project Lanai',
 'resort', 'Hawaii', 'Independent', 131, 'active',
 2023, 29000000, null),

('Project Catskill',
 'resort', 'Hudson Valley', 'Independent', null, 'active',
 2023, null, null),

('Project Canyon',
 'hotel', 'Southern Utah', 'Independent', 72, 'active',
 2021, null, null),

-- ── PORTFOLIO ACQUISITION (acquired Feb 2026) ───────────────────────────────

('Project Peach',
 'hotel', 'Metro Georgia', 'Independent', 298, 'active',
 2026, null, null),

('Project Moss',
 'hotel', 'Coastal Georgia', 'Independent', 267, 'active',
 2026, null, null),

('Project Bayou',
 'hotel', 'Gulf Coast Texas', 'Independent', 241, 'active',
 2026, null, null),

('Project Harbor',
 'hotel', 'Tampa Bay', 'Flag A', 239, 'active',
 2026, null, null),

('Project Inlet',
 'hotel', 'Coastal Carolina', 'Flag A', 254, 'active',
 2026, null, null),

('Project Potomac',
 'hotel', 'DC Metro', 'Flag D', 293, 'active',
 2026, null, null),

('Project Osprey',
 'hotel', 'Northeast Florida', 'Flag A', 317, 'active',
 2026, null, null),

('Project Surf',
 'resort', 'South Florida', 'Flag A', 285, 'active',
 2026, null, null),

('Project Corridor',
 'hotel', 'DC Metro', 'Flag A', 219, 'active',
 2026, null, null),

-- ── DISPOSED / REALIZED ────────────────────────────────────────────────────

('Project Bluebell',
 'hotel', 'Middle Tennessee', 'Flag A', null, 'disposed',
 null, null, null),

('Project Vine',
 'hotel', 'Metro Georgia', 'Flag C', null, 'disposed',
 null, null, null),

('Project Crossroads',
 'hotel', 'West Tennessee', 'Flag C', 84, 'disposed',
 null, null, null),

('Project Ridge',
 'hotel', 'East Tennessee', 'Flag C', 128, 'disposed',
 null, null, null);
