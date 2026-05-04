-- Migration 053: cs_specific_yield — per-project observed Specific Yield
-- (energy production / installed capacity) from CS-developer public fleets.
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- Tractova currently uses NREL PVWatts modeled state-average capacity
-- factors as the single source for energy production estimates. PVWatts
-- assumes ideal tilt, no soiling, no inverter clipping under real
-- conditions, no downtime, no mismatch losses. Real-world observed
-- capacity factors run 5–10% below modeled. That delta is a real data-
-- validity gap that's visible in operating-fleet data of CS developers
-- who publish per-project size + production.
--
-- Concrete probe (2026-05-04): Adamstown Solar (Nexamp, MD) 2,589 kW AC
-- × 3,210,509 kWh annual = observed capacity factor 14.2%. Tractova's
-- seeded MD value is 15.8% (PVWatts state-average). 10% real delta.
--
-- ── Data sources ───────────────────────────────────────────────────────────
-- After scrape-checking 18 major CS developers on 2026-05-04, three
-- publish enough per-project data for SY ingestion:
--   NEXAMP_PUBLIC      ~300-500 projects, AC kW + annual kWh + state +
--                       town + panel count
--   SR_ENERGY_PUBLIC    ~80-150 projects (~30-60% with full data),
--                       DC kW + annual kWh + state
--   CATALYZE_PUBLIC     ~30 projects (~30% with full data), size + state
--                       + city; production sparse — drop rows missing it
-- Other 15 developers reviewed: Standard Solar (no size/production),
-- Soltage (capacity only), Madison Energy Infrastructure (capacity only,
-- utility-skewed), BlueWave / AES / Borrego / NEE / Coronal (inaccessible),
-- Pivot / Cypress Creek / US Solar (aggregate-only), New Leaf (bot-blocked),
-- Lightsource bp (utility-only), IGS (phone-gated). All listed in
-- Privacy.jsx for full review transparency. See plan
-- ~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md.
--
-- ── Capacity-basis mixing ──────────────────────────────────────────────────
-- Nexamp publishes AC; SR Energy + Catalyze publish DC. Specific Yield
-- against AC is ~17–22% higher than against DC (per typical 1.2x DC/AC
-- ratio). The capacity_basis column lets per-state aggregation compute
-- separately for AC-basis and DC-basis rows OR normalize to AC. UI
-- decides; engine math unchanged either way (PVWatts stays primary).
--
-- ── Engine integration ─────────────────────────────────────────────────────
-- This is a data-lineage layer, not engine input. Engine continues
-- reading capacity_factor from revenue_rates / PVWatts. UI surfaces
-- observed SY alongside modeled with explicit attribution + caveat.
-- Same architectural pattern as Phase B's solar_cost_index.
--
-- Idempotent. Safe to re-run.
-- Depends on Phase E migration 052 having shipped (re-uses tier
-- terminology in seed-script console output, but no schema dependency).

create table if not exists cs_specific_yield (
  project_id              text primary key,                          -- e.g. 'NEXAMP:adamstown-solar', 'SRENERGY:bomber', 'CATALYZE:jessup'
  project_name            text not null,
  source                  text not null,                             -- 'NEXAMP_PUBLIC' | 'SR_ENERGY_PUBLIC' | 'CATALYZE_PUBLIC'
  source_url              text not null,

  state                   text not null,                             -- USPS code
  city                    text,
  county_fips             text,                                      -- nullable; reserved for future geocoding

  system_size_kw_ac       numeric(10, 2),                            -- AC where source publishes AC (Nexamp)
  system_size_kw_dc       numeric(10, 2),                            -- DC where source publishes DC (SR Energy / Catalyze)
  capacity_basis          text not null,                             -- 'AC' | 'DC' — which capacity drives the SY denominator

  annual_production_kwh         numeric(14, 0) not null,
  specific_yield_kwh_per_kwp_yr numeric(7, 1) not null,              -- = annual / capacity_kw_basis
  observed_capacity_factor_pct  numeric(5, 2) not null,              -- = SY / 8760 * 100

  cod_year                int,                                       -- nullable when source doesn't publish; sanity bound covers partial-year rows
  panel_count             int,                                       -- Nexamp publishes; nullable
  tracking_type           text,                                      -- 'fixed-tilt' | 'single-axis' | 'tracker' (Nexamp); nullable

  last_updated            timestamptz not null default now(),
  created_at              timestamptz not null default now(),

  constraint cs_specific_yield_basis_check check (capacity_basis in ('AC', 'DC')),
  constraint cs_specific_yield_sanity_check check (
    specific_yield_kwh_per_kwp_yr between 600 and 2400
  ),
  constraint cs_specific_yield_unique_per_source unique (source, project_name, state)
);

create index if not exists cs_specific_yield_state_idx
  on cs_specific_yield (state);
create index if not exists cs_specific_yield_state_basis_idx
  on cs_specific_yield (state, capacity_basis);
create index if not exists cs_specific_yield_source_idx
  on cs_specific_yield (source);

drop trigger if exists cs_specific_yield_updated_at on cs_specific_yield;
create trigger cs_specific_yield_updated_at
before update on cs_specific_yield
for each row execute function touch_updated_at();

alter table cs_specific_yield enable row level security;

drop policy if exists "cs_specific_yield public read" on cs_specific_yield;
create policy "cs_specific_yield public read"
  on cs_specific_yield for select
  using (true);

drop policy if exists "cs_specific_yield admin insert" on cs_specific_yield;
create policy "cs_specific_yield admin insert"
  on cs_specific_yield for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "cs_specific_yield admin update" on cs_specific_yield;
create policy "cs_specific_yield admin update"
  on cs_specific_yield for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
