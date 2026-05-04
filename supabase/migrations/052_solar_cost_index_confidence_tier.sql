-- Migration 052: solar_cost_index + revenue_rates Tier-B prefix backfill
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- Phase B (migration 048) used a hard-coded n>=40 threshold for publishing
-- a state's observed LBNL TTS percentiles. That floor was a statistical-
-- significance default lifted from the Phase A aggregator without
-- questioning. For early-stage developer screening, n=3 with explicit
-- disclosure is more useful than n=40 dressed as gospel.
--
-- This migration adds the schema metadata needed for tiered-confidence
-- disclosure, plus a backfill of structured TIER_B prefixes onto
-- revenue_rates.notes so the Lens UI can distinguish between
--   THIN       — sample exists but below the new n>=3 floor (FL/MD/NH/CT)
--   STRUCTURAL — incentive design generates no LBNL paper trail
--                regardless of program maturity (IL/PA/OR/DE/WA — all
--                SREC-strike states; LBNL TTS depends on rebate-program
--                paper trails, which SREC programs don't produce)
--
-- ── Schema changes ─────────────────────────────────────────────────────────
-- 1. confidence_tier text — 'strong' (n>=40) | 'modest' (n=10-39) | 'thin' (n=3-9)
-- 2. aggregation_window_years int — defaults to 3; reserved for future
--    fallback widening (not used in this migration's seed run)
-- 3. CHECK install_count >= 3 — DB-level enforcement of the new floor
-- 4. Extend unique constraint to include aggregation_window_years so a
--    future 5yr fallback row doesn't collide with the 3yr primary
--
-- ── Backfill ───────────────────────────────────────────────────────────────
-- Existing CA/MA/NY rows (all n>=84) get confidence_tier='strong'.
-- After this migration the seed script re-run will overwrite all rows with
-- the freshly-computed tiers + add new rows for TX/AZ/MN/WI/RI/CO/UT.
--
-- revenue_rates.notes prefix backfill follows the [TIER_B:<reason>] convention:
--   [TIER_B:THIN n=N] for FL/MD/NH/CT (sample exists below the floor)
--   [TIER_B:STRUCTURAL incentive=SREC] for IL/PA/OR/DE/WA
-- Existing prose follows the prefix unchanged. Idempotent — re-running this
-- migration won't double-prefix because of the ` ' || notes` shape: the
-- NOT LIKE guard prevents overwriting an already-prefixed row.
--
-- Idempotent. Safe to re-run.

-- ── solar_cost_index schema additions ──
alter table solar_cost_index
  add column if not exists confidence_tier text not null default 'strong',
  add column if not exists aggregation_window_years int not null default 3;

-- Drop + recreate the CHECK so a re-run doesn't error if it already exists
-- under a different definition.
alter table solar_cost_index drop constraint if exists solar_cost_index_confidence_tier_check;
alter table solar_cost_index
  add constraint solar_cost_index_confidence_tier_check
  check (confidence_tier in ('strong', 'modest', 'thin'));

alter table solar_cost_index drop constraint if exists solar_cost_index_install_count_check;
alter table solar_cost_index
  add constraint solar_cost_index_install_count_check
  check (install_count >= 3);

-- Extend uniqueness to include aggregation_window_years. Drop the old
-- unique key first; recreate with the wider tuple. Existing rows have
-- aggregation_window_years=3 (default), so no row-level conflicts arise.
alter table solar_cost_index drop constraint if exists solar_cost_index_state_sector_vintage_year_source_key;
alter table solar_cost_index
  add constraint solar_cost_index_state_sector_vintage_year_source_window_key
  unique (state, sector, vintage_year, source, aggregation_window_years);

-- Backfill existing rows (CA/MA/NY all have n>=84 → 'strong').
update solar_cost_index
  set confidence_tier = 'strong'
  where install_count >= 40 and confidence_tier is distinct from 'strong';

update solar_cost_index
  set confidence_tier = 'modest'
  where install_count between 10 and 39 and confidence_tier is distinct from 'modest';

update solar_cost_index
  set confidence_tier = 'thin'
  where install_count between 3 and 9 and confidence_tier is distinct from 'thin';

-- ── revenue_rates Tier-B prefix backfill ──
-- Guard with NOT LIKE so re-runs don't double-prefix.
update revenue_rates
  set notes = '[TIER_B:STRUCTURAL incentive=SREC] ' || coalesce(notes, '')
  where state_id in ('IL','PA','OR','DE','WA')
    and (notes is null or notes not like '[TIER_B:%');

update revenue_rates
  set notes = '[TIER_B:THIN n=2] ' || coalesce(notes, '')
  where state_id in ('FL','MD','NH')
    and (notes is null or notes not like '[TIER_B:%');

update revenue_rates
  set notes = '[TIER_B:THIN n=1] ' || coalesce(notes, '')
  where state_id = 'CT'
    and (notes is null or notes not like '[TIER_B:%');

notify pgrst, 'reload schema';
