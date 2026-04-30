-- Migration 036: nmtc_lic_data — IRA §48(e) Category 1 (Low-Income Community)
-- bonus credit eligibility per county
--
-- Derives NMTC Low-Income Community tract designations from raw Census ACS
-- 2018-2022 5-year data per the CDFI Fund's published methodology:
--
--   A census tract qualifies as a Low-Income Community (LIC) for NMTC and
--   §48(e) Category 1 purposes if EITHER:
--     (a) Tract poverty rate >= 20%
--     (b) Tract median family income <= 80% of statewide median family income
--         (or, for metro tracts, 80% of MSA MFI -- v1 uses statewide as a
--          conservative approximation; metro tracts in high-MFI MSAs may be
--          slightly under-counted)
--
-- Customer impact: §48(e) Category 1 unlocks +10% ITC bonus credit on
-- community-solar facilities <= 5 MW located in LIC tracts. Stacks with
-- the IRA §45/§48 Energy Community bonus (energy_community_data) for up
-- to 50% effective ITC vs the 30% base.
--
-- Source: US Census ACS 2018-2022 5-year (CDFI Fund's input data) +
-- CDFI Fund's NMTC LIC eligibility methodology applied per tract.
--
-- This table stores PER-COUNTY rollups (count of qualifying tracts) since
-- our project granularity is state+county. Tract-level details are kept in
-- the qualifying_tract_geoids array for drill-down or per-site verification.
--
-- v1 limitation acknowledged: §48(e) Categories 2-4 (Indian Land, low-income
-- residential, low-income economic benefit) require additional data layers
-- not yet integrated. Category 1 (NMTC LIC) is the primary-path for typical
-- community-solar projects and worth ~$1-2M of bonus credit on a 5MW system.

create table if not exists nmtc_lic_data (
  county_fips                  text primary key,                  -- 5-digit FIPS (state+county)
  state                        text not null,                     -- USPS state code
  county_name                  text,
  total_tracts_in_county       int not null default 0,            -- denominator
  qualifying_tracts_count      int not null default 0,            -- # of NMTC LIC eligible tracts
  qualifying_via_poverty       int not null default 0,            -- of those, # qualifying via >=20% poverty
  qualifying_via_low_mfi       int not null default 0,            -- of those, # qualifying via <=80% state MFI
  qualifying_tract_geoids      text[],                            -- 11-digit tract GEOIDs (cap 200)
  state_median_family_income   int,                               -- threshold benchmark used
  dataset_version              text default 'ACS 2018-2022 5-year',
  last_updated                 timestamptz not null default now(),
  source                       text not null default 'US Census ACS 2018-2022 5-yr + CDFI Fund NMTC LIC methodology'
);

create index if not exists nmtc_lic_data_state_idx
  on nmtc_lic_data (state);

create index if not exists nmtc_lic_data_qualifying_idx
  on nmtc_lic_data (county_fips)
  where qualifying_tracts_count > 0;

alter table nmtc_lic_data enable row level security;

drop policy if exists "nmtc_lic public read" on nmtc_lic_data;
create policy "nmtc_lic public read"
  on nmtc_lic_data for select
  using (true);

drop policy if exists "nmtc_lic admin insert" on nmtc_lic_data;
create policy "nmtc_lic admin insert"
  on nmtc_lic_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "nmtc_lic admin update" on nmtc_lic_data;
create policy "nmtc_lic admin update"
  on nmtc_lic_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
