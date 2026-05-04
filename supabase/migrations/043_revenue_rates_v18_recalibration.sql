-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — revenue_rates: Lazard LCOE+ v18 recalibration + 9 new states
--
-- Updates 8 originally curated states (IL/NY/MA/MN/CO/NJ/ME/MD) with bumped
-- $/W per Lazard LCOE+ v18 (Jun 2025) — prior values were 2024 vintage and
-- ~$0.30-$0.70/W understated for community-solar scale + domestic content
-- premium under IRA. Aden flagged the gap via field testing 2026-05-04.
--
-- Adds 9 new entries (CA / FL / CT / HI / NM / OR / RI / VA / WA) so all
-- 17 states with cs_status ∈ ('active','limited') have full CS + C&I + BESS
-- depth — closes the "active CS program states should be live in every
-- aspect" gap identified during Site-walk Session 5.
--
-- Sources:
--   CS $/W:    Lazard LCOE+ v18 (Jun 2025) community-solar midpoints + RS
--              Means 2024 state labor multipliers
--   C&I $/W:   Lazard LCOE+ v18 commercial-scale capex + EIA Form 861 retail
--   BESS $/kWh: BloombergNEF 2024 utility-scale 4hr (unchanged for original 8)
--   Bill credits: state PUC tariff filings (DSIRE-tracked)
--   REC pricing: DSIRE state pages + GATS / PJM-EIS / M-RETS
--   Capacity factors: NREL PVWatts API v8 fixed-tilt state averages
--
-- Safe to re-run — uses ON CONFLICT DO UPDATE matching the 003 seed pattern.
-- The hardcoded fallback constants in src/lib/revenueEngine.js mirror these
-- values exactly so the engine resolves to the same numbers whether or not
-- this migration has been applied yet.
-- ─────────────────────────────────────────────────────────────────────────────

insert into revenue_rates (
  state_id,
  bill_credit_cents_kwh, rec_per_mwh, itc_pct, itc_adder_pct,
  capacity_factor_pct, installed_cost_per_watt, degradation_pct, label, notes,
  ci_ppa_rate_cents_kwh, ci_escalator_pct, ci_installed_cost_per_watt,
  ci_itc_pct, ci_capacity_factor_pct, ci_degradation_pct, ci_retail_rate_cents_kwh, ci_label,
  bess_iso_region, bess_capacity_per_kw_year, bess_demand_charge_per_kw_month,
  bess_arbitrage_per_mwh, bess_installed_cost_per_kwh, bess_round_trip_efficiency,
  bess_annual_degradation_pct, bess_itc_pct, bess_label
) values

-- ── 8 originally curated states (recalibrated) ──
('IL', 8.2, 71.50, 30, 10, 17.5, 1.85, 0.5, 'Illinois (ComEd territory)',
 'Illinois Shines REC ~$71.50/MWh + ComEd bill credit ~8.2¢/kWh. ITC 30% + 10% LMI adder where qualifying. $/W per Lazard LCOE+ v18 (mid-cost PJM labor).',
 7.0, 2.0, 2.30, 30, 17.5, 0.5, 12.5, 'Illinois (C&I PPA)',
 'PJM', 65, 12, 30, 380, 0.87, 2.5, 30, 'Illinois (PJM)'),

('NY', 10.5, 0, 30, 10, 14.0, 2.30, 0.5, 'New York (Value Stack)',
 'NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV). No separate SREC market. ITC 30% + Community Adder. $/W per Lazard v18 + NYISO labor premium.',
 8.0, 2.0, 2.55, 30, 14.0, 0.5, 18.5, 'New York (C&I PPA)',
 'NYISO', 70, 14, 35, 400, 0.87, 2.5, 30, 'New York (NYISO)'),

('MA', 12.8, 35.00, 30, 10, 16.5, 2.30, 0.5, 'Massachusetts (SMART 3.0)',
 'Net metering ~12.8¢/kWh. SMART 3.0 adder varies by tranche. SREC-II ~$35/MWh. ITC 30% + LMI adder. $/W per Lazard v18 + ISO-NE labor premium.',
 8.5, 1.5, 2.55, 30, 16.5, 0.5, 22.0, 'Massachusetts (C&I PPA)',
 'ISO-NE', 80, 13, 32, 410, 0.87, 2.5, 30, 'Massachusetts (ISO-NE)'),

('MN', 9.5, 4.50, 30, 0, 15.2, 1.75, 0.5, 'Minnesota (Xcel Energy)',
 'Value-of-Solar ~9.5¢/kWh (Xcel). Minimal REC market (~$4.50/MWh). ITC 30%. $/W per Lazard v18 (low-cost MISO labor).',
 6.5, 2.0, 2.20, 30, 15.2, 0.5, 11.0, 'Minnesota (C&I PPA)',
 'MISO', 40, 10, 22, 360, 0.87, 2.5, 30, 'Minnesota (MISO)'),

('CO', 8.8, 3.00, 30, 0, 18.3, 1.70, 0.5, 'Colorado (Xcel Energy)',
 'Bill credit ~8.8¢/kWh. Minimal REC ($3/MWh). High capacity factor 18.3% (top irradiance). ITC 30%. $/W per Lazard v18 (low-cost SPP labor).',
 6.0, 2.5, 2.10, 30, 18.3, 0.5, 12.0, 'Colorado (C&I PPA)',
 'SPP', 35, 11, 25, 350, 0.87, 2.5, 30, 'Colorado (SPP)'),

('NJ', 11.0, 85.00, 30, 10, 15.5, 2.20, 0.5, 'New Jersey (SREC-II / SuSI)',
 'Net metering ~11¢/kWh. SREC-II / SuSI ~$85/MWh — strongest REC market. ITC 30% + LMI. $/W per Lazard v18 + PJM-NJ labor.',
 7.5, 2.0, 2.45, 30, 15.5, 0.5, 16.0, 'New Jersey (C&I PPA)',
 'PJM', 70, 15, 32, 390, 0.87, 2.5, 30, 'New Jersey (PJM)'),

('ME', 9.0, 8.00, 30, 0, 14.8, 2.15, 0.5, 'Maine',
 'Bill credit ~9¢/kWh. Class I REC ~$8/MWh. ITC 30%. $/W per Lazard v18 + ISO-NE rural labor.',
 6.5, 1.5, 2.30, 30, 14.8, 0.5, 15.5, 'Maine (C&I PPA)',
 'ISO-NE', 75, 11, 28, 400, 0.87, 2.5, 30, 'Maine (ISO-NE)'),

('MD', 9.5, 55.00, 30, 10, 15.8, 2.05, 0.5, 'Maryland',
 'Bill credit ~9.5¢/kWh. SREC ~$55/MWh. ITC 30% + LMI. $/W per Lazard v18 (PJM mid).',
 7.0, 2.0, 2.35, 30, 15.8, 0.5, 13.5, 'Maryland (C&I PPA)',
 'PJM', 60, 13, 28, 375, 0.87, 2.5, 30, 'Maryland (PJM)'),

-- ── 9 new states (full active+limited CS coverage) ──
('CA', 14.0, 5.00, 30, 10, 21.0, 2.40, 0.5, 'California (VNEM / NEM-ST)',
 'Virtual Net Energy Metering blended ~14¢/kWh under NEM-ST. CA RPS REC market thin (~$5/MWh). ITC 30% + LIC adder. CAISO labor premium. CS market is "limited" status as of 2026.',
 9.0, 2.5, 2.65, 30, 21.0, 0.5, 22.0, 'California (C&I PPA)',
 'CAISO', 90, 16, 40, 390, 0.87, 2.5, 30, 'California (CAISO)'),

('FL', 10.0, 0, 30, 0, 18.0, 1.75, 0.5, 'Florida (SolarTogether)',
 'FPL/Duke SolarTogether bill credit ~10¢/kWh. No state REC market. ITC 30%. $/W per Lazard v18 + FL low-labor offset (weather risk premium absorbed in FPL EPC bids). Status "limited" — utility-administered, capped enrollment.',
 6.5, 2.0, 2.10, 30, 18.0, 0.5, 13.0, 'Florida (C&I PPA)',
 'SE', 30, 9, 20, 370, 0.87, 2.5, 30, 'Florida (SE non-RTO)'),

('CT', 12.0, 30.00, 30, 10, 14.5, 2.20, 0.5, 'Connecticut (SCEF)',
 'Shared Clean Energy Facility bill credit ~12¢/kWh. CT Class I REC + ZREC ~$30/MWh. ITC 30% + LMI. $/W per Lazard v18 + ISO-NE labor.',
 8.5, 1.5, 2.40, 30, 14.5, 0.5, 23.0, 'Connecticut (C&I PPA)',
 'ISO-NE', 80, 14, 32, 415, 0.87, 2.5, 30, 'Connecticut (ISO-NE)'),

('HI', 28.0, 0, 30, 0, 19.0, 2.70, 0.5, 'Hawaii (CBRE)',
 'Community-Based Renewable Energy: HECO bill credit ~28¢/kWh (highest in nation). RPS goal-based, no traded REC. ITC 30%. $/W per Lazard v18 + HI island logistics + prevailing-wage premium. Very high IX difficulty (small grid).',
 18.0, 2.0, 3.10, 30, 19.0, 0.5, 38.0, 'Hawaii (C&I PPA)',
 'HECO', 0, 20, 80, 420, 0.87, 2.5, 30, 'Hawaii (HECO IRP)'),

('NM', 10.0, 5.00, 30, 0, 22.0, 1.65, 0.5, 'New Mexico CS',
 'Bill credit ~10¢/kWh. NM RPS REC thin (~$5/MWh). ITC 30%. Strong irradiance drives 22% capacity factor (top in nation). $/W per Lazard v18 (low-cost WECC labor).',
 6.0, 2.5, 2.00, 30, 22.0, 0.5, 11.0, 'New Mexico (C&I PPA)',
 'WECC', 50, 10, 25, 355, 0.87, 2.5, 30, 'New Mexico (WECC)'),

('OR', 10.0, 5.00, 30, 0, 14.5, 1.95, 0.5, 'Oregon CS',
 'Oregon CS Program bill credit ~10¢/kWh. OR RPS REC ~$5/MWh. ITC 30%. $/W per Lazard v18 (Pacific NW labor).',
 6.0, 2.0, 2.20, 30, 14.5, 0.5, 11.0, 'Oregon (C&I PPA)',
 'WECC', 40, 10, 22, 370, 0.87, 2.5, 30, 'Oregon (WECC)'),

('RI', 13.0, 45.00, 30, 10, 14.5, 2.20, 0.5, 'Rhode Island CS',
 'Rhode Island CS bill credit ~13¢/kWh. RI Class I REC ~$45/MWh (strong). ITC 30% + LMI. $/W per Lazard v18 + ISO-NE labor.',
 8.0, 1.5, 2.40, 30, 14.5, 0.5, 22.0, 'Rhode Island (C&I PPA)',
 'ISO-NE', 78, 13, 30, 410, 0.87, 2.5, 30, 'Rhode Island (ISO-NE)'),

('VA', 9.0, 15.00, 30, 0, 17.0, 1.95, 0.5, 'Virginia CS',
 'Virginia Shared Solar bill credit ~9¢/kWh. VA REC market ~$15/MWh. ITC 30%. $/W per Lazard v18 (PJM-South labor).',
 6.5, 2.0, 2.20, 30, 17.0, 0.5, 12.0, 'Virginia (C&I PPA)',
 'PJM', 60, 12, 28, 385, 0.87, 2.5, 30, 'Virginia (PJM)'),

('WA', 9.0, 3.00, 30, 0, 13.5, 1.95, 0.5, 'Washington (Shared Renewables)',
 'Washington Shared Renewables bill credit ~9¢/kWh. WA REC market thin (~$3/MWh). ITC 30%. $/W per Lazard v18 (Pacific NW labor). Lowest-irradiance state — 13.5% CF.',
 5.5, 2.0, 2.20, 30, 13.5, 0.5, 10.0, 'Washington (C&I PPA)',
 'WECC', 30, 9, 20, 370, 0.87, 2.5, 30, 'Washington (WECC)')

on conflict (state_id) do update set
  bill_credit_cents_kwh = excluded.bill_credit_cents_kwh,
  rec_per_mwh = excluded.rec_per_mwh,
  itc_pct = excluded.itc_pct,
  itc_adder_pct = excluded.itc_adder_pct,
  capacity_factor_pct = excluded.capacity_factor_pct,
  installed_cost_per_watt = excluded.installed_cost_per_watt,
  degradation_pct = excluded.degradation_pct,
  label = excluded.label,
  notes = excluded.notes,
  ci_ppa_rate_cents_kwh = excluded.ci_ppa_rate_cents_kwh,
  ci_escalator_pct = excluded.ci_escalator_pct,
  ci_installed_cost_per_watt = excluded.ci_installed_cost_per_watt,
  ci_itc_pct = excluded.ci_itc_pct,
  ci_capacity_factor_pct = excluded.ci_capacity_factor_pct,
  ci_degradation_pct = excluded.ci_degradation_pct,
  ci_retail_rate_cents_kwh = excluded.ci_retail_rate_cents_kwh,
  ci_label = excluded.ci_label,
  bess_iso_region = excluded.bess_iso_region,
  bess_capacity_per_kw_year = excluded.bess_capacity_per_kw_year,
  bess_demand_charge_per_kw_month = excluded.bess_demand_charge_per_kw_month,
  bess_arbitrage_per_mwh = excluded.bess_arbitrage_per_mwh,
  bess_installed_cost_per_kwh = excluded.bess_installed_cost_per_kwh,
  bess_round_trip_efficiency = excluded.bess_round_trip_efficiency,
  bess_annual_degradation_pct = excluded.bess_annual_degradation_pct,
  bess_itc_pct = excluded.bess_itc_pct,
  bess_label = excluded.bess_label;
