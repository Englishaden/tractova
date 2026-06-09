-- Migration 080: nmtc_lic_tracts — tract-level §48(e) Category 1 LIC eligibility
-- for the optional address→census-tract lookup (Phase 2 keystone).
--
-- The county rollup (nmtc_lic_data) only answers "does this county contain ≥1
-- LIC tract" — county-binary, so ~88% of counties read eligible. This table
-- holds the per-TRACT determination so an address geocoded to its census tract
-- (api/handlers/_tract-resolve.js → US Census Geocoder) gets a PRECISE yes/no
-- for the §48(e) Category 1 +10% ITC bonus instead of the county proxy.
--
-- Source: the SAME authoritative determination as nmtc_lic_data — the DOE
-- "IRA §48(e) Bonus Credit Program Layers" Excel / CDFI CIMS NMTC LIC (ACS
-- 2016-2020). A tract is stored here when its NMTC_2020_pct > 0 (QUALIFY_MIN_PCT
-- in api/scrapers/_nmtcLic.js) — ~34,992 qualifying tracts nationally. Static:
-- re-seed via `node scripts/seed-nmtc-lic.mjs --apply` when the DOE vintage
-- changes (the table is the persistent store; the gitignored xlsx is the
-- re-downloadable source — no committed tract artifact).
--
-- Honesty: this is the census TRACT a site sits in, not the parcel; it screens
-- eligibility and is NOT the official IRS determination (verify with tax
-- counsel). Per-site verification still required.

create table if not exists nmtc_lic_tracts (
  geoid        text primary key,   -- 11-digit census tract GEOID (state+county+tract)
  county_fips  text not null,      -- 5-digit county FIPS (the geoid prefix)
  state        text not null,      -- USPS state code
  nmtc_pct     numeric             -- % of the 2023 tract's land that is NMTC-eligible (>0 = stored)
);

create index if not exists nmtc_lic_tracts_county_idx on nmtc_lic_tracts (county_fips);

alter table nmtc_lic_tracts enable row level security;

drop policy if exists "nmtc_lic_tracts public read" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts public read"
  on nmtc_lic_tracts for select
  using (true);

drop policy if exists "nmtc_lic_tracts admin insert" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts admin insert"
  on nmtc_lic_tracts for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "nmtc_lic_tracts admin update" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts admin update"
  on nmtc_lic_tracts for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
