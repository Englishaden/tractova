-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066: hosting_capacity_data — distribution grid HEADROOM per utility
--
-- A NEW, SEPARATE signal feeding the Interconnection (IX) pillar as live CONTEXT.
-- Distinct from county_geospatial_data (NWI wetlands + SSURGO farmland → SITE
-- pillar) — different source, different metric, different pillar, NO overlap.
--
-- What it measures: how much more DG (MW) a utility's distribution grid can
-- absorb — sourced from utility hosting-capacity / ICA ArcGIS feature services
-- (EPRI-format "available capacity" grids). Aggregated server-side per utility:
-- what fraction of grid cells still have meaningful open capacity, + avg/max MW.
-- This is grid HEADROOM, not a project queue — shown as live context, the IX
-- score stays on the curated ixDifficulty baseline (same honesty rule as the
-- cs_pipeline sources). See docs/hosting-capacity-sourcing.md.
--
-- v1 is utility-level (county_fips nullable, reserved for a future geometry-based
-- county rollup). Keyed (state, utility_name) like ix_queue_data.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists hosting_capacity_data (
  id                  uuid primary key default gen_random_uuid(),
  state               text not null references state_programs(id),
  utility_name        text not null,
  county_fips         text,                       -- null = utility-level (v1); set for future county rollup
  grid_resolution     text,                       -- e.g. 'mile_square'
  metric_field        text,                       -- source field aggregated, e.g. 'feeder_avail_cap_mw'
  total_cells         integer,                    -- grid cells evaluated
  cells_with_capacity integer,                    -- cells at/above the CS-relevant headroom threshold
  capacity_threshold_mw numeric,                  -- the threshold used (e.g. 5)
  pct_with_capacity   numeric,                    -- cells_with_capacity / total_cells * 100
  avg_avail_mw        numeric,                    -- mean available MW across cells
  max_avail_mw        numeric,                    -- max available MW
  data_source         text default 'arcgis_hc',
  data_source_url     text,
  fetched_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (state, utility_name)
);

create index if not exists hosting_capacity_state_idx on hosting_capacity_data (state);

create trigger hosting_capacity_data_updated_at
before update on hosting_capacity_data
for each row execute function touch_updated_at();

alter table hosting_capacity_data enable row level security;

drop policy if exists "public read hosting_capacity_data" on hosting_capacity_data;
create policy "public read hosting_capacity_data"
  on hosting_capacity_data for select using (true);
