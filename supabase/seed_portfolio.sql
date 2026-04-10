-- KWHP Real Portfolio Seed
-- Run in Supabase SQL editor
-- Deletes all existing assets then inserts the real portfolio

-- 1. Clear dependent tables first (cascades would handle assets, but be explicit)
truncate table public.financials   restart identity cascade;
truncate table public.comp_data    restart identity cascade;
truncate table public.asset_capex  restart identity cascade;
truncate table public.room_types   restart identity cascade;
truncate table public.assets       restart identity cascade;

-- 2. Insert real KWHP portfolio
insert into public.assets
  (name, type, market, brand, rooms, status, year_acquired, acquisition_price, notes)
values

-- ── DIRECT INVESTMENTS ─────────────────────────────────────────────────────

('Central Station Memphis',
 'hotel', 'Memphis, TN', 'Curio Collection by Hilton', 123, 'active',
 2019, null,
 'Historic 1914 railway terminal conversion. Adaptive reuse/boutique hotel in South Main Arts District.'),

('Embassy Suites Tuscaloosa',
 'hotel', 'Tuscaloosa, AL', 'Embassy Suites by Hilton', 154, 'active',
 2015, null,
 'All-suite Hilton flag near University of Alabama. Strong group and athletic event demand.'),

('Fairfield Inn & Suites New Orleans',
 'hotel', 'New Orleans, LA', 'Fairfield by Marriott', 103, 'active',
 2021, null,
 'Select-service Marriott in New Orleans market.'),

('Holiday Inn Express Cape Canaveral',
 'hotel', 'Cape Canaveral, FL', 'Holiday Inn Express', 150, 'active',
 null, null,
 'IHG flag serving Kennedy Space Center corridor leisure demand.'),

('Homewood Suites Jackson Hole',
 'hotel', 'Jackson, WY', 'Homewood Suites by Hilton', 41, 'active',
 2022, null,
 'Extended-stay Hilton in premium leisure/ski market. High RevPAR mountain destination.'),

('Kimpton Banneker Hotel',
 'hotel', 'Washington, DC', 'Kimpton / IHG', 144, 'active',
 2019, 42000000,
 'Luxury boutique hotel steps from the White House. Part of IHG''s Kimpton brand. Acquired ~$42M.'),

('The Mining Exchange',
 'hotel', 'Colorado Springs, CO', 'Independent', 117, 'active',
 2022, null,
 'Historic 1902 mining exchange building. Independent boutique, Curio consideration. Downtown Colorado Springs.'),

('Resort at Kapalua Bay',
 'resort', 'Maui, HI', 'Independent (St. Regis affiliation pending)', 146, 'active',
 2023, 33000000,
 '146 suites on Kapalua Bay, Maui. Acquired Nov 2023. Luxury resort repositioning; St. Regis flag under discussion.'),

('Windham Mountain Club',
 'resort', 'Windham, NY', 'Independent', null, 'active',
 2023, null,
 'Mountain resort/club adjacent to Windham Mountain ski area, Catskills NY. Acquired Apr 2023.'),

('Wolfe''s Hotel Moab',
 'hotel', 'Moab, UT', 'Independent', 66, 'active',
 2021, null,
 'Boutique independent hotel in Moab gateway market (Arches/Canyonlands). Leisure/outdoor-focused.'),

-- ── SOTHERLY HOTELS PORTFOLIO (acquired Feb 2026) ──────────────────────────

('Georgian Terrace',
 'hotel', 'Atlanta, GA', 'Independent', 326, 'active',
 2026, null,
 'Historic 1911 landmark hotel in Midtown Atlanta. Part of Sotherly Hotels portfolio acquisition Feb 2026.'),

('The DeSoto',
 'hotel', 'Savannah, GA', 'Independent', 245, 'active',
 2026, null,
 'Full-service historic hotel in Savannah historic district. Part of Sotherly portfolio acquisition Feb 2026.'),

('The Whitehall Houston',
 'hotel', 'Houston, TX', 'Independent', 259, 'active',
 2026, null,
 'Full-service hotel in downtown Houston. Part of Sotherly portfolio acquisition Feb 2026.'),

('Hotel Alba Tampa',
 'hotel', 'Tampa, FL', 'Tapestry Collection by Hilton', 222, 'active',
 2026, null,
 'Tapestry/Hilton flag in Tampa Westshore business district. Part of Sotherly portfolio acquisition Feb 2026.'),

('Hotel Ballast Wilmington',
 'hotel', 'Wilmington, NC', 'Tapestry Collection by Hilton', 272, 'active',
 2026, null,
 'Tapestry/Hilton flag on Wilmington riverfront. Part of Sotherly portfolio acquisition Feb 2026.'),

('Hyatt Centric Arlington',
 'hotel', 'Arlington, VA', 'Hyatt Centric', 318, 'active',
 2026, null,
 'Full-service Hyatt Centric near Pentagon/Reagan National Airport. Part of Sotherly portfolio acquisition Feb 2026.'),

('DoubleTree by Hilton Jacksonville Riverfront',
 'hotel', 'Jacksonville, FL', 'DoubleTree by Hilton', 293, 'active',
 2026, null,
 'Full-service Hilton flag on St. Johns River. Part of Sotherly portfolio acquisition Feb 2026.'),

('DoubleTree by Hilton Hollywood Beach Resort',
 'resort', 'Hollywood, FL', 'DoubleTree by Hilton', 311, 'active',
 2026, null,
 'Beachfront resort on Hollywood Beach, FL. Part of Sotherly portfolio acquisition Feb 2026.'),

('DoubleTree by Hilton Laurel',
 'hotel', 'Laurel, MD', 'DoubleTree by Hilton', 206, 'active',
 2026, null,
 'Full-service Hilton flag in Laurel MD (DC/Baltimore corridor). Part of Sotherly portfolio acquisition Feb 2026.'),

-- ── DISPOSED / REALIZED ────────────────────────────────────────────────────

('Harpeth Hotel Franklin',
 'hotel', 'Franklin, TN', 'Curio Collection by Hilton', null, 'disposed',
 null, null,
 'Boutique Curio hotel in Franklin TN. Sold Sept 2025.'),

('Hotel Indigo Atlanta Vinings',
 'hotel', 'Atlanta, GA', 'Hotel Indigo / IHG', null, 'disposed',
 null, null,
 'Boutique IHG flag in Atlanta Vinings neighborhood. Sold May 2022.'),

('Holiday Inn Express Jackson TN',
 'hotel', 'Jackson, TN', 'Holiday Inn Express', 92, 'disposed',
 null, null,
 'Select-service IHG flag. Realized/exited.'),

('Holiday Inn Express Gatlinburg',
 'hotel', 'Gatlinburg, TN', 'Holiday Inn Express', 115, 'disposed',
 null, null,
 'Select-service IHG flag in Gatlinburg leisure market. Realized/exited.');
