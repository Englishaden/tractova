-- Migration 025: lmi_data
--
-- V3 Wave 2 — Subscriber Acquisition Intel slice. State-level LMI
-- (Low-to-Moderate Income, ≤80% of Area Median Income) household
-- statistics from US Census ACS 2022 5-year estimates.
--
-- Powers the StateDetailPanel "Subscribers" tab (previously a V3-plan
-- placeholder per `Tractova_V3_Plan.md` §2). Future Phase 2 will add
-- a `refresh-lmi-data.js` cron that hits the Census ACS API annually
-- to keep these values current; for now we hardcode 2022 5-year
-- estimates which won't drift materially year-over-year.
--
-- Seed coverage: 8 core CS states (IL, NY, MA, MN, CO, NJ, ME, MD).
-- Other states fall back to nationwide median (38% LMI) in the data
-- accessor.
--
-- Source: US Census ACS 5-year (2018-2022). Approximations are at the
-- state-aggregate level (county-level seeding deferred to Phase 2 cron).

create table if not exists lmi_data (
  state                   text primary key,
  state_name              text not null,
  total_households        int  not null,                                 -- approximate, 2022 5-yr
  lmi_households          int  not null,                                 -- households at <=80% AMI
  lmi_pct                 numeric not null check (lmi_pct between 0 and 100),
  median_household_income int  not null,                                 -- $/yr
  ami_80pct               int  not null,                                 -- 80% AMI threshold $/yr
  last_updated            timestamptz not null default now(),
  source                  text not null default 'US Census ACS 2018-2022 5-year estimates'
);

-- Public read (any signed-in user). Writes admin-only via service role
-- (mirrors the puc_dockets / comparable_deals pattern).
alter table lmi_data enable row level security;

drop policy if exists "lmi_data public read" on lmi_data;
create policy "lmi_data public read"
  on lmi_data for select
  using (true);

drop policy if exists "lmi_data admin insert" on lmi_data;
create policy "lmi_data admin insert"
  on lmi_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "lmi_data admin update" on lmi_data;
create policy "lmi_data admin update"
  on lmi_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: 8 core CS states + a few Tier 2 states so the SubscribersTab has
-- meaningful data on first ship. Numbers are state-aggregate ACS estimates.
-- ─────────────────────────────────────────────────────────────────────────────
insert into lmi_data (state, state_name, total_households, lmi_households, lmi_pct, median_household_income, ami_80pct) values
  -- 8 core CS states
  ('IL', 'Illinois',       4998000, 1899240, 38.0, 76708, 61366),
  ('NY', 'New York',       7510000, 3079100, 41.0, 75157, 60126),
  ('MA', 'Massachusetts',  2727000,  954450, 35.0, 96505, 77204),
  ('MN', 'Minnesota',      2261000,  723520, 32.0, 84313, 67450),
  ('CO', 'Colorado',       2293000,  710830, 31.0, 87598, 70078),
  ('NJ', 'New Jersey',     3387000, 1185450, 35.0, 96346, 77077),
  ('ME', 'Maine',           601000,  216360, 36.0, 68251, 54601),
  ('MD', 'Maryland',       2326000,  791840, 34.0, 98461, 78769),
  -- Mid-coverage states (Tier 2) — useful for visitors prospecting adjacent markets
  ('CA', 'California',    13234000, 5161260, 39.0, 91551, 73241),
  ('TX', 'Texas',         11157000, 4239660, 38.0, 73035, 58428),
  ('AZ', 'Arizona',        2854000, 1056980, 37.0, 72581, 58065),
  ('NC', 'North Carolina', 4205000, 1640950, 39.0, 66186, 52949),
  ('OR', 'Oregon',         1696000,  559680, 33.0, 76362, 61090),
  ('VA', 'Virginia',       3354000, 1140360, 34.0, 87249, 69799),
  ('NV', 'Nevada',         1185000,  450300, 38.0, 71646, 57317),
  ('FL', 'Florida',        8294000, 3400540, 41.0, 67917, 54334),
  ('OH', 'Ohio',           4775000, 1813000, 38.0, 66990, 53592),
  ('PA', 'Pennsylvania',   5198000, 1923260, 37.0, 73170, 58536)
on conflict (state) do update set
  state_name              = excluded.state_name,
  total_households        = excluded.total_households,
  lmi_households          = excluded.lmi_households,
  lmi_pct                 = excluded.lmi_pct,
  median_household_income = excluded.median_household_income,
  ami_80pct               = excluded.ami_80pct,
  last_updated            = now();

notify pgrst, 'reload schema';
