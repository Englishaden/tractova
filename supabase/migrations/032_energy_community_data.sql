-- Migration 032: energy_community_data — IRA §45 / §48 bonus credit eligibility
--
-- Per-county Energy Community designation. Live-pulled from DOE NETL EDX
-- ArcGIS FeatureServices -- the official Treasury-recognized data layer for
-- IRA Energy Community boundaries (Notice 2023-29 + 2023-45 + 2024-30).
--
-- Two qualification paths covered:
--   1. Coal Closure Communities — census tracts with mine closures since 1999
--      OR generator closures since 2009 (and adjacent tracts). Per-county
--      count of qualifying tracts.
--   2. MSA / Non-MSA Statistical Areas — qualified for both the fossil-fuel
--      employment threshold (FFE >= 0.17%) AND above-average unemployment.
--      Per-county boolean.
--
-- Brownfields are NOT covered here (point data; per-site lat/lng required;
-- developers verify at the brownfield level via energycommunities.gov).
--
-- A county qualifies for the +10% ITC bonus credit if EITHER path qualifies.
-- We compute is_energy_community at query time as
--   (qualifies_via_msa OR qualifies_via_coal_closure).
--
-- Source: DOE NETL EDX
--   2024_MSAs_NonMSAs_that_are_Energy_Communities/FeatureServer/0
--   2024_Coal_Closure_Energy_Communities/FeatureServer/0
-- Cadence: weekly (cheap to recheck; Treasury updates 1-2x/year).

create table if not exists energy_community_data (
  county_fips                  text primary key,                  -- 5-digit FIPS (state+county)
  state                        text not null,                     -- USPS state code
  county_name                  text not null,                     -- e.g. 'Choctaw County'
  county_name_normalized       text not null,                     -- lowercase, ' county' stripped, for lookups
  qualifies_via_msa            boolean not null default false,
  qualifies_via_coal_closure   boolean not null default false,
  msa_area_name                text,                              -- e.g. 'Houma-Thibodaux, LA Metro Area'
  coal_closure_tract_count     int not null default 0,
  ffe_qualified                boolean not null default false,    -- FFE >= 0.17% threshold
  ec_qualified                 boolean not null default false,    -- meets full IRA criteria
  dataset_version              text,                              -- DOE EDX dataset version
  last_updated                 timestamptz not null default now(),
  source                       text not null default 'DOE NETL EDX (Treasury IRA §45/§48 designations) 2024'
);

create index if not exists energy_community_data_state_idx
  on energy_community_data (state);

create index if not exists energy_community_data_state_name_idx
  on energy_community_data (state, county_name_normalized);

create index if not exists energy_community_data_qualifies_idx
  on energy_community_data (county_fips)
  where qualifies_via_msa = true OR qualifies_via_coal_closure = true;

alter table energy_community_data enable row level security;

drop policy if exists "energy_community public read" on energy_community_data;
create policy "energy_community public read"
  on energy_community_data for select
  using (true);

drop policy if exists "energy_community admin insert" on energy_community_data;
create policy "energy_community admin insert"
  on energy_community_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "energy_community admin update" on energy_community_data;
create policy "energy_community admin update"
  on energy_community_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
