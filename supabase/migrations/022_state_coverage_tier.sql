-- Migration 022: state_programs coverage_tier column
--
-- V3 Strategy A — tiered coverage with explicit transparency. Tractova has
-- different data depth across states (8 deep CS-focused states vs 10
-- adjacent states with mid-tier data vs ~32 states with state-program-only
-- coverage). Surfacing this honestly via a coverage_tier column lets the
-- UI render a "Full / Mid / Light" badge so users always see what they're
-- actually getting.
--
-- Tier definitions:
--   full  — county-level intel, IX queue data, substations, revenue rates,
--           PUC docket coverage, all AI features at full fidelity.
--           (8 core CS states: IL, NY, MA, MN, CO, NJ, ME, MD)
--   mid   — state-level program data, ISO/RTO IX queue summaries, PUC
--           docket monitoring, state retail rates. Lens still works at
--           state-level depth.
--           (10 adjacent states with revenue_stacks already seeded:
--           CA, TX, AZ, NC, OR, VA, NV, FL, OH, PA)
--   light — DSIRE-derived state programs only. Lens shows reasonable
--           guidance + an upsell to wait for fuller coverage.
--           (everything else, default)
--
-- Backfill is conservative: explicit Full + Mid lists; everything else
-- defaults to Light. Admin can promote any state via the State Programs
-- tab tier dropdown.

alter table state_programs
  add column if not exists coverage_tier text not null default 'light'
    check (coverage_tier in ('full', 'mid', 'light'));

create index if not exists state_programs_coverage_tier_idx
  on state_programs (coverage_tier);

-- Backfill: 8 core CS states -> full
update state_programs
set coverage_tier = 'full'
where id in ('IL', 'NY', 'MA', 'MN', 'CO', 'NJ', 'ME', 'MD');

-- Backfill: 10 adjacent states with mid-tier coverage
update state_programs
set coverage_tier = 'mid'
where id in ('CA', 'TX', 'AZ', 'NC', 'OR', 'VA', 'NV', 'FL', 'OH', 'PA');

-- (All other states keep the default 'light' from the column declaration.)

notify pgrst, 'reload schema';
