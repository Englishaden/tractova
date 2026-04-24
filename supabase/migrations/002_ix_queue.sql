-- ─────────────────────────────────────────────────────────────────────────────
-- IX Queue Data — live interconnection queue intelligence
-- Populated by weekly cron (api/refresh-ix-queue.js) and seeded from static data.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ix_queue_data (
  id                  uuid primary key default gen_random_uuid(),
  state_id            text not null references state_programs(id),
  iso                 text not null,
  utility_name        text not null,
  projects_in_queue   integer,
  mw_pending          numeric,
  avg_study_months    numeric,
  withdrawal_pct      numeric,
  avg_upgrade_cost_mw numeric,
  queue_trend         text default 'stable',  -- growing|stable|shrinking
  data_source         text default 'seed',    -- seed|scraper|manual
  data_source_url     text,
  fetched_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(state_id, utility_name)
);

create trigger ix_queue_data_updated_at
before update on ix_queue_data
for each row execute function touch_updated_at();

-- Public read, service-role write
alter table ix_queue_data enable row level security;

create policy "public read ix_queue_data"
  on ix_queue_data for select using (true);
