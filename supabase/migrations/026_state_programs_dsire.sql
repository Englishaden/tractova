-- Migration 026: state_programs — DSIRE verification fields
--
-- Adds columns to state_programs that store the cross-verification result
-- against the DSIRE database (Database of State Incentives for Renewables &
-- Efficiency, run by NCSU + DOE-funded). Populated by the
-- /api/refresh-data?source=state_programs cron handler.
--
-- These fields don't REPLACE Tractova's curated state_programs data
-- (csStatus, capacityMW, lmiPercent, ixDifficulty are still Tractova-
-- derived). They AUGMENT it with a live verification layer pointing at
-- the canonical authoritative source -- so customers see "verified
-- against DSIRE on 2026-04-29" and can click through to the source.
--
-- DSIRE API: programs.dsireusa.org/api/v2/programs (free, no key).

alter table state_programs
  add column if not exists dsire_program_id      text,
  add column if not exists dsire_program_url     text,
  add column if not exists dsire_summary         text,
  add column if not exists dsire_last_verified   timestamptz,
  add column if not exists dsire_match_quality   text check (dsire_match_quality in ('exact', 'partial', 'none'));

create index if not exists state_programs_dsire_verified_idx
  on state_programs (dsire_last_verified desc nulls last);

notify pgrst, 'reload schema';
