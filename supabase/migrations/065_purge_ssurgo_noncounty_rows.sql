-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 065: purge SSURGO survey-area artifacts from county_geospatial_data
--
-- Root cause: api/scrapers/_refresh-geospatial-farmland.js derived county_fips
-- from ssurgo_areasymbol as ST + 3-digit suffix. SSURGO has SPECIAL survey areas
-- with suffixes ≥600 (national parks, reservations, multi-county soil surveys)
-- that pass the /^\d{3}$/ check but build a FIPS that is NOT a real county
-- (e.g. FL608 → 12608). 826 such spurious rows accumulated — county_geospatial_data
-- had 3,969 rows vs ~3,143 real counties. (Surfaced by scripts/coverage-matrix.mjs
-- + characterized by scripts/probe-county-geo-dups.mjs, 2026-05-22.)
--
-- The scraper is now gated on the canonical county FIPS set (validFips) so these
-- artifacts won't recur. This migration removes the existing ones.
--
-- SAFE: deletes ONLY rows whose county_fips is not a real county (not present in
-- county_acs_data, the canonical 3,143). Verified 0 real counties are missing
-- geospatial coverage — no real wetland/farmland data is lost. ~826 rows removed.
--
-- Reversible: re-running the SSURGO + NWI ingests repopulates real-county rows;
-- the purged rows were never valid counties to begin with.
-- ─────────────────────────────────────────────────────────────────────────────

-- Sanity peek before the delete (run manually if desired):
--   select count(*) as spurious from county_geospatial_data g
--   where not exists (select 1 from county_acs_data a where a.county_fips = g.county_fips);

delete from county_geospatial_data g
where not exists (
  select 1 from county_acs_data a where a.county_fips = g.county_fips
);
