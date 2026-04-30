-- Migration 030: get_data_freshness() — wire cron-driven updates into the
-- Admin Data Health freshness panel.
--
-- Problem this fixes: the previous RPC (migration 006) read fields that
-- only admin curation touched. Cron-driven updates (DSIRE verification on
-- state_programs + revenue_stacks, RSS+AI ingest on news_feed, county-level
-- Census ACS pulls) wrote to OTHER columns, so the freshness panel never
-- reflected automated activity. Result: user runs the manual "Refresh data
-- from sources" button, every cron handler succeeds, every underlying table
-- is fresh -- and the panel still says "25 days old."
--
-- Changes:
--   - state_programs.newest_verified now = greatest(last_verified,
--     dsire_last_verified) so DSIRE cron credit shows up.
--   - news_feed.latest_item now = max over (last_seen_at, created_at,
--     published_at) so a cron run that touched existing rows (or inserted
--     older articles) still moves the freshness needle.
--   - revenue_stacks added (was missing entirely).
--   - county_acs_data added (county-level Census pipeline, migration 027).

create or replace function get_data_freshness()
returns json language sql stable as $$
  select json_build_object(
    'state_programs', (select json_build_object(
      'row_count',       count(*),
      'oldest_verified', min(coalesce(dsire_last_verified, last_verified::timestamptz)),
      'newest_verified', max(greatest(
                            coalesce(last_verified::timestamptz, 'epoch'::timestamptz),
                            coalesce(dsire_last_verified,        'epoch'::timestamptz)
                          )),
      'stale_count',     count(*) filter (
                            where coalesce(
                              greatest(
                                coalesce(last_verified::timestamptz, 'epoch'::timestamptz),
                                coalesce(dsire_last_verified,        'epoch'::timestamptz)
                              ),
                              'epoch'::timestamptz
                            ) < now() - interval '90 days'
                         )
    ) from state_programs where cs_status != 'none'),
    'ix_queue_data', (select json_build_object(
      'row_count',    count(*),
      'oldest_fetch', min(fetched_at),
      'newest_fetch', max(fetched_at),
      'stale_count',  count(*) filter (where fetched_at < now() - interval '14 days')
    ) from ix_queue_data),
    'substations', (select json_build_object(
      'row_count',    count(*),
      'last_updated', max(updated_at)
    ) from substations),
    'county_intelligence', (select json_build_object(
      'row_count',       count(*),
      'oldest_verified', min(last_verified),
      'stale_count',     count(*) filter (where last_verified < now() - interval '90 days')
    ) from county_intelligence),
    'county_acs_data', (select json_build_object(
      'row_count',    count(*),
      'last_updated', max(last_updated)
    ) from county_acs_data),
    'revenue_rates', (select json_build_object(
      'row_count',    count(*),
      'last_updated', max(updated_at)
    ) from revenue_rates),
    'revenue_stacks', (select json_build_object(
      'row_count',          count(*),
      'last_updated',       max(updated_at),
      'newest_dsire_check', max(dsire_last_verified)
    ) from revenue_stacks),
    'news_feed', (select json_build_object(
      'active_count', count(*) filter (where is_active),
      'latest_item',  max(greatest(
                          coalesce(last_seen_at,            'epoch'::timestamptz),
                          coalesce(created_at,              'epoch'::timestamptz),
                          coalesce(published_at::timestamptz,'epoch'::timestamptz)
                        ))
    ) from news_feed),
    'last_cron_runs', (select coalesce(json_agg(r), '[]'::json) from (
      select distinct on (cron_name)
        cron_name, status, finished_at, duration_ms,
        summary->>'updated' as changes
      from cron_runs order by cron_name, finished_at desc
    ) r)
  );
$$;

notify pgrst, 'reload schema';
