-- ─────────────────────────────────────────────────────────────────────────────
-- V3 Wave 1: IX queue history accumulation
--
-- The existing weekly cron (api/refresh-ix-queue.js) currently UPSERTs into
-- ix_queue_data on (state_id, utility_name) -- meaning each weekly run
-- overwrites the prior snapshot. The current value is preserved but the
-- TIME SERIES is lost.
--
-- The V3 Wave 2 IX Queue Forecaster (P50 / P90 study completion dates)
-- needs queue position trajectory over time -- minimum ~12 weekly snapshots
-- to fit a usable model. Without history accumulation we'd be starting
-- from zero when Wave 2 ships.
--
-- This table is append-only. The cron INSERTs a new row each week on top of
-- the existing upsert into ix_queue_data (which stays as the "latest" table
-- the UI reads from). No retention policy yet -- the staleness cron will
-- prune snapshots >3 years when we get there.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ix_queue_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  state_id            text not null,
  iso                 text,
  utility_name        text not null,
  projects_in_queue   integer,
  mw_pending          numeric,
  queue_trend         text,
  avg_study_months    numeric,
  withdrawal_pct      numeric,
  avg_upgrade_cost_mw numeric,
  data_source         text default 'scraper',
  snapshot_at         timestamptz default now() not null
);

-- Time-series lookup by utility (forecasting / charts)
create index if not exists idx_ix_queue_snapshots_lookup
  on ix_queue_snapshots(state_id, utility_name, snapshot_at desc);

-- Recent-window scans (cron health checks, dashboards)
create index if not exists idx_ix_queue_snapshots_recent
  on ix_queue_snapshots(snapshot_at desc);

alter table ix_queue_snapshots enable row level security;

-- The scraper writes via the service role (which bypasses RLS).
-- Read access for authenticated users is fine for the forecaster UI.
do $$ begin
  create policy "authenticated users read ix_queue_snapshots"
    on ix_queue_snapshots for select
    using (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;
