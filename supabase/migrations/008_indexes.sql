-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes for frequently queried columns.
-- All use IF NOT EXISTS — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- cron_runs: ordered by finished_at in Data Health dashboard
create index if not exists idx_cron_runs_finished_at on cron_runs(finished_at desc);

-- cron_runs: get_data_freshness() RPC uses DISTINCT ON (cron_name) ORDER BY finished_at desc
create index if not exists idx_cron_runs_name_finished on cron_runs(cron_name, finished_at desc);

-- data_updates: ordered by updated_at in Data Health dashboard + retention cleanup
create index if not exists idx_data_updates_updated_at on data_updates(updated_at desc);

-- news_feed: filtered by is_active + ordered by published_at
create index if not exists idx_news_feed_active_published on news_feed(is_active, published_at desc);

-- ix_queue_data: filtered by state_id in every query
-- (unique index on state_id, utility_name already exists but a plain state_id index helps)
create index if not exists idx_ix_queue_state on ix_queue_data(state_id);
