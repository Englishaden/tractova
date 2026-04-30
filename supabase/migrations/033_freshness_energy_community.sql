-- Migration 033: get_data_freshness() — add energy_community_data block
--
-- Migration 032 added the energy_community_data table (IRA §45/§48 bonus
-- credit eligibility, live-pulled from DOE NETL EDX). This migration
-- extends the freshness RPC so the Admin Data Health panel surfaces a
-- card for it, driven by `last_cron_success` from cron_runs.
--
-- Pattern matches the cron-driven freshness model from migration 031.
-- Same idempotent CREATE OR REPLACE -- safe to re-run.

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
      'last_cron_success', null
    ) from county_intelligence),

    'county_acs_data', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(last_updated),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:county_acs')
    ) from county_acs_data),

    'energy_community_data', (select json_build_object(
      'row_count',         count(*),
      'last_updated',      max(last_updated),
      'qualifying_via_msa',         count(*) filter (where qualifies_via_msa),
      'qualifying_via_coal_closure',count(*) filter (where qualifies_via_coal_closure),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:energy_community')
    ) from energy_community_data),

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
