-- ─────────────────────────────────────────────────────────────────────────────
-- Revenue Rates — state-level rate data for revenue projections
-- Replaces hardcoded STATE_REVENUE_DATA, CI_REVENUE_DATA, BESS_REVENUE_DATA
-- in src/lib/revenueEngine.js
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists revenue_rates (
  state_id                text primary key references state_programs(id),
  -- Community Solar
  bill_credit_cents_kwh   numeric,
  rec_per_mwh             numeric,
  itc_pct                 numeric,
  itc_adder_pct           numeric,
  capacity_factor_pct     numeric,
  installed_cost_per_watt numeric,
  degradation_pct         numeric,
  label                   text,
  notes                   text,
  -- C&I Solar (PPA model)
  ci_ppa_rate_cents_kwh   numeric,
  ci_escalator_pct        numeric,
  ci_installed_cost_per_watt numeric,
  ci_itc_pct              numeric,
  ci_capacity_factor_pct  numeric,
  ci_degradation_pct      numeric,
  ci_retail_rate_cents_kwh numeric,
  ci_label                text,
  -- BESS (capacity + demand + arbitrage)
  bess_iso_region         text,
  bess_capacity_per_kw_year numeric,
  bess_demand_charge_per_kw_month numeric,
  bess_arbitrage_per_mwh  numeric,
  bess_installed_cost_per_kwh numeric,
  bess_round_trip_efficiency numeric,
  bess_annual_degradation_pct numeric,
  bess_itc_pct            numeric,
  bess_label              text,
  --
  updated_at              timestamptz default now()
);

create trigger revenue_rates_updated_at
before update on revenue_rates
for each row execute function touch_updated_at();

alter table revenue_rates enable row level security;

create policy "public read revenue_rates"
  on revenue_rates for select using (true);
