-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — revenue_rates: CS $/W re-anchored on LBNL TTS 2024 +
-- Tractova 2024→2026 forward (supersedes 043 for the CS $/W column only)
--
-- Aden flagged 2026-05-04 that the Lazard v18-anchored values from migration 043
-- understated real-world IL CS quotes ($2.6-$3.0/W EPC with domestic content).
-- Root cause: Lazard publishes a "Community & C&I" combined national range
-- ($1.60-$3.30/W) but doesn't publish per-state. Tractova's state allocation
-- across that range was synthesis, not data.
--
-- ── Re-anchored sourcing ────────────────────────────────────────────────────
--
-- PRIMARY 2024 ANCHOR — LBNL Tracking the Sun 2024 Report (Oct 2024 release):
--   - Large non-residential 2023 installed-price 20-80th percentile band:
--       $1.7 – $3.1 /Wdc (TTS 2024 Report page 35, observed market data)
--   - Non-residential 2022→2023 trend: +$0.10-$0.20/W in real terms
--       (page 30, first sustained rise in 15 years)
--   - State medians from public TTS CSV (2025-09 release, ~3.66M projects):
--       NY $1.58/W (n=183), MA $2.64/W (n=84), CA $1.87/W (n=468)
--       — large non-res 1-5 MWdc, install years 2022-2024
--
-- SECONDARY ANCHOR — NREL Q1 2023 Cost Benchmark:
--   - 3-MWdc community solar PV-only MMP: $1.76/Wdc
--   - 3-MWdc CS + 1.8 MW/7.2 MWh storage MMP: $2.94/Wdc
--   - NREL Q1 2024 switched the CPV benchmark to agrivoltaic (sheep grazing),
--     so 2023 NREL is the last published CS-specific NREL anchor
--
-- TRACTOVA SYNTHESIS (forward extrapolation 2024 → 2026):
--   National 2024 PV-only large non-res anchor: $2.55/Wdc
--     (LBNL band midpoint $2.40 + 1-yr forward at +$0.10-$0.20/W LBNL trend)
--   National 2024→2026 forward: +$0.20-$0.35/W, driver-by-driver:
--     • FEOC restrictions phasing in (IRA §45X): +$0.05-$0.10/W
--     • Reshoring + IRA bonus credit threshold rising 40%→55%: +$0.03-$0.05/W
--     • Iran-Israel conflict / oil-logistics pass-through: +$0.02-$0.05/W
--     • Continued LBNL observed trend: +$0.10/W
--   National 2026 PV-only anchor: $2.80/Wdc
--   National 2026 PV+storage hybrid anchor: $3.15/Wdc (NREL 2023 $2.94 +
--     battery cost movement + same forward layers; computed in
--     computeHybridProjection by combining new PV $/W + existing BESS $/kWh)
--
-- STATE MULTIPLIERS:
--   Tier A (TTS observed n≥40): NY 0.66, MA 1.10, CA 0.78 (state median /
--     national 2023 large non-res median $2.40)
--   Tier B (regional analog with documented choice in `notes` field):
--     ISO-NE high (CT, MA): 1.10
--     ISO-NE mid (RI): 1.05
--     ISO-NE rural (ME): 1.00
--     PJM mature CS (IL, NJ): 1.00-1.05
--     PJM mid (MD): 0.95
--     PJM south (VA): 0.90
--     MISO Upper Midwest (MN): 0.95
--     Pacific NW (OR, WA): 0.95
--     SE non-RTO (FL): 0.85
--     SPP/Mountain low-cost (CO): 0.85
--     WECC low-cost (NM): 0.85
--     HI island logistics: 1.45
--
-- All forward extrapolation magnitudes are explicitly Tractova editorial
-- judgment, not numbers LBNL or NREL published. Each driver named for
-- transparency. As new primary-source data becomes available, refresh the
-- anchor (national 2026 = $X.XX) and rerun this migration.
--
-- Safe to re-run — UPDATE only touches installed_cost_per_watt + notes
-- columns; other 17 fields from migration 043 are not affected.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tier A (TTS observed n≥40)
update revenue_rates set installed_cost_per_watt = 1.85,
  notes = '$/W: TTS observed median $1.58/W (n=183 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward (+~$0.27/W). NY-Sun is the largest CS market in nation, mature EPC bidding drives below-national pricing. Bill credit: NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). ITC 30% + Community Adder.'
  where state_id = 'NY';

update revenue_rates set installed_cost_per_watt = 3.08,
  notes = '$/W: TTS observed median $2.64/W (n=84 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward. SMART 3.0 permitting overhead + ISO-NE labor premium drive top-of-band pricing. Bill credit: NEM ~12.8¢/kWh + SMART 3.0 tranche adder (DOER). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder.'
  where state_id = 'MA';

update revenue_rates set installed_cost_per_watt = 2.18,
  notes = '$/W: TTS observed median $1.87/W (n=468 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward. CAISO economies of scale offset prevailing-wage premium. Bill credit: VNEM blended ~14¢/kWh under NEM-ST (CPUC tariff). RPS REC thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. CS status "limited" 2026.'
  where state_id = 'CA';

-- Tier B (regional analog × national 2026 $2.80/W anchor)
update revenue_rates set installed_cost_per_watt = 2.94,
  notes = '$/W: PJM mature CS regional analog ($2.80 national × 1.05 IL premium) — Illinois Shines mature program, premium prevailing wage labor (CCC), Cook County permitting overhead. Matches 2026 IL EPC quote range ($2.60-$3.00 with domestic content per dev intel). REC: Illinois Shines ABP ~$71.50/MWh (DSIRE). Bill credit: ComEd ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder.'
  where state_id = 'IL';

update revenue_rates set installed_cost_per_watt = 2.66,
  notes = '$/W: MISO Upper Midwest regional analog ($2.80 × 0.95) — mature Xcel CSG program, reasonable labor cost vs national avg. Bill credit: Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC (~$4.50/MWh, M-RETS). ITC 30%.'
  where state_id = 'MN';

update revenue_rates set installed_cost_per_watt = 2.38,
  notes = '$/W: SPP/Mountain low-cost regional analog ($2.80 × 0.85) — top-quartile NREL PVWatts CF (18.3%) lets developers pay less per W; SPP labor + simple permitting. Bill credit: ~8.8¢/kWh (PUC tariff). REC thin ($3/MWh, WREGIS). ITC 30%.'
  where state_id = 'CO';

update revenue_rates set installed_cost_per_watt = 2.80,
  notes = '$/W: PJM-NJ regional analog at national anchor ($2.80) — mature SREC-II/SuSI market keeps EPC competitive; high SREC value drives developer interest, balances PJM-NJ labor premium. Bill credit: NEM ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI.'
  where state_id = 'NJ';

update revenue_rates set installed_cost_per_watt = 2.80,
  notes = '$/W: ISO-NE rural regional analog at national anchor ($2.80) — between MA premium and lower-cost states; rural development with reasonable labor. Bill credit: ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%.'
  where state_id = 'ME';

update revenue_rates set installed_cost_per_watt = 2.66,
  notes = '$/W: PJM-mid regional analog ($2.80 × 0.95) — mature CS Pilot, mid-cost PJM labor, no extreme premium. Bill credit: ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI.'
  where state_id = 'MD';

update revenue_rates set installed_cost_per_watt = 2.38,
  notes = '$/W: SE non-RTO low-labor regional analog ($2.80 × 0.85) — FL low labor; FPL/Duke utility-administered EPC procurement keeps prices competitive; weather risk priced in by FPL bidding network. Bill credit: SolarTogether ~10¢/kWh (utility tariff). No state REC. ITC 30%. CS status "limited" — capped enrollment.'
  where state_id = 'FL';

update revenue_rates set installed_cost_per_watt = 3.08,
  notes = '$/W: ISO-NE high-labor regional analog ($2.80 × 1.10) — premium ISO-NE labor + CT permitting overhead, similar to MA pricing posture. Bill credit: SCEF ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI.'
  where state_id = 'CT';

update revenue_rates set installed_cost_per_watt = 4.06,
  notes = '$/W: HI island-logistics premium ($2.80 × 1.45) — multi-leg shipping, prevailing wage, small-grid IX overhead. Above all-CONUS ranges; consistent with documented HI premium. Bill credit: HECO ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%.'
  where state_id = 'HI';

update revenue_rates set installed_cost_per_watt = 2.38,
  notes = '$/W: WECC low-labor regional analog ($2.80 × 0.85) — top NREL PVWatts CF (22%, best in nation) and low WECC labor allow lower per-W pricing. Bill credit: ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%.'
  where state_id = 'NM';

update revenue_rates set installed_cost_per_watt = 2.66,
  notes = '$/W: Pacific NW regional analog ($2.80 × 0.95) — moderate labor premium balanced by reasonable permitting environment. Bill credit: ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%.'
  where state_id = 'OR';

update revenue_rates set installed_cost_per_watt = 2.94,
  notes = '$/W: ISO-NE mid regional analog ($2.80 × 1.05) — between MA and ME on the ISO-NE labor curve. Strong RI Class I REC market. Bill credit: ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI.'
  where state_id = 'RI';

update revenue_rates set installed_cost_per_watt = 2.52,
  notes = '$/W: PJM-South regional analog ($2.80 × 0.90) — emerging CS market, lower labor than PJM-North/Mid. Bill credit: VA Shared Solar ~9¢/kWh (SCC tariff). VA REC ~$15/MWh (PJM-EIS). ITC 30%.'
  where state_id = 'VA';

update revenue_rates set installed_cost_per_watt = 2.66,
  notes = '$/W: Pacific NW regional analog ($2.80 × 0.95) — Pacific NW labor, low NREL PVWatts CF (13.5%, lowest-irradiance state) is a generation/economics issue not a capex issue. Bill credit: ~9¢/kWh (UTC tariff). WA REC thin (~$3/MWh, WREGIS). ITC 30%.'
  where state_id = 'WA';
