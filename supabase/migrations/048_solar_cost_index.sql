-- Migration 048: solar_cost_index — per-state observed installed-PV-cost
-- percentiles from LBNL Tracking the Sun (TTS). Stores OBSERVED upstream
-- truth. The engine still reads Tractova's 2026-forward synthesis from
-- revenue_rates.installed_cost_per_watt; this table is the data-lineage
-- layer the Lens methodology dropdown surfaces alongside the synthesized
-- value (literal LBNL median + sample size + vintage stamp).
--
-- Why a separate table (vs columns on revenue_rates):
--   revenue_rates carries Tractova-synthesized 2026 forward values
--   (NREL CS MMP $1.76 + +22%/yr forward, per migration 044). LBNL TTS is
--   2-year-lagged observed data. Mixing them in one table fights the
--   "two-layer citations" pattern from the data-trust audit. Separate
--   tables keep the upstream truth and the synthesis cleanly distinguished.
--
-- Cadence: refresh annually each November (LBNL releases new TTS in
-- mid-October; we run the cron Nov 1 at 08:00 UTC for a 2-week buffer).
-- Refresh path: api/refresh-data.js?source=solar_costs (Vercel cron) or
-- scripts/seed-solar-cost-index.mjs (local one-shot for the inaugural seed
-- and any out-of-band catch-up).
--
-- Idempotent. Safe to re-run; CREATE TABLE IF NOT EXISTS + ON CONFLICT in
-- the upserts keeps both the cron and the seed script collision-free.

create table if not exists solar_cost_index (
  id                  uuid primary key default gen_random_uuid(),
  state               text not null,                -- USPS state code (NY, MA, …)
  sector              text not null,                -- 'large_non_res' (Phase B); residential/small_non_res/utility reserved
  vintage_year        int  not null,                -- latest install year in the aggregation window
  vintage_window      text not null,                -- human-readable e.g. '2022-2024'
  install_count       int  not null,                -- sample size for the bucket

  p10_per_watt        numeric(5, 2),
  p25_per_watt        numeric(5, 2),
  p50_per_watt        numeric(5, 2) not null,       -- median, primary value for downstream consumers
  p75_per_watt        numeric(5, 2),
  p90_per_watt        numeric(5, 2),

  source              text not null,                -- 'LBNL_TTS' | 'EIA_FORM_860' | 'TRACTOVA_FALLBACK'
  source_url          text,
  notes               text,                         -- optional caveat (low n, regional analog, etc.)

  last_updated        timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  unique (state, sector, vintage_year, source)
);

create index if not exists solar_cost_index_lookup
  on solar_cost_index (state, sector, vintage_year desc);

create index if not exists solar_cost_index_state_idx
  on solar_cost_index (state);

-- updated_at trigger pattern (mirrors county_geospatial_data + revenue_rates)
drop trigger if exists solar_cost_index_updated_at on solar_cost_index;
create trigger solar_cost_index_updated_at
before update on solar_cost_index
for each row execute function touch_updated_at();

alter table solar_cost_index enable row level security;

drop policy if exists "solar_cost_index public read" on solar_cost_index;
create policy "solar_cost_index public read"
  on solar_cost_index for select
  using (true);

drop policy if exists "solar_cost_index admin insert" on solar_cost_index;
create policy "solar_cost_index admin insert"
  on solar_cost_index for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "solar_cost_index admin update" on solar_cost_index;
create policy "solar_cost_index admin update"
  on solar_cost_index for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
