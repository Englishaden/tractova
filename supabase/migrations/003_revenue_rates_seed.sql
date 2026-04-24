-- ─────────────────────────────────────────────────────────────────────────────
-- Revenue Rates — seed from static revenueEngine.js values
-- Safe to re-run — uses ON CONFLICT DO UPDATE.
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
('IL', 8.2, 71.50, 30, 10, 17.5, 1.65, 0.5, 'Illinois (ComEd territory)',
 'Bill credit = supply + transmission (~8.2¢/kWh ComEd). REC via Illinois Shines (~$71.50/REC). ITC 30% + 10% LMI adder if qualifying.',
 7.0, 2.0, 2.20, 30, 17.5, 0.5, 12.5, 'Illinois (C&I PPA)',
 'PJM', 65, 12, 30, 380, 0.87, 2.5, 30, 'Illinois (PJM)'),

('NY', 10.5, 0, 30, 10, 16.0, 1.80, 0.5, 'New York (ConEd territory)',
 'Value Stack compensation (~10.5¢/kWh blended LBMP + ICAP + E + DRV). No separate SREC market. ITC 30% + Community Adder where available.',
 8.0, 2.0, 2.40, 30, 16.0, 0.5, 18.5, 'New York (C&I PPA)',
 'NYISO', 70, 14, 35, 400, 0.87, 2.5, 30, 'New York (NYISO)'),

('MA', 12.8, 35.00, 30, 10, 16.5, 1.75, 0.5, 'Massachusetts (SMART 3.0)',
 'Net metering credit ~12.8¢/kWh. SMART 3.0 adder varies by tranche. SREC-II traded ~$35/MWh. ITC 30% + LMI adder potential.',
 8.5, 1.5, 2.35, 30, 16.5, 0.5, 22.0, 'Massachusetts (C&I PPA)',
 'ISO-NE', 80, 13, 32, 410, 0.87, 2.5, 30, 'Massachusetts (ISO-NE)'),

('MN', 9.5, 4.50, 30, 0, 16.0, 1.60, 0.5, 'Minnesota (Xcel Energy)',
 'Value-of-Solar rate ~9.5¢/kWh (Xcel). Minimal REC market (~$4.50/MWh). ITC 30% base, no state adder currently.',
 6.5, 2.0, 2.10, 30, 16.0, 0.5, 11.0, 'Minnesota (C&I PPA)',
 'MISO', 40, 10, 22, 360, 0.87, 2.5, 30, 'Minnesota (MISO)'),

('CO', 8.8, 3.00, 30, 0, 20.0, 1.55, 0.5, 'Colorado (Xcel Energy)',
 'Bill credit ~8.8¢/kWh. Minimal REC value (~$3/MWh). Strong irradiance drives higher capacity factor (~20%). ITC 30%.',
 6.0, 2.5, 2.00, 30, 20.0, 0.5, 12.0, 'Colorado (C&I PPA)',
 'SPP', 35, 11, 25, 350, 0.87, 2.5, 30, 'Colorado (SPP)'),

('NJ', 11.0, 85.00, 30, 10, 16.5, 1.70, 0.5, 'New Jersey (SREC-II / SuSI)',
 'Net metering ~11¢/kWh. SREC-II / SuSI market ~$85/MWh — one of the strongest REC markets. ITC 30% + LMI adder.',
 7.5, 2.0, 2.30, 30, 16.5, 0.5, 16.0, 'New Jersey (C&I PPA)',
 'PJM', 70, 15, 32, 390, 0.87, 2.5, 30, 'New Jersey (PJM)'),

('ME', 9.0, 8.00, 30, 0, 15.5, 1.70, 0.5, 'Maine',
 'Bill credit ~9¢/kWh. Modest REC value. ITC 30%.',
 6.5, 1.5, 2.15, 30, 15.5, 0.5, 15.5, 'Maine (C&I PPA)',
 'ISO-NE', 75, 11, 28, 400, 0.87, 2.5, 30, 'Maine (ISO-NE)'),

('MD', 9.5, 55.00, 30, 10, 17.0, 1.65, 0.5, 'Maryland',
 'Bill credit ~9.5¢/kWh. SREC market ~$55/MWh. ITC 30% + LMI adder. Community Solar Pilot Program.',
 7.0, 2.0, 2.20, 30, 17.0, 0.5, 13.5, 'Maryland (C&I PPA)',
 'PJM', 60, 13, 28, 375, 0.87, 2.5, 30, 'Maryland (PJM)')

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
