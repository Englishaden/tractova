-- Migration 076: get_data_freshness() — add county_geospatial_data +
-- hosting_capacity_data blocks (2026-06 data audit, Wave 2 / A5).
--
-- The audit found these two scoring inputs were ABSENT from the freshness RPC
-- entirely, so /admin → Data Health (and the staleness monitor) had no signal
-- for them — they could go stale silently. This extends the RPC with both.
--
--   county_geospatial_data — SSURGO prime-farmland (LIVE, weekly cron
--     'refresh-data:geospatial_farmland') + USFWS NWI wetlands (SEEDED, partial).
--     Surfaces the wetland-vs-farmland populated split so the partial NWI
--     coverage is visible, not hidden behind one row count.
--   hosting_capacity_data — utility hosting-capacity rows (cron
--     'refresh-data:hosting_capacity'); newest_fetch + row_count.
--
-- Everything else is reproduced verbatim from migration 054 (CREATE OR REPLACE
-- swaps the whole function, so all blocks must be present). Idempotent.

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
      'row_count',                  count(*),
      'last_updated',               max(last_updated),
      'qualifying_via_msa',         count(*) filter (where qualifies_via_msa),
      'qualifying_via_coal_closure',count(*) filter (where qualifies_via_coal_closure),
      'last_cron_success',          (select finished_at from last_success where cron_name = 'refresh-data:energy_community')
    ) from energy_community_data),

    'hud_qct_dda_data', (select json_build_object(
      'row_count',                count(*),
      'last_updated',             max(last_updated),
      'counties_with_qct',        count(*) filter (where qct_count > 0),
      'counties_non_metro_dda',   count(*) filter (where is_non_metro_dda),
      'total_qct_tracts',         coalesce(sum(qct_count), 0),
      'last_cron_success',        (select finished_at from last_success where cron_name = 'refresh-data:hud_qct_dda')
    ) from hud_qct_dda_data),

    'nmtc_lic_data', (select json_build_object(
      'row_count',                count(*),
      'last_updated',             max(last_updated),
      'counties_with_lic',        count(*) filter (where qualifying_tracts_count > 0),
      'total_qualifying_tracts',  coalesce(sum(qualifying_tracts_count), 0),
      'last_cron_success',        (select finished_at from last_success where cron_name = 'refresh-data:nmtc_lic')
    ) from nmtc_lic_data),

    -- NEW (076): SSURGO farmland (live weekly) + NWI wetlands (seeded, partial).
    -- wetland_seeded vs farmland_seeded expose the partial NWI coverage honestly.
    'county_geospatial_data', (select json_build_object(
      'row_count',         count(*),
      'wetland_seeded',    count(*) filter (where wetland_coverage_pct is not null),
      'farmland_seeded',   count(*) filter (where prime_farmland_pct is not null),
      'newest_wetland',    max(wetland_last_updated),
      'newest_farmland',   max(farmland_last_updated),
      'last_updated',      max(updated_at),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:geospatial_farmland')
    ) from county_geospatial_data),

    -- NEW (076): utility hosting-capacity rows.
    'hosting_capacity_data', (select json_build_object(
      'row_count',         count(*),
      'states_covered',    count(distinct state),
      'newest_fetch',      max(fetched_at),
      'last_updated',      max(updated_at),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:hosting_capacity')
    ) from hosting_capacity_data),

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

    'solar_cost_index', (select json_build_object(
      'row_count',         count(*),
      'states_covered',    count(distinct state),
      'latest_vintage',    max(vintage_year),
      'last_updated',      max(last_updated),
      'last_cron_success', (select finished_at from last_success where cron_name = 'refresh-data:solar_costs')
    ) from solar_cost_index),

    'cs_projects', (select json_build_object(
      'row_count',         count(*),
      'states_covered',    count(distinct state),
      'latest_vintage',    max(vintage_year),
      'source_release',    max(source_release),
      'last_updated',      max(last_updated),
      'last_cron_success', null
    ) from cs_projects),

    'cs_specific_yield', (select json_build_object(
      'row_count',         count(*),
      'states_covered',    count(distinct state),
      'sources_in_use',    count(distinct source),
      'last_updated',      max(last_updated),
      'last_cron_success', null
    ) from cs_specific_yield),

    'last_cron_runs', (select coalesce(json_agg(r), '[]'::json) from (
      select cron_name, status, finished_at, duration_ms,
             summary->>'updated' as changes
      from last_runs
    ) r)
  );
$$;

notify pgrst, 'reload schema';
