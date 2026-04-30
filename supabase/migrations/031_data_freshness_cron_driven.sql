-- Migration 031: get_data_freshness() — pivot to cron-driven freshness
--
-- Problem this fixes: even after migration 030, freshness cards only moved
-- when underlying ROW values mutated. If a cron successfully verified data
-- against the live source but didn't have to change anything (DSIRE returned
-- the same match, RSS feed had no new relevant articles, ACS published the
-- same numbers), the panel still showed days-old timestamps. Confusing for
-- the admin clicking "Refresh data from sources" -- the cron ran, succeeded,
-- and the panel still said "stale."
--
-- New model: each card surfaces the most recent SUCCESSFUL cron run for the
-- corresponding source from cron_runs. That's what "freshness" actually
-- means in our architecture: when did we last verify this data against its
-- canonical upstream source?
--
-- Field added per source: `last_cron_success` (timestamptz). Frontend reads
-- this as the primary freshness field. Existing fields kept for backwards
-- compat / detail panels.
--
-- cron_name → table mapping:
--   refresh-data:state_programs   → state_programs (DSIRE verification)
--   refresh-data:lmi              → lmi_data
--   refresh-data:county_acs       → county_acs_data
--   refresh-data:news             → news_feed
--   refresh-data:revenue_stacks   → revenue_stacks
--   ix-queue-refresh              → ix_queue_data
--   monthly-data-refresh          → substations
--   capacity-factor-refresh       → revenue_rates

create or replace function get_data_freshness()
returns json language sql stable as $$
  with last_runs as (
    select distinct on (cron_name)
      cron_name, status, finished_at, duration_ms, summary
    from cron_runs
    order by cron_name, finished_at desc
  ),
  last_success as (
    select distinct on (cron_name)
      cron_name, finished_at
    from cron_runs
    where status = 'success'
    order by cron_name, finished_at desc
  )
  select json_build_object(
    'state_programs', (select json_build_object(
      'row_count',         count(*),
      'oldest_verified',   min(coalesce(dsire_last_verified, last_verified::timestamptz)),
      'newest_verified',   max(greatest(
                              coalesce(last_verified::timestamptz, 'epoch'::timestamptz),
                              coalesce(dsire_last_verified,        'epoch'::timestamptz)
                            )),
      'stale_count',       count(*) filter (
                              where coalesce(
                                greatest(
                                  coalesce(last_verified::timestamptz, 'epoch'::timestamptz),
                                  coalesce(dsire_last_verified,        'epoch'::timestamptz)
                                ),
                                'epoch'::timestamptz
                              ) < now() - interval '90 days'
                           ),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:state_programs')
    ) from state_programs where cs_status != 'none'),

    'lmi_data', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(last_updated),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:lmi')
    ) from lmi_data),

    'ix_queue_data', (select json_build_object(
      'row_count',         count(*),
      'oldest_fetch',      min(fetched_at),
      'newest_fetch',      max(fetched_at),
      'stale_count',       count(*) filter (where fetched_at < now() - interval '14 days'),
      'last_cron_success', (select finished_at from last_success where cron_name = 'ix-queue-refresh')
    ) from ix_queue_data),

    'substations', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(updated_at),
      'last_cron_success', (select finished_at from last_success where cron_name = 'monthly-data-refresh')
    ) from substations),

    'county_intelligence', (select json_build_object(
      'row_count',         count(*),
      'oldest_verified',   min(last_verified),
      'stale_count',       count(*) filter (where last_verified < now() - interval '90 days'),
      'last_cron_success', null   -- hand-curated; no cron
    ) from county_intelligence),

    'county_acs_data', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(last_updated),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:county_acs')
    ) from county_acs_data),

    'revenue_rates', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(updated_at),
      'last_cron_success', (select finished_at from last_success where cron_name = 'capacity-factor-refresh')
    ) from revenue_rates),

    'revenue_stacks', (select json_build_object(
      'row_count',          count(*),
      'last_updated',       max(updated_at),
      'newest_dsire_check', max(dsire_last_verified),
      'last_cron_success',  (select finished_at from last_success where cron_name = 'refresh-data:revenue_stacks')
    ) from revenue_stacks),

    'news_feed', (select json_build_object(
      'active_count',      count(*) filter (where is_active),
      'latest_item',       max(greatest(
                              coalesce(last_seen_at,             'epoch'::timestamptz),
                              coalesce(created_at,               'epoch'::timestamptz),
                              coalesce(published_at::timestamptz,'epoch'::timestamptz)
                            )),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:news')
    ) from news_feed),

    'last_cron_runs', (select coalesce(json_agg(r), '[]'::json) from (
      select cron_name, status, finished_at, duration_ms,
             summary->>'updated' as changes
      from last_runs
    ) r)
  );
$$;

notify pgrst, 'reload schema';
