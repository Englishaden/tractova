-- Migration 055: drop redundant `updated_at` triggers on three lineage tables.
--
-- ── Bug ────────────────────────────────────────────────────────────────────
-- Migrations 048 (solar_cost_index), 050 (cs_projects), and 053
-- (cs_specific_yield) installed BEFORE-UPDATE triggers calling the generic
-- touch_updated_at() function, which expects to assign NEW.updated_at = now().
-- The three tables instead use a `last_updated` column (set explicitly by
-- the application on every upsert). On re-seeding (i.e. ON CONFLICT UPDATE),
-- the trigger fails: `record "new" has no field "updated_at"`.
--
-- ── Fix ────────────────────────────────────────────────────────────────────
-- Drop the broken triggers. The application is the source of truth for
-- last_updated; the trigger was never doing useful work for these three
-- tables. Other tables (e.g. county_geospatial_data) keep their triggers
-- because they have an actual `updated_at` column.
--
-- Idempotent. Safe to re-run.

drop trigger if exists solar_cost_index_updated_at on solar_cost_index;
drop trigger if exists cs_projects_updated_at       on cs_projects;
drop trigger if exists cs_specific_yield_updated_at on cs_specific_yield;

notify pgrst, 'reload schema';
