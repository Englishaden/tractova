-- Migration 040: get_dashboard_metrics() returns lastRefreshAt from cron_runs
--
-- The footer's "Data last updated" caption was sourcing from
-- state_programs.last_verified, which only advances when an admin manually
-- verifies a state row in /admin. After today's automated refreshes (Census
-- ACS, NWI, SSURGO, etc.) the cron-driven tables were fully fresh, but the
-- footer still showed a stale verification date. Misrepresented freshness
-- to users.
--
-- Adds lastRefreshAt = max(cron_runs.finished_at WHERE status = 'success')
-- so the footer can render the genuine "when did data last refresh"
-- timestamp. Keeps lastUpdated for back-compat with anything else reading it.

create or replace function get_dashboard_metrics()
returns json language sql stable as $$
  select json_build_object(
    'statesWithActiveCS',
      (select count(*) from state_programs where cs_status = 'active'),
    'statesWithAnyCS',
      (select count(*) from state_programs where cs_status in ('active', 'limited', 'pending')),
    'utilitiesWithIXHeadroom',
      (select count(distinct utility_name) from ix_queue_data),
    'policyAlertsThisWeek',
      (select count(*) from news_feed where is_active = true
       and published_at >= current_date - interval '7 days'),
    'avgCSCapacityRemaining',
      concat(
        (select round(avg(capacity_mw)) from state_programs where cs_status = 'active'),
        ' MW avg'
      ),
    'totalMWInPipeline',
      (select coalesce(sum(capacity_mw), 0) from state_programs where cs_status in ('active', 'limited')),
    'lastUpdated',
      (select to_char(max(last_verified), 'YYYY-MM-DD') from state_programs),
    'lastRefreshAt',
      (select max(finished_at) from cron_runs where status = 'success')
  );
$$;

notify pgrst, 'reload schema';
