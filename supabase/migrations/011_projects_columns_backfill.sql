-- ─────────────────────────────────────────────────────────────────────────────
-- V3 hotfix: backfill missing columns on the production projects table.
--
-- ROOT CAUSE: migration 007_profiles_projects.sql used `create table if not
-- exists projects (...)` to "codify" a table that was originally created via
-- the Supabase dashboard. Because the table already existed, the IF NOT
-- EXISTS guard silently skipped the entire CREATE — so all the columns
-- defined in 007's column list never landed on the production table.
--
-- The Lens "Save to Library" flow began surfacing a PostgREST error:
--   "Could not find the 'ix_difficulty' column of 'projects' in the schema cache"
--
-- FIX: idempotently ADD COLUMN IF NOT EXISTS for every column the save
-- handler writes. PostgreSQL no-ops on existing columns. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table projects
  add column if not exists state             text,
  add column if not exists state_name        text,
  add column if not exists county            text,
  add column if not exists mw                numeric,
  add column if not exists stage             text,
  add column if not exists technology        text,
  add column if not exists cs_program        text,
  add column if not exists cs_status         text,
  add column if not exists serving_utility   text,
  add column if not exists ix_difficulty     text,
  add column if not exists opportunity_score numeric,
  add column if not exists notes             text,
  add column if not exists saved_at          timestamptz default now();

-- Force PostgREST to reload its schema cache so the new columns are visible
-- without a Supabase restart. Without this, the API may continue to return
-- "column not found" errors for ~30s after the migration runs.
notify pgrst, 'reload schema';
