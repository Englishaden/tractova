-- Migration 027: county_acs_data
--
-- V3 Wave 2 — county-level extension of the Census ACS pipeline. Per-county
-- LMI density + population, populated by the
-- /api/refresh-data?source=county_acs cron handler. Same data source +
-- methodology as state-level lmi_data (migration 025), but at county
-- granularity for use in Lens analysis (developer specifies county →
-- gets county-specific LMI subscriber-sourcing intel).
--
-- Coverage at first run: all ~3,142 US counties (Census API supports
-- a single national pull). After validation we filter to states we
-- track if needed.
--
-- Key design choice: county_fips as 5-digit primary key (2-digit state
-- + 3-digit county FIPS). This matches Census's natural identifier and
-- avoids state-name ambiguity (Washington County exists in 31 states).

create table if not exists county_acs_data (
  county_fips             text primary key,                  -- 5-digit FIPS (state+county)
  state                   text not null,                     -- USPS state code (IL, NY, ...)
  county_name             text not null,                     -- e.g. 'Will County, Illinois'
  total_households        int,
  lmi_households          int,                               -- households at <=80% AMI (state-level AMI)
  lmi_pct                 numeric,
  median_household_income int,
  ami_80pct               int,                               -- inherited from state median * 0.80
  total_population        int,
  last_updated            timestamptz not null default now(),
  source                  text not null default 'US Census ACS 2018-2022 5-year (live pull)'
);

create index if not exists county_acs_data_state_idx on county_acs_data (state);
create index if not exists county_acs_data_lmi_pct_idx on county_acs_data (lmi_pct desc);

alter table county_acs_data enable row level security;

drop policy if exists "county_acs_data public read" on county_acs_data;
create policy "county_acs_data public read"
  on county_acs_data for select
  using (true);

drop policy if exists "county_acs_data admin insert" on county_acs_data;
create policy "county_acs_data admin insert"
  on county_acs_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "county_acs_data admin update" on county_acs_data;
create policy "county_acs_data admin update"
  on county_acs_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
