-- Migration 077: county_geospatial_data — add FEMA NFHL flood columns
-- (2026-06 audit, Wave 3 / Site layers — third site constraint).
--
-- The Site sub-score becomes land × wetland × flood: a county's prevalence of
-- FEMA Special Flood Hazard Area (SFHA — the 100-yr floodplain, zones A*/V*)
-- is a real siting constraint (buildable acreage, insurability, permitting cost).
-- Populated incrementally by the geospatial_flood refresh (FEMA NFHL ArcGIS),
-- mirroring the NWI wetland columns. Purely ADDITIVE — every column is nullable,
-- so existing rows + scores are unaffected until the ingest lands data (the
-- score engine applies no flood penalty while flood_sfha_pct is null).
--
-- Idempotent (IF NOT EXISTS); Aden applies.

alter table county_geospatial_data
  add column if not exists flood_sfha_pct     numeric,      -- % of county land area in a Special Flood Hazard Area
  add column if not exists flood_category      text,         -- minimal | moderate | significant | severe (bucketed)
  add column if not exists flood_sfha_acres    numeric,      -- absolute SFHA acres (NFHL clipped to county)
  add column if not exists flood_last_updated  timestamptz;  -- last successful FEMA NFHL refresh for this county

comment on column county_geospatial_data.flood_sfha_pct is
  'Share of county land area within a FEMA NFHL Special Flood Hazard Area (100-yr floodplain). Observed (FEMA); the >=20% site-warning threshold + penalty are Tractova disclosed synthesis.';

notify pgrst, 'reload schema';
