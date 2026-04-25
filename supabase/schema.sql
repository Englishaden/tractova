-- ─────────────────────────────────────────────────────────────────────────────
-- Tractova — Live Data Schema
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shared trigger: auto-update updated_at ───────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── state_programs ────────────────────────────────────────────────────────────
-- Single source of truth for all state-level program data.
-- feasibilityScore is NEVER stored here — it is computed in programData.js
-- from these live fields so any update propagates instantly everywhere.

create table if not exists state_programs (
  id                           text primary key,        -- 'IL', 'NY', etc.
  name                         text not null,
  cs_status                    text not null default 'none',  -- active|limited|pending|none
  cs_program                   text,
  capacity_mw                  numeric default 0,
  lmi_required                 boolean default false,
  lmi_percent                  numeric default 0,
  ix_difficulty                text default 'moderate', -- easy|moderate|hard|very_hard
  ix_notes                     text,
  program_notes                text,
  enrollment_rate_mw_per_month numeric,
  data_source                  text default 'manual',
  last_verified                timestamptz default now(),
  updated_at                   timestamptz default now(),
  updated_by                   text default 'seed'
);

create trigger state_programs_updated_at
before update on state_programs
for each row execute function touch_updated_at();

-- ── state_programs_staging ───────────────────────────────────────────────────
-- Future scrapers write here. Admin reviews diff and promotes to state_programs.
-- Keeps scraper noise out of the live product from day one.

create table if not exists state_programs_staging (
  id                           text not null,
  name                         text not null,
  cs_status                    text,
  cs_program                   text,
  capacity_mw                  numeric,
  lmi_required                 boolean,
  lmi_percent                  numeric,
  ix_difficulty                text,
  ix_notes                     text,
  program_notes                text,
  enrollment_rate_mw_per_month numeric,
  data_source                  text,
  review_status                text default 'pending',  -- pending|approved|rejected
  diff_summary                 text,
  submitted_at                 timestamptz default now(),
  submitted_by                 text,
  primary key (id, submitted_at)
);

-- ── county_intelligence ───────────────────────────────────────────────────────
-- County-level site control and interconnection intelligence.
-- county_slug = 'default' is the state-level fallback for unseeded counties.

create table if not exists county_intelligence (
  id                  uuid primary key default gen_random_uuid(),
  state_id            text not null references state_programs(id),
  county_slug         text not null,           -- 'cook', 'default', etc.
  serving_utility     text,
  queue_status        text,
  queue_status_code   text,                    -- open|limited|saturated
  ease_score          numeric,                 -- 1–10
  avg_study_timeline  text,
  queue_notes         text,
  available_land      boolean,
  land_notes          text,
  wetland_warning     boolean default false,
  wetland_notes       text,
  land_use_notes      text,
  last_verified       timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(state_id, county_slug)
);

create trigger county_intelligence_updated_at
before update on county_intelligence
for each row execute function touch_updated_at();

-- ── revenue_stacks ────────────────────────────────────────────────────────────

create table if not exists revenue_stacks (
  state_id            text primary key references state_programs(id),
  summary             text,
  irec_market         text,
  itc_base            text,
  itc_adder           text,
  net_metering_status text,
  updated_at          timestamptz default now()
);

create trigger revenue_stacks_updated_at
before update on revenue_stacks
for each row execute function touch_updated_at();

-- ── news_feed ─────────────────────────────────────────────────────────────────

create table if not exists news_feed (
  id           uuid primary key default gen_random_uuid(),
  headline     text not null,
  source       text,
  url          text,
  published_at date not null,
  pillar       text not null,     -- offtake|ix|site
  type         text,              -- policy-alert|market-update
  summary      text,
  tags         text[],
  state_ids    text[],
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- ── data_updates audit log ────────────────────────────────────────────────────
-- Every write to state_programs is logged here for change tracking.

create table if not exists data_updates (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      text not null,
  field       text,
  old_value   text,
  new_value   text,
  updated_by  text,
  updated_at  timestamptz default now()
);

-- ── RPC: get_dashboard_metrics ────────────────────────────────────────────────
-- Returns all dashboard metrics computed live from state_programs, ix_queue_data,
-- and news_feed. MetricsBar.jsx calls this instead of importing static data.

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

-- ── Row Level Security ────────────────────────────────────────────────────────
-- state_programs, county_intelligence, revenue_stacks, news_feed: public read
-- state_programs_staging, data_updates: service role only

alter table state_programs enable row level security;
alter table county_intelligence enable row level security;
alter table revenue_stacks enable row level security;
alter table news_feed enable row level security;
alter table state_programs_staging enable row level security;
alter table data_updates enable row level security;

-- Public read policies
create policy "public read state_programs"
  on state_programs for select using (true);

create policy "public read county_intelligence"
  on county_intelligence for select using (true);

create policy "public read revenue_stacks"
  on revenue_stacks for select using (true);

create policy "public read news_feed"
  on news_feed for select using (is_active = true);

-- Service role has full access to all tables (bypasses RLS by default)
