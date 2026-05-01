-- Migration 039: county_geospatial_data — per-county wetland coverage + prime
-- farmland percentage derived from live geospatial sources.
--
-- Closes the Site Control coverage gap from d4061d2 for ALL 3,142 counties /
-- all 50 states. Replaces curated booleans in county_intelligence (only 18 of
-- 50 states seeded) with derived signals from authoritative federal data.
--
-- Data sources:
--   wetland_coverage_pct
--     USFWS National Wetlands Inventory (NWI) ArcGIS MapServer.
--     Per-county aggregate via outStatistics on Wetlands.ACRES with WHERE
--     WETLAND_TYPE NOT IN ('Lake', 'Estuarine and Marine Deepwater'), filtered
--     by simplified TIGER county polygon. Raw % can exceed 100% due to
--     polygon overlap + water inclusion — wetland_category is the cleaner
--     categorical signal for UI / scoring.
--
--   prime_farmland_pct
--     USDA SSURGO Soil Data Access (T-SQL). Per-survey-area aggregate of
--     mapunit.muacres where farmlndcl IN (prime farmland classes), divided by
--     total muacres. areasymbol → county_fips: ST + last 3 digits for 49 of
--     50 states. AK / CT / RI handled separately (see refresh script).
--
-- Scoring thresholds (calibrated 2026-05-01 against ~9 known counties via
-- scripts/probe-geospatial.mjs):
--   wetlandWarning = wetland_coverage_pct >= 15  (or wetland_category in
--                    ('significant','severe'))
--   availableLand  = prime_farmland_pct >= 25
--
-- Cadence: SSURGO refresh weekly (cheap, ~5s for whole US). NWI refresh
-- quarterly (expensive — ~6h serial, but underlying inventory updates
-- semi-annually so weekly cadence would be wasted compute).

create table if not exists county_geospatial_data (
  county_fips                  text primary key,                  -- 5-digit FIPS (state+county); joins to county_acs_data, energy_community_data, nmtc_lic_data, hud_qct_dda_data
  state                        text not null,                     -- USPS state code

  -- Wetland coverage (NWI)
  wetland_coverage_pct         numeric,                           -- 0-200+ (raw % can exceed 100 from polygon overlap; see comment above)
  wetland_category             text,                              -- 'minimal' | 'moderate' | 'significant' | 'severe'
  wetland_feature_count        int,
  wetland_acres                numeric,
  wetland_last_updated         timestamptz,
  wetland_source               text default 'USFWS National Wetlands Inventory (NWI) ArcGIS MapServer',

  -- Prime farmland (SSURGO)
  prime_farmland_pct           numeric,                           -- 0-100
  prime_farmland_acres         numeric,
  total_surveyed_acres         numeric,
  ssurgo_areasymbol            text,                              -- e.g. 'IL031' — null/unknown for AK boroughs not in NRCS coverage
  farmland_last_updated        timestamptz,
  farmland_source              text default 'USDA SSURGO Soil Data Access (T-SQL aggregate of farmlndcl prime classes)',

  -- Bookkeeping
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create index if not exists county_geospatial_data_state_idx
  on county_geospatial_data (state);

create index if not exists county_geospatial_data_wetland_warning_idx
  on county_geospatial_data (county_fips)
  where wetland_coverage_pct >= 15;

create index if not exists county_geospatial_data_available_land_idx
  on county_geospatial_data (county_fips)
  where prime_farmland_pct >= 25;

create trigger county_geospatial_data_updated_at
before update on county_geospatial_data
for each row execute function touch_updated_at();

alter table county_geospatial_data enable row level security;

drop policy if exists "county_geospatial public read" on county_geospatial_data;
create policy "county_geospatial public read"
  on county_geospatial_data for select
  using (true);

drop policy if exists "county_geospatial admin insert" on county_geospatial_data;
create policy "county_geospatial admin insert"
  on county_geospatial_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "county_geospatial admin update" on county_geospatial_data;
create policy "county_geospatial admin update"
  on county_geospatial_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
