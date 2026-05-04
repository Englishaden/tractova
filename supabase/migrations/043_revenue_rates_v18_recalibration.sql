-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — revenue_rates: Lazard LCOE+ v18 (literal) recalibration + 9 new states
--
-- ── Sources, separated literal-from-synthesis ──
--
-- LAZARD LCOE+ v18.0 (June 2025), page 34 ("LCOE--Key Assumptions") —
--   what Lazard literally publishes:
--   - Solar PV—Community and C&I (one combined category):
--       Total Capital Cost: $1,600 – $3,300 / kW   ($1.60 – $3.30/W)
--       Fixed O&M:          $13.00 – $20.00 / kW-yr
--       Capacity Factor:    20% – 15%
--       Facility Life:      30 years
--       Net Facility Output: 2.0 MW (Lazard's assumed scale)
--   - Solar PV—Utility:
--       Total Capital Cost: $1,150 – $1,600 / kW   ($1.15 – $1.60/W)
--       LCOE:               $38 – $78/MWh
--
--   PDF copy at /public/Lazard LCOE June 2025.pdf in the repo for audit.
--
-- TRACTOVA SYNTHESIS on top of Lazard:
--   - Per-state $/W is Tractova's allocation across Lazard's $1.60-$3.30/W
--     range. Allocation is editorial judgment based on RS Means 2024 labor
--     index + observed permitting/IX friction + DSIRE program complexity.
--     Median allocation $2.30/W (slightly below Lazard mid $2.45/W) reflects
--     Tractova's typical 3-5 MW project size > Lazard's 2 MW assumption.
--   - Capacity Factor uses NREL PVWatts API v8 STATE averages (state-specific,
--     finer-grained than Lazard's 15-20% national bracket).
--   - Bill credits per state: state PUC tariffs tracked via DSIRE.
--   - REC prices per state: DSIRE + NEPOOL GIS / PJM-EIS GATS / WREGIS / M-RETS.
--   - ITC: federal §48, 30% base + 10% adders per state qualifying status.
--
-- BESS values: BloombergNEF 2024 utility-scale 4hr capex + ISO/RTO clearing
-- prices for capacity payments. Lazard v18 has a separate LCOS chapter
-- (page 17+) but Tractova uses BloombergNEF for cell-level primary.
--
-- ── Updates over migration 003 + earlier migration-043 attempt ──
--
-- 8 originally curated states (IL/NY/MA/MN/CO/NJ/ME/MD): bumped CS $/W to
-- align with Lazard v18 actual $1.60-$3.30/W range. Prior recalibration
-- (committed earlier 2026-05-04) was still ~$0.20-$0.40/W understated because
-- it used a synthesized national midpoint rather than Lazard's published
-- range.
--
-- 9 new states (CA / FL / CT / HI / NM / OR / RI / VA / WA): closes the
-- gap that the 17 cs_status ∈ ('active','limited') states should all have
-- full CS + C&I + BESS depth.
--
-- Safe to re-run — ON CONFLICT DO UPDATE pattern matches 003 seed.
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

-- ── 8 originally curated states (recalibrated against literal Lazard v18 page 34) ──
('IL', 8.2, 71.50, 30, 10, 17.5, 2.10, 0.5, 'Illinois (ComEd territory)',
 'Illinois Shines REC ~$71.50/MWh (DSIRE) + ComEd bill credit ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder where qualifying. $/W in lower-mid Lazard v18 $1.60-$3.30/W range — PJM mid-cost labor + scale economies vs Lazard 2 MW assumption.',
 7.0, 2.0, 2.30, 30, 17.5, 0.5, 12.5, 'Illinois (C&I PPA)',
 'PJM', 65, 12, 30, 380, 0.87, 2.5, 30, 'Illinois (PJM)'),

('NY', 10.5, 0, 30, 10, 14.0, 2.75, 0.5, 'New York (Value Stack)',
 'NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). No separate SREC market. ITC 30% + Community Adder. $/W in upper-mid Lazard v18 range — NYISO labor premium + NY-Sun siting friction.',
 8.0, 2.0, 2.55, 30, 14.0, 0.5, 18.5, 'New York (C&I PPA)',
 'NYISO', 70, 14, 35, 400, 0.87, 2.5, 30, 'New York (NYISO)'),

('MA', 12.8, 35.00, 30, 10, 16.5, 2.75, 0.5, 'Massachusetts (SMART 3.0)',
 'Net metering ~12.8¢/kWh. SMART 3.0 adder varies by tranche (DOER tariff). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder. $/W in upper-mid Lazard v18 range — ISO-NE labor + SMART permitting overhead.',
 8.5, 1.5, 2.55, 30, 16.5, 0.5, 22.0, 'Massachusetts (C&I PPA)',
 'ISO-NE', 80, 13, 32, 410, 0.87, 2.5, 30, 'Massachusetts (ISO-NE)'),

('MN', 9.5, 4.50, 30, 0, 15.2, 2.00, 0.5, 'Minnesota (Xcel Energy)',
 'Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC market (~$4.50/MWh, M-RETS). ITC 30%. $/W in lower Lazard v18 range — MISO Upper Midwest labor.',
 6.5, 2.0, 2.20, 30, 15.2, 0.5, 11.0, 'Minnesota (C&I PPA)',
 'MISO', 40, 10, 22, 360, 0.87, 2.5, 30, 'Minnesota (MISO)'),

('CO', 8.8, 3.00, 30, 0, 18.3, 1.90, 0.5, 'Colorado (Xcel Energy)',
 'Bill credit ~8.8¢/kWh (PUC tariff). Minimal REC market ($3/MWh, WREGIS). NREL PVWatts CF 18.3% (top quartile). ITC 30%. $/W near Lazard v18 floor — SPP low-cost labor + premium siting.',
 6.0, 2.5, 2.10, 30, 18.3, 0.5, 12.0, 'Colorado (C&I PPA)',
 'SPP', 35, 11, 25, 350, 0.87, 2.5, 30, 'Colorado (SPP)'),

('NJ', 11.0, 85.00, 30, 10, 15.5, 2.65, 0.5, 'New Jersey (SREC-II / SuSI)',
 'Net metering ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI. $/W in upper Lazard v18 range — PJM-NJ labor + SREC market complexity.',
 7.5, 2.0, 2.45, 30, 15.5, 0.5, 16.0, 'New Jersey (C&I PPA)',
 'PJM', 70, 15, 32, 390, 0.87, 2.5, 30, 'New Jersey (PJM)'),

('ME', 9.0, 8.00, 30, 0, 14.8, 2.45, 0.5, 'Maine',
 'Bill credit ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%. $/W at Lazard v18 midpoint — ISO-NE rural labor.',
 6.5, 1.5, 2.30, 30, 14.8, 0.5, 15.5, 'Maine (C&I PPA)',
 'ISO-NE', 75, 11, 28, 400, 0.87, 2.5, 30, 'Maine (ISO-NE)'),

('MD', 9.5, 55.00, 30, 10, 15.8, 2.30, 0.5, 'Maryland',
 'Bill credit ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI. $/W at Lazard v18 midpoint — PJM-mid labor.',
 7.0, 2.0, 2.35, 30, 15.8, 0.5, 13.5, 'Maryland (C&I PPA)',
 'PJM', 60, 13, 28, 375, 0.87, 2.5, 30, 'Maryland (PJM)'),

-- ── 9 new states (full active+limited CS coverage) ──
('CA', 14.0, 5.00, 30, 10, 21.0, 2.85, 0.5, 'California (VNEM / NEM-ST)',
 'Virtual Net Energy Metering blended ~14¢/kWh under NEM-ST (CPUC tariff). CA RPS REC market thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. $/W in upper Lazard v18 range — CAISO labor + IX backlog. CS market "limited" status 2026.',
 9.0, 2.5, 2.65, 30, 21.0, 0.5, 22.0, 'California (C&I PPA)',
 'CAISO', 90, 16, 40, 390, 0.87, 2.5, 30, 'California (CAISO)'),

('FL', 10.0, 0, 30, 0, 18.0, 1.95, 0.5, 'Florida (SolarTogether)',
 'FPL/Duke SolarTogether bill credit ~10¢/kWh (utility tariff). No state REC market. ITC 30%. $/W in lower Lazard v18 range — FL low labor; weather risk priced into FPL EPC bids. Status "limited" — utility-administered, capped enrollment.',
 6.5, 2.0, 2.10, 30, 18.0, 0.5, 13.0, 'Florida (C&I PPA)',
 'SE', 30, 9, 20, 370, 0.87, 2.5, 30, 'Florida (SE non-RTO)'),

('CT', 12.0, 30.00, 30, 10, 14.5, 2.65, 0.5, 'Connecticut (SCEF)',
 'Shared Clean Energy Facility bill credit ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI. $/W in upper Lazard v18 range — ISO-NE labor.',
 8.5, 1.5, 2.40, 30, 14.5, 0.5, 23.0, 'Connecticut (C&I PPA)',
 'ISO-NE', 80, 14, 32, 415, 0.87, 2.5, 30, 'Connecticut (ISO-NE)'),

('HI', 28.0, 0, 30, 0, 19.0, 3.10, 0.5, 'Hawaii (CBRE)',
 'Community-Based Renewable Energy: HECO bill credit ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%. $/W near Lazard v18 ceiling — HI island logistics + prevailing-wage + small-grid IX overhead.',
 18.0, 2.0, 3.10, 30, 19.0, 0.5, 38.0, 'Hawaii (C&I PPA)',
 'HECO', 0, 20, 80, 420, 0.87, 2.5, 30, 'Hawaii (HECO IRP)'),

('NM', 10.0, 5.00, 30, 0, 22.0, 1.85, 0.5, 'New Mexico CS',
 'Bill credit ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%. NREL PVWatts CF 22% (top in nation). $/W near Lazard v18 floor — WECC low-cost labor.',
 6.0, 2.5, 2.00, 30, 22.0, 0.5, 11.0, 'New Mexico (C&I PPA)',
 'WECC', 50, 10, 25, 355, 0.87, 2.5, 30, 'New Mexico (WECC)'),

('OR', 10.0, 5.00, 30, 0, 14.5, 2.25, 0.5, 'Oregon CS',
 'Oregon CS Program bill credit ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%. $/W in lower-mid Lazard v18 range — Pacific NW labor.',
 6.0, 2.0, 2.20, 30, 14.5, 0.5, 11.0, 'Oregon (C&I PPA)',
 'WECC', 40, 10, 22, 370, 0.87, 2.5, 30, 'Oregon (WECC)'),

('RI', 13.0, 45.00, 30, 10, 14.5, 2.55, 0.5, 'Rhode Island CS',
 'Rhode Island CS bill credit ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI. $/W in upper-mid Lazard v18 range — ISO-NE labor.',
 8.0, 1.5, 2.40, 30, 14.5, 0.5, 22.0, 'Rhode Island (C&I PPA)',
 'ISO-NE', 78, 13, 30, 410, 0.87, 2.5, 30, 'Rhode Island (ISO-NE)'),

('VA', 9.0, 15.00, 30, 0, 17.0, 2.20, 0.5, 'Virginia CS',
 'Virginia Shared Solar bill credit ~9¢/kWh (SCC tariff). VA REC market ~$15/MWh (PJM-EIS). ITC 30%. $/W in lower-mid Lazard v18 range — PJM-South labor.',
 6.5, 2.0, 2.20, 30, 17.0, 0.5, 12.0, 'Virginia (C&I PPA)',
 'PJM', 60, 12, 28, 385, 0.87, 2.5, 30, 'Virginia (PJM)'),

('WA', 9.0, 3.00, 30, 0, 13.5, 2.25, 0.5, 'Washington (Shared Renewables)',
 'Washington Shared Renewables bill credit ~9¢/kWh (UTC tariff). WA REC market thin (~$3/MWh, WREGIS). ITC 30%. NREL PVWatts CF 13.5% (lowest-irradiance state). $/W in lower-mid Lazard v18 range — Pacific NW labor.',
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
