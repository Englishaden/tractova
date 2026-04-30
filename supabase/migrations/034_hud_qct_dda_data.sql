-- Migration 034: hud_qct_dda_data — federal LIHTC designation overlay per county
--
-- Per-county Qualified Census Tract count + non-metro Difficult Development
-- Area flag. Live-pulled from HUD User ArcGIS FeatureServers -- the official
-- HUD-published LIHTC designation layers for the 2026 program year.
--
-- Why this matters for community solar: counties with high QCT density have
-- concentrated low-income household populations. Several state CS programs
-- give bonus credits / faster queue placement for projects with QCT-overlap
-- subscriber bases. Surfacing the count alongside our ACS-derived LMI
-- density gives developers two complementary signals:
--   - lmi_pct (ACS): % of households at <=80% AMI, distribution across county
--   - qct_count (HUD): # of federally-designated LIHTC tracts in county
--
-- DDA scope: only NON-METRO DDAs are county-level (DDA_CODE parses to
-- 5-digit FIPS). Metro DDAs are designated at ZCTA level and require a
-- ZCTA->county crosswalk we don't carry today; deferred to v2.
--
-- Sources (effective Jan 1 2026):
--   QUALIFIED_CENSUS_TRACTS_2026  -- per-tract; rolled up to county count
--   Difficult_Development_Areas_2026 -- per-ZCTA (metro) or per-county (NM)
-- Cadence: weekly cron recheck (HUD updates the LIHTC year designations
--   annually, but a weekly recheck is cheap and surfaces shifts immediately).

create table if not exists hud_qct_dda_data (
  county_fips                  text primary key,                  -- 5-digit FIPS (state+county)
  state                        text not null,                     -- USPS state code
  county_name                  text,                              -- best-effort from QCT NAME or DDA_NAME
  qct_count                    int not null default 0,            -- # of QCTs in this county
  qct_tract_geoids             text[],                            -- 11-digit tract GEOIDs in county
  is_non_metro_dda             boolean not null default false,    -- DDA_TYPE='NM' rolls up to county
  dda_name                     text,                              -- e.g. 'Sussex County'
  dda_code                     text,                              -- HUD's NCNTY... code
  dataset_year                 int default 2026,
  last_updated                 timestamptz not null default now(),
  source                       text not null default 'HUD User QCT 2026 + DDA 2026 (LIHTC designation layers)'
);

create index if not exists hud_qct_dda_state_idx
  on hud_qct_dda_data (state);

create index if not exists hud_qct_dda_qct_count_idx
  on hud_qct_dda_data (county_fips)
  where qct_count > 0;

create index if not exists hud_qct_dda_dda_idx
  on hud_qct_dda_data (county_fips)
  where is_non_metro_dda = true;

alter table hud_qct_dda_data enable row level security;

drop policy if exists "hud_qct_dda public read" on hud_qct_dda_data;
create policy "hud_qct_dda public read"
  on hud_qct_dda_data for select
  using (true);

drop policy if exists "hud_qct_dda admin insert" on hud_qct_dda_data;
create policy "hud_qct_dda admin insert"
  on hud_qct_dda_data for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "hud_qct_dda admin update" on hud_qct_dda_data;
create policy "hud_qct_dda admin update"
  on hud_qct_dda_data for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
