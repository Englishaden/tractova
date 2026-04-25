-- ─────────────────────────────────────────────────────────────────────────────
-- Cron observability: cron_runs table + data freshness RPC
-- Safe to re-run — uses IF NOT EXISTS and CREATE OR REPLACE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── cron_runs ────────────────────────────────────────────────────────────────
-- Every cron execution logs a row here for observability.
-- Admin Data Health tab reads this to show run history and detect failures.

create table if not exists cron_runs (
  id          uuid primary key default gen_random_uuid(),
  cron_name   text not null,
  status      text not null,          -- success | partial | failed
  started_at  timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  summary     jsonb,                  -- { updated: 5, unchanged: 12, errors: [], warnings: [] }
  created_at  timestamptz default now()
);

alter table cron_runs enable row level security;

-- ── get_data_freshness() RPC ─────────────────────────────────────────────────
-- Returns freshness status for every table + last cron runs in one call.
-- Powers the admin Data Health dashboard.

create or replace function get_data_freshness()
returns json language sql stable as $$
  select json_build_object(
    'state_programs', (select json_build_object(
      'row_count', count(*),
      'oldest_verified', min(last_verified),
      'newest_verified', max(last_verified),
      'stale_count', count(*) filter (where last_verified < now() - interval '90 days')
    ) from state_programs where cs_status != 'none'),
    'ix_queue_data', (select json_build_object(
      'row_count', count(*),
      'oldest_fetch', min(fetched_at),
      'newest_fetch', max(fetched_at),
      'stale_count', count(*) filter (where fetched_at < now() - interval '14 days')
    ) from ix_queue_data),
    'substations', (select json_build_object(
      'row_count', count(*),
      'last_updated', max(updated_at)
    ) from substations),
    'county_intelligence', (select json_build_object(
      'row_count', count(*),
      'oldest_verified', min(last_verified),
      'stale_count', count(*) filter (where last_verified < now() - interval '90 days')
    ) from county_intelligence),
    'revenue_rates', (select json_build_object(
      'row_count', count(*),
      'last_updated', max(updated_at)
    ) from revenue_rates),
    'news_feed', (select json_build_object(
      'active_count', count(*) filter (where is_active),
      'latest_item', max(published_at)
    ) from news_feed),
    'last_cron_runs', (select coalesce(json_agg(r), '[]'::json) from (
      select distinct on (cron_name)
        cron_name, status, finished_at, duration_ms,
        summary->>'updated' as changes
      from cron_runs order by cron_name, finished_at desc
    ) r)
  );
$$;
