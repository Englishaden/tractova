-- Migration 078: retune the flood columns from SFHA-% to FEMA NRI risk
-- (2026-06 audit, Wave 3 — FEMA flood ingest, slice 2).
--
-- Slice 1 (migration 077) provisioned SFHA-%-shaped columns assuming an NFHL
-- per-county area-clip. Aden chose the FEMA National Risk Index (NRI) county
-- layer instead — clean county-keyed data (no error-prone GIS area math), risk-
-- RATING based, not SFHA %. So the 077 flood columns are renamed/retuned to fit
-- NRI's metric. All 077 flood columns were EMPTY (the ingest never ran), so this
-- is a no-data-loss rename + a drop of one now-irrelevant empty column.
--
--   flood_sfha_pct  → flood_risk_score   (numeric: NRI 0-100 flood risk score —
--                                          worst of inland (IFLD_RISKS) + coastal
--                                          (CFLD_RISKS))
--   flood_category  → flood_risk_rating  (text: normalized worst NRI rating —
--                                          very_low|relatively_low|relatively_moderate|
--                                          relatively_high|very_high|none)
--   flood_sfha_acres → dropped           (NRI has no acreage; column was empty)
--
-- Source: FEMA National Risk Index Counties FeatureServer
--   services.arcgis.com/XG15cJAlne2vxtgt/.../National_Risk_Index_Counties/FeatureServer/0
-- Idempotent guards; Aden applies.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'county_geospatial_data' and column_name = 'flood_sfha_pct') then
    alter table county_geospatial_data rename column flood_sfha_pct to flood_risk_score;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'county_geospatial_data' and column_name = 'flood_category') then
    alter table county_geospatial_data rename column flood_category to flood_risk_rating;
  end if;
end $$;

alter table county_geospatial_data drop column if exists flood_sfha_acres;

comment on column county_geospatial_data.flood_risk_score is
  'FEMA NRI county flood risk score 0-100 — worst of inland (IFLD_RISKS) + coastal (CFLD_RISKS). Observed (FEMA NRI).';
comment on column county_geospatial_data.flood_risk_rating is
  'Normalized worst FEMA NRI flood risk rating (very_low..very_high|none). The scoring engine treats relatively_high|very_high as a site constraint (disclosed synthesis).';

notify pgrst, 'reload schema';
