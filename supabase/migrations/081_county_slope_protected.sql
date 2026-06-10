-- Migration 081: Phase-3 site layers — terrain slope (USGS 3DEP) + protected
-- land (USGS PAD-US 4.1) on county_geospatial_data.
--
-- Both are STATIC sources (terrain + protected-area boundaries change on
-- multi-year cadences), so they follow the committed-artifact + upsert pattern
-- (mirrors nmtc_lic): a local seed derives the per-county metric from the
-- authoritative source, commits an artifact, and the prod handler upserts it.
-- Additive + nullable — the score engine applies NO penalty while a column is
-- null (same partial-input discipline as wetland/farmland/flood). Ingest no-ops
-- until applied; Aden applies.
--
-- Slope (USGS 3DEP Bare-Earth DEM ImageServer, "Slope Degrees" rendering rule):
--   slope_developable_pct  numeric — % of county terrain at <=10% grade (5.71°),
--                                    the solar-buildable share (observed 3DEP;
--                                    the 10% line is Tractova's disclosed synthesis)
--   slope_mean_deg         numeric — mean county slope in degrees (context)
--
-- Protected land (USGS PAD-US 4.1 Uni_Counties summary, GAP status):
--   protected_area_pct     numeric — GAP 1+2 (strict protection) acres / county
--                                    land acres × 100 (observed PAD-US; the GAP
--                                    1+2 cut + thresholds are disclosed synthesis)
--
-- Scoring (defaults pending Aden's weight sign-off; see scoreEngine.js):
--   slopeWarning      = slope_developable_pct < 40   (terrain-limited county)
--   protectedWarning  = protected_area_pct  >= 40    (land-supply locked up)

alter table county_geospatial_data
  add column if not exists slope_developable_pct numeric,   -- 0-100
  add column if not exists slope_mean_deg         numeric,   -- 0-90
  add column if not exists slope_last_updated      timestamptz,
  add column if not exists protected_area_pct       numeric,  -- 0-100 (GAP 1+2)
  add column if not exists protected_gap123_pct     numeric,  -- 0-100 (GAP 1+2+3; context)
  add column if not exists protected_last_updated   timestamptz;

comment on column county_geospatial_data.slope_developable_pct is
  'USGS 3DEP: % of county terrain at <=10% grade (solar-buildable share). Observed (3DEP); the 10% grade line is Tractova disclosed synthesis. <40% drives a site-score penalty.';
comment on column county_geospatial_data.slope_mean_deg is
  'USGS 3DEP: mean county slope in degrees. Context only (not scored directly).';
comment on column county_geospatial_data.protected_area_pct is
  'USGS PAD-US 4.1: GAP-status 1+2 (strict protection) share of county land area. Observed (PAD-US); the GAP 1+2 cut + thresholds are disclosed synthesis. >=40% drives a site-score penalty.';
comment on column county_geospatial_data.protected_gap123_pct is
  'USGS PAD-US 4.1: GAP-status 1+2+3 share of county land (adds multiple-use land that CAN sometimes host energy). Context only.';

notify pgrst, 'reload schema';
