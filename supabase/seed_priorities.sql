-- ══════════════════════════════════════════════════════════════════════════════
-- KWHP 30.60.90 Priorities Seed — Q1 2026
-- Run in Supabase SQL editor AFTER running the tasks migration.
-- Assets must already exist with these exact names.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Assign fund and MVP captain to each asset
update public.assets set fund = 'KWHP I',  mvp_captain = 'JJS' where name = 'Moab';
update public.assets set fund = 'KWHP I',  mvp_captain = 'DR'  where name = 'DC';
update public.assets set fund = 'KWHP I'                        where name = 'NOLA';
update public.assets set fund = 'KWHP I',  mvp_captain = 'DR'  where name = 'Cape';
update public.assets set fund = 'KWHP I'                        where name = 'Hollywood';
update public.assets set fund = 'KWHP I'                        where name = 'RS';

update public.assets set fund = 'KWHP II', mvp_captain = 'DR'  where name = 'Minings';
update public.assets set fund = 'KWHP II'                       where name = 'Tuscaloosa';
update public.assets set fund = 'KWHP II', mvp_captain = 'ZS'  where name = 'WMC';
update public.assets set fund = 'KWHP II', mvp_captain = 'JJS' where name = 'Kapalua Bay';
update public.assets set fund = 'KWHP II'                       where name = 'ER';
update public.assets set fund = 'KWHP II'                       where name = 'Nashville JIT';
update public.assets set fund = 'KWHP II'                       where name = 'Casago';
update public.assets set fund = 'KWHP II'                       where name = 'JH';
update public.assets set fund = 'KWHP II', mvp_captain = 'ZS'  where name = 'SOHO';

update public.assets set fund = 'Other',   mvp_captain = 'MTW' where name = 'Central Station';


-- 2. Seed all tasks
insert into public.tasks (asset_id, item, poc, due_date, status, update_notes, sort_order) values

-- ── KWHP I · Moab ─────────────────────────────────────────────────────────────
((select id from public.assets where name = 'Moab' limit 1),
 'Address Hilton Franchise timeline / ability to initiate process',
 'DR', '2026-02-28', 'Complete',
 'FDD period expires March 5. Move forward with franchise docs.', 10),

((select id from public.assets where name = 'Moab' limit 1),
 'Internal re-UW for hold execution — present to IC (Sale vs Re-investment comparative)',
 'SS', '2026-02-28', 'Complete',
 'Complete. Move towards executing Tap conversion with Schulte.', 20),

((select id from public.assets where name = 'Moab' limit 1),
 '2026 capex & carry needs analysis',
 'SA', '2026-04-15', 'Ongoing',
 'SHG conducting by-month forecast.', 30),

((select id from public.assets where name = 'Moab' limit 1),
 'SHG 2026 budget & UW Pro Forma (DR to opine)',
 'DR', null, 'Ongoing', null, 40),

((select id from public.assets where name = 'Moab' limit 1),
 'Consider / explore alternative buyer ($12.5mm)?',
 'SS', '2026-04-15', 'Not Started',
 'Alternate buyer available to re-engage, but indicated sub-$12mm value.', 50),

((select id from public.assets where name = 'Moab' limit 1),
 'Negotiate SHG HMA, prep for execution/transition',
 'JJS', null, 'Ongoing',
 'McLean to socialize with DS and pass to Jay.', 60),

((select id from public.assets where name = 'Moab' limit 1),
 'Execute HLT franchise',
 'JJS', null, 'Ongoing',
 'McLean to socialize with DS and pass to Jay.', 70),

((select id from public.assets where name = 'Moab' limit 1),
 'Initiate PIP pricing / scope',
 'JJS', null, 'Ongoing',
 'JJS to rundown, looping DR/Mc as needed.', 80),

((select id from public.assets where name = 'Moab' limit 1),
 'Address operational AM resources for 24-month timeline',
 null, null, 'Not Started', null, 90),

((select id from public.assets where name = 'Moab' limit 1),
 'Navigate TBK situation / potential new debt process',
 'CC', null, 'Ongoing', null, 100),

((select id from public.assets where name = 'Moab' limit 1),
 'Execute SHG transition',
 'JJS', '2026-05-01', 'Ongoing', null, 110),

((select id from public.assets where name = 'Moab' limit 1),
 'Onramp operational AM resource & PIP leader',
 null, '2026-04-30', 'Not Started', null, 120),

((select id from public.assets where name = 'Moab' limit 1),
 'Outline 2026 asset level master keys',
 null, '2026-05-31', 'Not Started', null, 130),


-- ── KWHP I · DC ───────────────────────────────────────────────────────────────
((select id from public.assets where name = 'DC' limit 1),
 'Release FF&E scope for order',
 'DR', '2026-02-28', 'Not Started', null, 10),

((select id from public.assets where name = 'DC' limit 1),
 'Present HHM UW / Manager change for IC',
 'DR', '2026-02-28', 'Complete', null, 20),

((select id from public.assets where name = 'DC' limit 1),
 'Execute CPSA amendment and ancillary docs',
 'JL', null, 'Not Started', null, 30),

((select id from public.assets where name = 'DC' limit 1),
 'WAB paydown and replenishments',
 'CC', null, 'Not Started', null, 40),

((select id from public.assets where name = 'DC' limit 1),
 'Finalize permit drawings',
 'DR', null, 'Not Started', null, 50),

((select id from public.assets where name = 'DC' limit 1),
 'Onboard Whitelabel to shepherd manager change',
 'DR', null, 'Not Started', null, 60),

((select id from public.assets where name = 'DC' limit 1),
 'Execute HMA / initiate manager change',
 'DR', null, 'Not Started', null, 70),

((select id from public.assets where name = 'DC' limit 1),
 'Communicate DC change and Cape sale to Valor',
 'DR', '2026-03-31', 'Complete', null, 80),

((select id from public.assets where name = 'DC' limit 1),
 'Bid multiple GCs',
 'DR', null, 'Not Started', null, 90),

((select id from public.assets where name = 'DC' limit 1),
 'Secure permit amendment',
 'DR', null, 'Not Started', null, 100),

((select id from public.assets where name = 'DC' limit 1),
 'Finalize renovation timeline with orders placed',
 'DR', null, 'Not Started', null, 110),

((select id from public.assets where name = 'DC' limit 1),
 'Transition to HHM with 100-day plan',
 'DR', null, 'Not Started', null, 120),

((select id from public.assets where name = 'DC' limit 1),
 'Execute GC contract',
 'DR', null, 'Not Started', null, 130),

((select id from public.assets where name = 'DC' limit 1),
 'Outline 2026 asset level master keys with WL',
 'DR', null, 'Not Started', null, 140),

((select id from public.assets where name = 'DC' limit 1),
 'Start construction',
 'DR', null, 'Not Started', null, 150),

((select id from public.assets where name = 'DC' limit 1),
 'Finalize COA budgets and allocations',
 'JL', null, 'Not Started', null, 160),

((select id from public.assets where name = 'DC' limit 1),
 'WL / manager accountability',
 'DR', null, 'Not Started', null, 170),


-- ── KWHP I · NOLA ─────────────────────────────────────────────────────────────
((select id from public.assets where name = 'NOLA' limit 1),
 'Outline 2026 asset level master keys with WL',
 'DR', '2026-04-30', 'Not Started', null, 10),

((select id from public.assets where name = 'NOLA' limit 1),
 'Monitor performance and pace thru Q1',
 'DR', '2026-04-30', 'Not Started', null, 20),

((select id from public.assets where name = 'NOLA' limit 1),
 'Re-UW in June with 1H pacing',
 'ZS', '2026-06-30', 'Not Started', null, 30),

((select id from public.assets where name = 'NOLA' limit 1),
 'Revisit IC on paydown, hold/sell discussion',
 'ZS', '2026-06-30', 'Not Started', null, 40),


-- ── KWHP I · Cape ─────────────────────────────────────────────────────────────
((select id from public.assets where name = 'Cape' limit 1),
 'Present broker BOV',
 'JJS', '2026-02-28', 'Complete', null, 10),

((select id from public.assets where name = 'Cape' limit 1),
 'Broker selection and launch sale process',
 'JJS', '2026-03-21', 'Complete', null, 20),

((select id from public.assets where name = 'Cape' limit 1),
 'Guide process to CFO',
 'JJS', null, 'Complete', null, 30),

((select id from public.assets where name = 'Cape' limit 1),
 'DD window and close',
 'JJS', null, 'Ongoing',
 '45 + 30 with Peachtree at $40mm.', 40),


-- ── KWHP I · Hollywood ────────────────────────────────────────────────────────
((select id from public.assets where name = 'Hollywood' limit 1),
 'Brainstorm alternative structure with MIG team re: F&B/manager labor costs',
 'ZS', '2026-04-30', 'Not Started', null, 10),


-- ── KWHP I · RS ───────────────────────────────────────────────────────────────
((select id from public.assets where name = 'RS' limit 1),
 'Finalize and execute amendments',
 'SS', '2026-02-28', 'Complete', null, 10),

((select id from public.assets where name = 'RS' limit 1),
 'Facilitate HICV''s first pre-payment (for interest reserve)',
 'SS', '2026-02-28', 'Complete', null, 20),

((select id from public.assets where name = 'RS' limit 1),
 'Finish punchwork on unit floors and final GC closeout / demobilization',
 'SS', '2026-04-30', 'Ongoing',
 'Waiting on a few custom panels and other parts to arrive, but 99% complete.', 30),

((select id from public.assets where name = 'RS' limit 1),
 'Reach resolution on CO — either successful receipt or begin Class A to Class B conversion',
 'SS', '2026-04-30', 'Not Started',
 'Webb onsite in NY week of 4/13.', 40),

((select id from public.assets where name = 'RS' limit 1),
 'Facilitate HICV''s second pre-payment ($3mm leakage to Fund 1)',
 'SS', '2026-07-31', 'Not Started', null, 50),


-- ── KWHP II · Minings ─────────────────────────────────────────────────────────
((select id from public.assets where name = 'Minings' limit 1),
 'Initiate Schulte on Wyndham / cost-based UW',
 'DR', '2026-02-28', 'Not Started', null, 10),

((select id from public.assets where name = 'Minings' limit 1),
 'Present IC with internal UW for mgmt. change (branded/non-branded)',
 'DR', '2026-03-31', 'Not Started', null, 20),

((select id from public.assets where name = 'Minings' limit 1),
 'Determine transition / hold / sell decision & develop cascading plan',
 'DR', '2026-03-31', 'Not Started', null, 30),

((select id from public.assets where name = 'Minings' limit 1),
 'Onboard Whitelabel if hold',
 'DR', '2026-04-15', 'Not Started', null, 40),

((select id from public.assets where name = 'Minings' limit 1),
 'Outline 2026 asset level master keys with WL',
 'DR', '2026-04-30', 'Not Started', null, 50),


-- ── KWHP II · Tuscaloosa ──────────────────────────────────────────────────────
((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Update math for ''26 takeout with sale/recap scenarios for fund and common',
 'ZS', '2026-02-28', 'Complete', null, 10),

((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Launch refi process (target March/April close)',
 'CC', '2026-03-31', 'Complete', null, 20),

((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Outline reno plan and restaurant budget',
 'MW', '2026-03-31', 'Not Started', null, 30),

((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Outline 2026 asset level master keys with WL',
 'DR', '2026-03-31', 'Not Started', null, 40),

((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Close refi',
 'CC', '2026-04-30', 'Complete', null, 50),

((select id from public.assets where name = 'Tuscaloosa' limit 1),
 'Update common with refi plan + present sale/recap scenarios',
 'ZS', '2026-04-30', 'Not Started',
 'BOV in hand and updating memo for IC.', 60),


-- ── KWHP II · WMC ─────────────────────────────────────────────────────────────
((select id from public.assets where name = 'WMC' limit 1),
 'Evaluate Newmark execution of townhomes',
 'WW', '2026-03-15', 'Complete',
 'Improbable to find TH-only equity. Possible interest as resort co, but challenging as passive LP.', 10),

((select id from public.assets where name = 'WMC' limit 1),
 'Manage toward member sales strategy / resources',
 'WW', '2026-03-31', 'Complete',
 'Onboarded SOHO house exec and evaluating Will G.', 20),

((select id from public.assets where name = 'WMC' limit 1),
 'Initiate Wylder 2.0 WMC pow-wow',
 'ZS', '2026-03-31', 'Ongoing',
 'Legal situation still in flux — will engage once clear.', 30),

((select id from public.assets where name = 'WMC' limit 1),
 'Present IC with internal TH UW and hotel UW',
 'ZS', '2026-04-15', 'Ongoing',
 'Follow-up with FY27 lever cash flow and YE cash. Evaluate option of taking out lift loan; additional considerations to restructure mgmt fee and pursue additional pathway to grow rental mgmt pool.', 40),

((select id from public.assets where name = 'WMC' limit 1),
 'Land Guggenheim term sheet',
 'ZS', '2026-04-15', 'Not Started', null, 50),

((select id from public.assets where name = 'WMC' limit 1),
 'Engage / Don''t engage Newmark',
 'ZS', '2026-03-31', 'Complete',
 'Market thin and flipping toward internal BBF push.', 60),

((select id from public.assets where name = 'WMC' limit 1),
 'Engage Red on Capex Restart plans',
 'ZS', '2026-03-31', 'Complete',
 'Bi-weekly call established.', 70),

((select id from public.assets where name = 'WMC' limit 1),
 'Establish internal KW Master Keys for FY27',
 'ZS', '2026-04-30', 'Not Started', null, 80),

((select id from public.assets where name = 'WMC' limit 1),
 'Approve FY27 Budget',
 'ZS', '2026-04-30', 'Not Started', null, 90),

((select id from public.assets where name = 'WMC' limit 1),
 'Manage spring Capex on budget',
 'ZS', '2026-05-31', 'Not Started', null, 100),

((select id from public.assets where name = 'WMC' limit 1),
 'Execute towards spring close of financing',
 'ZS', '2026-05-31', 'Not Started', null, 110),

((select id from public.assets where name = 'WMC' limit 1),
 'Plan KWHP summer / fall event',
 'ZS', '2026-05-31', 'Not Started', null, 120),


-- ── KWHP II · Kapalua Bay ─────────────────────────────────────────────────────
((select id from public.assets where name = 'Kapalua Bay' limit 1),
 'Move all consolidations to AOAO',
 'JJS', '2026-03-31', 'Not Started', null, 10),

((select id from public.assets where name = 'Kapalua Bay' limit 1),
 'Finish 1/2 of Interior Renovation',
 'JJS', '2026-03-31', 'Not Started', null, 20),

((select id from public.assets where name = 'Kapalua Bay' limit 1),
 'Remove Montage',
 'JJS', '2026-03-31', 'Complete', null, 30),

((select id from public.assets where name = 'Kapalua Bay' limit 1),
 'Sign interim or long management agreement',
 'JJS', '2026-03-31', 'Complete', null, 40),

((select id from public.assets where name = 'Kapalua Bay' limit 1),
 'Finalize the Loan',
 'JJS', '2026-04-30', 'Not Started', null, 50),


-- ── KWHP II · ER ──────────────────────────────────────────────────────────────
((select id from public.assets where name = 'ER' limit 1),
 'Evaluate $25mm request @ 15% accruing + warrants; present to IC',
 'JJS', '2026-03-31', 'Not Started', null, 10),

((select id from public.assets where name = 'ER' limit 1),
 'Close Add-On investment',
 'JJS', '2026-04-30', 'Not Started', null, 20),


-- ── KWHP II · Nashville JIT ───────────────────────────────────────────────────
((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Secure approval and release of amended permits',
 'SS', '2026-02-28', 'Complete', null, 10),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Update schedule based on permit delay',
 'SS', '2026-02-28', 'Complete', null, 20),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Resolve ADA Issues with Plan of Attack',
 'SS', '2026-02-28', 'Complete', null, 30),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Begin guestroom floor turnover to FF&E, starting with 6th floor down',
 'SS', '2026-04-30', 'Ongoing',
 'Punch of 6th floor ongoing; recent TNL additions have extended this timeline.', 40),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Owners Lounge / Lobby rough-ins complete',
 'SS', '2026-04-30', 'Ongoing',
 'Owners Lounge rough-in 95% complete, should wrap in next 1–2 weeks.', 50),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Cabinetry and appliance deliveries begin',
 'SS', '2026-04-30', 'Not Started', null, 60),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Continue guestroom turnover to FF&E floor by floor',
 'SS', '2026-04-30', 'Not Started', null, 70),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Close ceilings, flooring install in Sales Center',
 'SS', '2026-04-30', 'Ongoing',
 '95% of walls closed and ceilings closure underway. Flooring 1–2 weeks out.', 80),

((select id from public.assets where name = 'Nashville JIT' limit 1),
 'Facilitate Third Takedown',
 'SS', '2026-05-31', 'Ongoing',
 'Everything moving forward for a May 7th takedown.', 90),


-- ── KWHP II · JH ──────────────────────────────────────────────────────────────
((select id from public.assets where name = 'JH' limit 1),
 'Revisit innkeeper execution or early sale with ''26 pacing',
 'ZS', '2026-03-31', 'Not Started',
 'Drafting memo for equitable/IC.', 10),


-- ── KWHP II · SOHO ────────────────────────────────────────────────────────────
((select id from public.assets where name = 'SOHO' limit 1),
 'Initiate brand ask',
 'MW', '2026-02-28', 'Complete', null, 10),

((select id from public.assets where name = 'SOHO' limit 1),
 'Complete closing cash reconcile',
 'SA', '2026-02-28', 'Complete', null, 20),

((select id from public.assets where name = 'SOHO' limit 1),
 'Outline and establish AM call/reporting streams',
 'DR', '2026-02-28', 'Complete', null, 30),

((select id from public.assets where name = 'SOHO' limit 1),
 'Finalize Pref Tender and Funding',
 'WW', '2026-03-31', 'Complete', null, 40),

((select id from public.assets where name = 'SOHO' limit 1),
 'Finalize corp. level transition checklist items',
 'RP', '2026-03-31', 'Not Started', null, 50),

((select id from public.assets where name = 'SOHO' limit 1),
 'File 10K',
 'JL', '2026-03-31', 'Complete',
 'Extension to 4/15.', 60),

((select id from public.assets where name = 'SOHO' limit 1),
 'Price Up-Brand PIPs',
 'DR', '2026-03-31', 'Complete', null, 70),

((select id from public.assets where name = 'SOHO' limit 1),
 'DY Adjustments Ask / rolling calc',
 'CC', '2026-03-31', 'Not Started',
 'Waiting to confirm benefits assumption and communicate update on brands, forecast, etc.', 80),

((select id from public.assets where name = 'SOHO' limit 1),
 'Brand negotiation in concept',
 'MW', '2026-04-15', 'Not Started',
 'In person 4/7.', 90),

((select id from public.assets where name = 'SOHO' limit 1),
 'Brand and loan docs — Hyatt',
 'JJS', '2026-04-30', 'Not Started', null, 100),

((select id from public.assets where name = 'SOHO' limit 1),
 'Complete Philly PIP',
 'SK', '2026-05-31', 'Not Started', null, 110),

((select id from public.assets where name = 'SOHO' limit 1),
 'Brand and loan docs — HIL/MAR',
 'JJS', '2026-05-31', 'Not Started', null, 120),


-- ── Other · Central Station ───────────────────────────────────────────────────
((select id from public.assets where name = 'Central Station' limit 1),
 'Secure loan extension and negotiate interest costs',
 'ZDS', '2026-02-28', 'Complete',
 'Completed through 5/6.', 10),

((select id from public.assets where name = 'Central Station' limit 1),
 'Updated CSH cash flow through extension period',
 'ZDS', '2026-02-28', 'Ongoing',
 'Current runway through June.', 20),

((select id from public.assets where name = 'Central Station' limit 1),
 'Secure WJE testing report',
 'ZDS', '2026-03-31', 'Complete',
 'Phase II onsite 4/7 with goal of 4/10 report.', 30),

((select id from public.assets where name = 'Central Station' limit 1),
 'Update CSH investors post go-forward',
 'MW', '2026-03-31', 'Not Started', null, 40),

((select id from public.assets where name = 'Central Station' limit 1),
 'Coordinate Indigo and CL for employee transition plan',
 'ZDS', '2026-03-31', 'Not Started', null, 50),

((select id from public.assets where name = 'Central Station' limit 1),
 'Notify parking and other required sale notices',
 'JL', '2026-03-31', 'Not Started', null, 60),

((select id from public.assets where name = 'Central Station' limit 1),
 'Negotiate and execute CL Key Money',
 'ZDS', '2026-04-30', 'Not Started', null, 70),

((select id from public.assets where name = 'Central Station' limit 1),
 'Close sale',
 'ZDS', '2026-05-09', 'Not Started', null, 80);
