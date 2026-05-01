-- Migration 041: scenario_snapshots — persisted Scenario Studio outputs.
--
-- Backs the Phase 2 Scenario Studio feature (interactive sensitivity layer
-- in Lens results). Each row is a user-named scenario tied to either a
-- saved project (project_id) or an ad-hoc Lens result (project_id null,
-- state_id + county_name capture the context).
--
-- Why three jsonb columns instead of flat numeric fields:
--   - baseline_inputs / scenario_inputs / outputs schema can evolve as v2
--     adds IRR / LCOE / 25-year cashflow without a migration.
--   - the engine in src/lib/scenarioEngine.js is the single source of
--     truth for shape; storing the full computed snapshot makes saved
--     scenarios hermetic — they render identically even if the engine's
--     formulas later change.
--
-- RLS: standard own-rows-only pattern (matches projects table). No public
-- read; all queries scoped by auth.uid().

create table if not exists scenario_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  project_id            uuid references projects(id) on delete cascade,  -- nullable: ad-hoc Lens scenarios live without a saved project
  state_id              text not null,                                    -- USPS state code (always present — needed to recompute baseline)
  county_name           text,                                             -- nullable for state-level scenarios
  technology            text,                                             -- 'community-solar' | 'commercial-industrial' | 'bess' (engine-canonical)
  name                  text not null,                                    -- user-named, e.g. "10MW + cheaper IX"
  baseline_inputs       jsonb not null,                                   -- frozen baseline {systemSizeMW, capacityFactor, capexPerWatt, ixCostPerWatt, recPricePerMwh, programAllocation}
  scenario_inputs       jsonb not null,                                   -- user slider values (same shape as baseline_inputs)
  outputs               jsonb not null,                                   -- {year1Revenue, paybackYears, revenueDelta, paybackDelta, ...}
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists scenario_snapshots_user_idx
  on scenario_snapshots (user_id, created_at desc);

create index if not exists scenario_snapshots_project_idx
  on scenario_snapshots (project_id)
  where project_id is not null;

create trigger scenario_snapshots_updated_at
before update on scenario_snapshots
for each row execute function touch_updated_at();

alter table scenario_snapshots enable row level security;

do $$ begin
  create policy "users read own scenarios"
    on scenario_snapshots for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users insert own scenarios"
    on scenario_snapshots for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users update own scenarios"
    on scenario_snapshots for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users delete own scenarios"
    on scenario_snapshots for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
