-- Migration 050: cs_projects — per-project operating community-solar truth from
-- NREL "Sharing the Sun" (https://www.nrel.gov/solar/market-research-analysis/community-solar-data.html).
--
-- ── Why this table ─────────────────────────────────────────────────────────
-- Tractova's "comparable deals" surface has been hand-curated. Sharing the
-- Sun publishes ~3,800 individual operating CS projects with utility,
-- developer, capacity, vintage, and LMI attribution. That's an order of
-- magnitude more ground truth than anything we synthesize, and it's
-- CS-specific (not utility-scale ≥1 MW like EIA Form 860).
--
-- Use cases this unlocks:
--   • Per-state market-reality check: "IL has 261 operating CS projects
--     totaling 512 MW, vintage 2014-2024, top developer Today's Power".
--     Real signal vs synthesized state_programs.cs_status alone.
--   • Real comparables for the Lens — replaces curated comparable_deals
--     with actual nearby operating projects matching MW + state + tech.
--   • LMI deployment penetration per state (informs §48(e) Cat 1 patterns).
--   • Developer concentration — which companies are active where.
--
-- ── Data lineage ───────────────────────────────────────────────────────────
-- Source:  NREL "Sharing the Sun: Community Solar Project Data"
-- File:    Sharing the Sun Community Solar Project Data (Jan 2026).xlsx
-- Sheet:   "Project List"  (4280 rows, 24 useful columns; cols 24-46 null)
-- Filter:  Aggregated Data Entry = 'No' (individual projects only) +
--          state ∈ valid USPS + Year of Interconnection populated.
-- Cadence: NREL releases Sharing the Sun ~quarterly (most recent Jan 2026,
--          covering through Q4 2024 install data). Refresh path is the
--          local seed script (scripts/seed-cs-projects.mjs) — same as
--          solar_cost_index. No cron auto-fetch (NREL's Drupal/Cloudflare
--          stack blocks server-to-server like LBNL).
--
-- ── Schema notes ───────────────────────────────────────────────────────────
-- Project ID is the natural key (e.g. 'P_186999346'). Unique per release.
-- LMI fields default null when source value is 'Unknown' — Sharing the Sun
-- uses 'Unknown' liberally for older / non-NY/MA projects where LMI
-- subscription data isn't tracked. Don't conflate 'Unknown' with 'No'.
--
-- Idempotent: re-running the seed script upserts by project_id.

create table if not exists cs_projects (
  project_id            text primary key,                 -- e.g. 'P_186999346'
  utility_id            int,                              -- EIA utility ID
  project_name          text not null,
  city                  text,
  state                 text not null,                    -- USPS code
  utility_name          text,
  utility_type          text,                             -- 'Cooperative' | 'Investor Owned' | 'Municipal' | 'Political Subdivision' | …
  subscription_marketer text,                             -- 'Utility' | 'Third-party' | 'Combination' | …
  program_name          text,                             -- often null; populated when project ties to a named program
  developer_name        text,                             -- normalized; '.' source value coerced to null in seed
  system_size_mw_ac     numeric(10, 3),
  system_size_mw_dc     numeric(10, 3),
  vintage_year          int,                              -- Year of Interconnection
  lmi_required          boolean,                          -- 'Does this Project have LMI Portion Requirement?' Yes→true, No→false, Unknown→null
  lmi_portion_pct       numeric(5, 2),                    -- 0-100; null when source is 'Unknown'
  lmi_size_mw_ac        numeric(10, 3),                   -- null when source is 'Unknown'
  source                text not null default 'NREL_SHARING_THE_SUN',
  source_release        text,                             -- e.g. 'Jan 2026'

  last_updated          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists cs_projects_state_idx on cs_projects (state);
create index if not exists cs_projects_state_vintage_idx on cs_projects (state, vintage_year desc);
create index if not exists cs_projects_state_size_idx on cs_projects (state, system_size_mw_ac desc);

drop trigger if exists cs_projects_updated_at on cs_projects;
create trigger cs_projects_updated_at
before update on cs_projects
for each row execute function touch_updated_at();

alter table cs_projects enable row level security;

drop policy if exists "cs_projects public read" on cs_projects;
create policy "cs_projects public read"
  on cs_projects for select
  using (true);

drop policy if exists "cs_projects admin insert" on cs_projects;
create policy "cs_projects admin insert"
  on cs_projects for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "cs_projects admin update" on cs_projects;
create policy "cs_projects admin update"
  on cs_projects for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
