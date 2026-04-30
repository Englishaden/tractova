-- ─────────────────────────────────────────────────────────────────────────────
-- V3 Wave 1.4: state_programs feasibility snapshot history
--
-- The existing weekly cron (api/refresh-data.js, refreshStateProgramsViaDsire)
-- UPSERTs into state_programs on the state PK, overwriting the prior row each
-- week. The current value is preserved but the TIME SERIES is lost -- meaning
-- "Markets on the Move" can only sort by recency, not by score-delta. WoW
-- "this state's score moved +X points this week" framing isn't possible.
--
-- This table is append-only. The cron INSERTs a new row each week alongside
-- the existing upsert. ~4 weeks of accumulation gives us meaningful WoW
-- deltas for the dashboard. The Wave 1.4 derived metrics (IX Velocity Index,
-- Program Saturation Index) read from this + ix_queue_snapshots.
--
-- No retention policy yet -- we'll prune snapshots >3 years when staleness
-- maintenance gets there. At ~50 states per week × 1KB per row, the table
-- grows ~2.5MB/year. Trivial.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists state_programs_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  state_id            text not null,
  feasibility_score   numeric,
  cs_status           text,
  capacity_mw         numeric,
  ix_difficulty       text,
  lmi_required        boolean,
  lmi_percent         numeric,
  snapshot_at         timestamptz not null default now()
);

-- Time-series lookup by state (delta queries pull last 2 rows per state)
create index if not exists idx_state_programs_snapshots_lookup
  on state_programs_snapshots (state_id, snapshot_at desc);

-- Recent-window scans for cron health checks + dashboard panels
create index if not exists idx_state_programs_snapshots_recent
  on state_programs_snapshots (snapshot_at desc);

alter table state_programs_snapshots enable row level security;

-- Service role writes. Authenticated users read for the dashboard.
do $$ begin
  create policy "authenticated users read state_programs_snapshots"
    on state_programs_snapshots for select
    using (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

-- Public read also OK for the dashboard preview surface (anon viewers see
-- Markets on the Move on /preview without signing in).
do $$ begin
  create policy "anon users read state_programs_snapshots"
    on state_programs_snapshots for select
    using (auth.role() = 'anon');
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
