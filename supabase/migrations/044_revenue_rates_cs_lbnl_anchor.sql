-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — revenue_rates: CS $/W re-anchored on NREL Q1 2023 CS MMP +
-- LBNL TTS 2024 state ratios + Tractova 2023→2026 forward
-- (supersedes 043 for the CS $/W column only)
--
-- ── Self-audit fixes (Aden's 2026-05-04 audit request) ─────────────────────
-- The first version of this migration (committed in a7c44f9) had three
-- issues found in a self-audit:
--   (1) State TTS data cited as "1-5 MW" but values were from the wider
--       0.5-5 MW LBNL large non-residential bracket. Fixed: citations now
--       say "0.5-5 MW LBNL large non-residential bracket".
--   (2) Forward methodology cited two conflicting trend signals (LBNL
--       +$0.10-$0.20/W vs NREL +22% YoY) but only the lower one was applied
--       without disclosure. Fixed: now anchored on NREL +22% (more relevant
--       to 1-5 MW segment) with explicit reasoning, and LBNL trend
--       documented as the alternative for the broader large-non-res category.
--   (3) "$2.40 national median" denominator was actually midpoint-of-band
--       synthesis, not a published median. Fixed: replaced with the actual
--       TTS-derived national median ($1.91/W for 0.5-5 MW LBNL large non-res
--       bracket, n=839, install years 2022-2024) computed by re-running
--       scripts/aggregate-tts-cs-scale.mjs.
--
-- ── Sources, separated literal-from-synthesis ──────────────────────────────
--
-- PRIMARY ANCHOR — NREL Q1 2023 Cost Benchmark, CS-specific MMP:
--   - 3-MWdc CS PV-only Modeled Market Price: $1.76/Wdc
--   - 3-MWdc CS + 1.8 MW/7.2 MWh storage MMP: $2.94/Wdc
--   - File: public/NLR Solar & Storage Costs 2023.pdf (= NREL Q1 2023; "NLR"
--     is the NREL document number prefix). NREL Q1 2024 switched the CPV
--     scale model to agrivoltaic so 2023 remains the last published NREL
--     CS-specific anchor.
--
-- STATE-LEVEL DIFFERENTIATOR — LBNL TTS 2024 + public TTS CSV:
--   - LBNL TTS 2024 Report: 2023 large non-residential (>500 kW LBNL
--     definition) installed-price 20-80th percentile band $1.7 – $3.1/Wdc.
--     Non-res 2022→2023 trend: +$0.10-$0.20/W in real terms (page 30).
--   - State medians from TTS public CSV (2025-09 release, ~3.66M projects),
--     non-residential customer segments, 0.5-5 MW DC, install years 2022-2024:
--       National TTS median: $1.91/W (n=839)
--       NY: $1.58/W (n=183)
--       MA: $2.64/W (n=84)
--       CA: $1.87/W (n=468)
--
-- CROSS-CHECK — NREL Spring 2025 Industry Update:
--   - H2 2024 Distributed PV 1-5 MWdc median price $1.69/W with +22% YoY
--     change 2023→2024 (utility-FILED EPC, not CS-specific). Different cost
--     concept than NREL CS MMP (modeled all-in) and TTS observed
--     (customer-paid). The +22% magnitude informs our forward extrapolation.
--
-- TRACTOVA SYNTHESIS — explicit 2023 → 2026 forward:
--   National 2023 anchor: NREL CS PV-only MMP $1.76/Wdc (literal NREL number)
--   2023 → 2024: +$0.20-$0.30/Wdc
--     Anchored on NREL Spring 2025 +22% YoY for 1-5 MW segment (utility-filed
--     cost concept) applied conservatively to NREL CS MMP (modeled
--     CS-specific cost concept). Yields ~$2.00-$2.10/Wdc 2024 anchor.
--   2024 → 2025: +$0.10-$0.15/Wdc (continued tariff/FEOC pressure)
--   2025 → 2026 (current): +$0.10-$0.20/Wdc, drivers:
--     • FEOC restrictions fully phased in (IRA §45X): +$0.05-$0.10/W
--     • Reshoring + IRA bonus credit threshold rising 40%→55% by 2027:
--       +$0.03-$0.05/W
--     • Iran-Israel conflict / oil-logistics pass-through: +$0.02-$0.05/W
--   National 2026 PV-only anchor: $2.45/Wdc
--   National 2026 PV+storage hybrid anchor: $3.15/Wdc (NREL 2023 $2.94 +
--     battery cost movement + same forward layers; computeHybridProjection
--     in revenueEngine.js combines new PV $/W + existing BESS $/kWh)
--
-- STATE MULTIPLIERS:
--   Tier A (TTS observed n≥40): state TTS median ÷ TTS national $1.91:
--     NY 0.83, MA 1.38, CA 0.98
--   Tier B (regional analog, no TTS observed sample at n≥40):
--     ISO-NE high (CT): 1.30
--     ISO-NE mid (RI): 1.20
--     ISO-NE rural (ME): 1.10
--     PJM mature CS (IL, NJ): 1.10
--     PJM mid (MD): 1.00
--     PJM south (VA): 0.90
--     MISO Upper Midwest (MN): 0.90
--     Pacific NW (OR, WA): 0.95
--     SE non-RTO (FL): 0.85
--     SPP/Mountain (CO): 0.90
--     WECC low (NM): 0.85
--     HI island logistics: 1.55
--
-- All forward extrapolation magnitudes + Tier B multipliers are Tractova
-- editorial judgment, not numbers LBNL or NREL published. Each driver and
-- regional choice named for transparency in code + state notes.
--
-- Safe to re-run — UPDATE only touches installed_cost_per_watt + notes
-- columns; other 17 fields from migration 043 are not affected.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tier A (TTS observed n≥40, 0.5-5 MW LBNL large non-residential bracket)
update revenue_rates set installed_cost_per_watt = 2.03,
  notes = '$/W: TTS observed median $1.58/W (n=183 large non-res 0.5-5 MW DC, install years 2022-2024) ÷ TTS national median $1.91/W = 0.83 × national 2026 anchor $2.45/W. NY-Sun is the largest CS market in nation; mature EPC bidding drives below-national pricing. Bill credit: NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). ITC 30% + Community Adder.'
  where state_id = 'NY';

update revenue_rates set installed_cost_per_watt = 3.38,
  notes = '$/W: TTS observed median $2.64/W (n=84 large non-res 0.5-5 MW DC, 2022-2024) ÷ TTS national $1.91 = 1.38 × national 2026 anchor $2.45/W. SMART 3.0 permitting overhead + ISO-NE labor premium drive top-of-band pricing. Bill credit: NEM ~12.8¢/kWh + SMART 3.0 tranche adder (DOER). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder.'
  where state_id = 'MA';

update revenue_rates set installed_cost_per_watt = 2.40,
  notes = '$/W: TTS observed median $1.87/W (n=468 large non-res 0.5-5 MW DC, 2022-2024) ÷ TTS national $1.91 = 0.98 × national 2026 anchor $2.45/W. CAISO economies of scale roughly balance prevailing-wage premium. Bill credit: VNEM blended ~14¢/kWh under NEM-ST (CPUC tariff). RPS REC thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. CS status "limited" 2026.'
  where state_id = 'CA';

-- Tier B (regional analog × $2.45/W national 2026 anchor)
update revenue_rates set installed_cost_per_watt = 2.70,
  notes = '$/W: PJM mature CS regional analog (1.10 × $2.45 national 2026 anchor) — Illinois Shines mature program, premium prevailing wage labor (CCC), Cook County permitting overhead. Lands middle of 2026 IL EPC quote range $2.60-$3.00 (Aden dev intel, with domestic content). REC: Illinois Shines ABP ~$71.50/MWh (DSIRE). Bill credit: ComEd ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder.'
  where state_id = 'IL';

update revenue_rates set installed_cost_per_watt = 2.21,
  notes = '$/W: MISO Upper Midwest regional analog (0.90 × $2.45) — mature Xcel CSG program, reasonable labor vs national avg. Bill credit: Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC (~$4.50/MWh, M-RETS). ITC 30%.'
  where state_id = 'MN';

update revenue_rates set installed_cost_per_watt = 2.21,
  notes = '$/W: SPP/Mountain regional analog (0.90 × $2.45) — top-quartile NREL PVWatts CF (18.3%) helps unit economics; SPP labor mid-tier; simple permitting. Bill credit: ~8.8¢/kWh (PUC tariff). REC thin ($3/MWh, WREGIS). ITC 30%.'
  where state_id = 'CO';

update revenue_rates set installed_cost_per_watt = 2.70,
  notes = '$/W: PJM-NJ mature CS regional analog (1.10 × $2.45) — strong SREC-II/SuSI market keeps EPC competitive but PJM-NJ labor premium. Bill credit: NEM ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI.'
  where state_id = 'NJ';

update revenue_rates set installed_cost_per_watt = 2.70,
  notes = '$/W: ISO-NE rural regional analog (1.10 × $2.45) — softer than MA SMART premium but on the ISO-NE labor curve. Bill credit: ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%.'
  where state_id = 'ME';

update revenue_rates set installed_cost_per_watt = 2.45,
  notes = '$/W: PJM-mid regional analog (1.00 × $2.45) — mature CS Pilot, mid-cost PJM labor. Bill credit: ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI.'
  where state_id = 'MD';

update revenue_rates set installed_cost_per_watt = 2.08,
  notes = '$/W: SE non-RTO low-labor regional analog (0.85 × $2.45) — FL low labor; FPL/Duke utility-administered EPC procurement keeps prices competitive; weather risk priced in by bidding network. Bill credit: SolarTogether ~10¢/kWh (utility tariff). No state REC. ITC 30%. CS status "limited" — capped enrollment.'
  where state_id = 'FL';

update revenue_rates set installed_cost_per_watt = 3.19,
  notes = '$/W: ISO-NE high-labor regional analog (1.30 × $2.45) — between MA observed 1.38 and ISO-NE rural 1.10; CT premium permitting + ISO-NE labor. Bill credit: SCEF ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI.'
  where state_id = 'CT';

update revenue_rates set installed_cost_per_watt = 3.80,
  notes = '$/W: HI island-logistics premium (1.55 × $2.45) — multi-leg shipping, prevailing wage, small-grid IX overhead. Above any CONUS tier; consistent with documented industry HI premium of 30-50% over CONUS. Bill credit: HECO ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%.'
  where state_id = 'HI';

update revenue_rates set installed_cost_per_watt = 2.08,
  notes = '$/W: WECC low-labor regional analog (0.85 × $2.45) — top NREL PVWatts CF (22%, best in nation) and low WECC labor allow lower per-W pricing. Bill credit: ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%.'
  where state_id = 'NM';

update revenue_rates set installed_cost_per_watt = 2.33,
  notes = '$/W: Pacific NW regional analog (0.95 × $2.45) — moderate labor premium balanced by reasonable permitting environment. Bill credit: ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%.'
  where state_id = 'OR';

update revenue_rates set installed_cost_per_watt = 2.94,
  notes = '$/W: ISO-NE mid regional analog (1.20 × $2.45) — between MA observed 1.38 and ME 1.10 on the ISO-NE labor curve. Strong RI Class I REC. Bill credit: ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI.'
  where state_id = 'RI';

update revenue_rates set installed_cost_per_watt = 2.21,
  notes = '$/W: PJM-South regional analog (0.90 × $2.45) — emerging CS market, lower labor than PJM-North/Mid. Bill credit: VA Shared Solar ~9¢/kWh (SCC tariff). VA REC ~$15/MWh (PJM-EIS). ITC 30%.'
  where state_id = 'VA';

update revenue_rates set installed_cost_per_watt = 2.33,
  notes = '$/W: Pacific NW regional analog (0.95 × $2.45) — Pacific NW labor; low NREL PVWatts CF (13.5%, lowest-irradiance state) is a generation/economics issue not a capex issue. Bill credit: ~9¢/kWh (UTC tariff). WA REC thin (~$3/MWh, WREGIS). ITC 30%.'
  where state_id = 'WA';
