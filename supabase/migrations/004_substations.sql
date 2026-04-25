-- ─────────────────────────────────────────────────────────────────────────────
-- Substations — EIA Form 860 data for CS-active states
-- Used by substationEngine.js for nearest-substation proximity analysis
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists substations (
  id          uuid primary key default gen_random_uuid(),
  state_id    text not null references state_programs(id),
  name        text not null,
  lat         numeric not null,
  lon         numeric not null,
  voltage_kv  numeric,
  capacity_mw numeric,
  utility     text,
  updated_at  timestamptz default now(),
  unique(state_id, name)
);

create trigger substations_updated_at
before update on substations
for each row execute function touch_updated_at();

alter table substations enable row level security;

create policy "public read substations"
  on substations for select using (true);
