-- Migration 029: revenue_stacks — DSIRE financial-incentive verification fields
--
-- Adds columns to revenue_stacks that store cross-verification against the
-- DSIRE database (Database of State Incentives for Renewables & Efficiency,
-- NCSU + DOE-funded). Populated by /api/refresh-data?source=revenue_stacks.
--
-- Same augment-not-replace pattern as migration 026 for state_programs:
--   - Tractova-curated values (irec_market, itc_base, itc_adder,
--     net_metering_status, summary) stay admin-curated.
--   - DSIRE columns add a live-verification layer with canonical source URL,
--     summary text, and verification timestamp -- so the Revenue Stack panel
--     can display "verified against DSIRE on YYYY-MM-DD" + a deep-link.
--
-- Match strategy at runtime:
--   - For each state, query DSIRE for technology=7 (solar PV), filter to
--     programs whose name suggests a financial incentive (REC, SREC, ITC,
--     net metering, value of solar, performance-based incentive).
--   - Pick the highest-scoring match (or 'none').
--
-- DSIRE API: programs.dsireusa.org/api/v2/programs (free, no key).

alter table revenue_stacks
  add column if not exists dsire_program_id      text,
  add column if not exists dsire_program_url     text,
  add column if not exists dsire_summary         text,
  add column if not exists dsire_last_verified   timestamptz,
  add column if not exists dsire_match_quality   text check (dsire_match_quality in ('exact', 'partial', 'none'));

create index if not exists revenue_stacks_dsire_verified_idx
  on revenue_stacks (dsire_last_verified desc nulls last);

notify pgrst, 'reload schema';
