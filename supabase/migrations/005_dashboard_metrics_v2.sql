-- ─────────────────────────────────────────────────────────────────────────────
-- Dashboard metrics v2 — add IX headroom + policy pulse from live tables
-- Safe to re-run — uses CREATE OR REPLACE.
-- ─────────────────────────────────────────────────────────────────────────────

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
      (select to_char(max(last_verified), 'YYYY-MM-DD') from state_programs)
  );
$$;
