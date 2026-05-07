// Revenue projection engine for community solar projects.
// Computes annual $/MW revenue from each stream (bill credits, RECs, ITC, PPA, BESS).
//
// Data flow: Supabase `revenue_rates` table → getRevenueRates() in programData.js →
// passed into compute functions here as `rates` parameter.
//
// Hardcoded fallback data below is used only when Supabase rates are unavailable
// (e.g., first load before cache populates, or offline). The Supabase seed
// (003_revenue_rates_seed.sql) matches these values; cron jobs update capacity
// factors and retail rates over time.
//
// ── Rate freshness disclosure ────────────────────────────────────────────────
// All three rate tables (CS / C&I / BESS) are SEEDED constants. There is no
// automated refresh cron yet (P2 backlog). The AS_OF stamps are surfaced in
// the Lens revenue methodology dropdown so users see vintage at a glance.
//
// ── CS $/W sources (literal — separated from Tractova synthesis) ────────────
//
// PRIMARY ANCHOR — NREL Q1 2023 Cost Benchmark, CS-specific MMP:
//   - 3-MWdc community solar PV-only Modeled Market Price: $1.76/Wdc
//   - 3-MWdc CS + 1.8 MW/7.2 MWh storage MMP: $2.94/Wdc
//   - File: data/NLR Solar & Storage Costs 2023.pdf (= NREL Q1 2023, "NLR"
//     is the NREL document number prefix). NREL Q1 2024 cost benchmark
//     (data/NREL Q1 2024 Cost benchmark.pdf) switched the CPV scale model
//     to a 3-MWdc agrivoltaic ground-mount ($1.55/Wdc) — the dedicated CS
//     line item was discontinued in 2024, so 2023 remains the last published
//     NREL CS-specific anchor. We treat $1.76/Wdc as the 2023 CS national
//     baseline.
//
// STATE-LEVEL DIFFERENTIATOR — LBNL Tracking the Sun 2024 + public TTS CSV:
//   - LBNL TTS 2024 Report (data/Tracking the Sun 2024_Report.pdf):
//     "Installed-Price Variation Across Systems" section reports the 2023
//     installed-price 20-80th percentile band for large non-residential
//     (LBNL definition: >500 kW): $1.7 – $3.1 /Wdc. Non-residential 2022→2023
//     trend: +$0.10-$0.20/W in real terms (first sustained rise in 15 years).
//   - State-level medians from the TTS public CSV (2025-09 release,
//     data/TTS_LBNL_public_file_29-Sep-2025_all.csv, ~3.66M projects).
//     Aggregated via scripts/aggregate-tts-cs-scale.mjs filtering to
//     non-residential customer segments + 0.5–5 MW DC + install years
//     2022-2024. National TTS median for that bracket: $1.91/W (n=839).
//     State-level medians where n≥40:
//       NY: $1.58/W (n=183) | MA: $2.64/W (n=84) | CA: $1.87/W (n=468)
//     (Strict 1-5 MW bracket has thinner samples and a national median of
//     $1.65/W (n=346). The 0.5-5 MW LBNL "large non-residential" definition
//     is used for stronger sample sizes.)
//
// CROSS-CHECK (NREL Spring 2025 Industry Update, public PDF):
//   - Page 57 reports H2 2024 Distributed PV system pricing by size bracket
//     from state utility filings: 1-5 MWdc median $1.69/W with +22% YoY change
//     2023→2024. This is utility-FILED EPC cost (not CS-specific, includes
//     all 1-5 MW non-res); lower than NREL CS MMP ($1.76 modeled) and lower
//     than TTS observed customer-paid ($1.91). Different cost concepts:
//       • Utility-filed EPC: install-as-reported-to-grid, often excludes
//         soft costs, dealer markups, financing premium
//       • NREL MMP: bottom-up modeled including ITC-bonus-eligible scenarios
//       • TTS observed customer-paid: real customer payment, may include
//         dealer fees per LBNL caveat
//   - We anchor on NREL CS MMP because it's CS-specific. The +22% YoY signal
//     informs the magnitude of our forward extrapolation (vs LBNL's modest
//     +$0.10-$0.20/W trend, which is for the broader large non-res category).
//
// TRACTOVA SYNTHESIS — explicit 2023 → 2026 forward:
//   National 2023 anchor: NREL CS PV-only MMP $1.76/Wdc (literal NREL number)
//   2023 → 2024: +$0.20-$0.30/Wdc
//     Anchored on NREL Spring 2025's observed +22% YoY for the 1-5 MW segment
//     (utility-filed cost concept), applied conservatively to NREL CS MMP
//     (modeled CS-specific cost concept). Yields ~$2.00-$2.10/Wdc 2024 anchor.
//   2024 → 2025: +$0.10-$0.15/Wdc (continued tariff/FEOC pricing pressure
//     post-IRA implementation peak)
//   2025 → 2026 (current): +$0.10-$0.20/Wdc, driver-by-driver:
//     • FEOC restrictions fully phased in (IRA §45X — Chinese-supplier
//       components excluded from ITC eligibility; non-Chinese supply
//       commands premium): +$0.05-$0.10/W
//     • Reshoring + IRA bonus credit threshold rising 40%→55% by 2027
//       (US mfg capacity insufficient at premium-free pricing): +$0.03-$0.05/W
//     • Iran-Israel conflict / oil-logistics pass-through (Brent $80-110
//       ranges raise transport, polymer feedstock, install-labor diesel
//       cost): +$0.02-$0.05/W
//   National 2026 PV-only anchor (after forward): $2.45/Wdc
//   National 2026 PV+storage hybrid anchor: $3.15/Wdc (NREL 2023 MMP $2.94
//     + battery cost movement + same forward layers; computed in
//     computeHybridProjection by combining new PV $/W + existing BESS $/kWh)
//
//   STATE MULTIPLIERS:
//   - Tier A (TTS observed n≥40, 0.5-5 MW LBNL large non-res bracket, install
//     years 2022-2024): state TTS median ÷ national TTS median ($1.91)
//       NY: 1.58 / 1.91 = 0.83
//       MA: 2.64 / 1.91 = 1.38
//       CA: 1.87 / 1.91 = 0.98
//     IMPORTANT ASSUMPTION: state cost gradient observed in 2023 TTS data is
//     assumed stable across 2023→2026. Real state markets diverge — NY's
//     mature CS market may absorb forward bumps differently than emerging
//     states. This is editorial Tractova synthesis.
//   - Tier B (regional analog, no TTS observed sample; multiplier is
//     Tractova editorial judgment based on regional labor + permitting
//     intuition + the Tier A states' observed ratios as anchors for similar
//     regions):
//       ISO-NE high (CT): 1.30 (between MA 1.38 and ISO-NE rural)
//       ISO-NE mid (RI): 1.20
//       ISO-NE rural (ME): 1.10
//       PJM mature CS (IL, NJ): 1.10 (NJ 1.10 / IL 1.10 — both have mature
//         programs that constrain pricing despite premium labor)
//       PJM mid (MD): 1.00
//       PJM south (VA): 0.90
//       MISO Upper Midwest (MN): 0.90
//       Pacific NW (OR, WA): 0.95
//       SE non-RTO (FL): 0.85
//       SPP/Mountain (CO): 0.90 (high CF helps lower per-W but labor mid)
//       WECC low (NM): 0.85
//       HI island logistics: 1.55 (above any CONUS tier; documented HI
//         premium 30-50% above CONUS in industry sources)
//
// All forward extrapolation magnitudes are Tractova editorial judgment, not
// numbers LBNL or NREL published. Each driver named for transparency.
//
// CAVEAT: LBNL TTS notes its observed prices may include dealer fees adding
// 5-50% for loan-financed systems; the >500 kW segment we care about is
// less affected by this distortion (commercial-scale rarely uses consumer
// loans). Tractova's per-state values are our best estimate of all-in
// delivered project cost a CS developer faces for a 1-5 MW project in 2026
// vintage.
//
// CAPACITY FACTORS: NREL PVWatts API v8 state averages.
// BILL CREDITS: state PUC tariff filings tracked via DSIRE.
// REC PRICES: DSIRE + GATS / PJM-EIS / M-RETS / NEPOOL GIS / WREGIS / M-RETS
// depending on state.
// ITC: federal §48, 30% base + 10% adders per state qualifying status.
//
// BESS_RATES_AS_OF '2026-04' anchored on ISO/RTO clearing prices (PJM RPM,
// NYISO ICAP, ISO-NE FCM, CAISO RA) + NREL ATB 2024 Commercial Battery
// Storage CAPEX $1,450/kWh (2022 base, Advanced scenario; energy + power
// stacks combined) and Utility-Scale Battery Storage CAPEX $1,290/kWh
// (same vintage / scenario). ATB sheets in data/2024 NREL ATB Electricity.xlsx.
// Replaces prior BloombergNEF 2024 dependency (paywalled, unverifiable);
// ATB is free, NREL-published, and refreshes annually each Q1.
//
// ── Recalibration history ──
// 2026-05-04 (Session 5): Lazard v18-anchored values shipped. Aden caught
//   the citation problem (Lazard publishes a national range, not per-state)
//   and magnitude problem (synthesis-derived state values understated his
//   IL EPC-with-domestic-content quotes of $2.60-$3.00/W).
// 2026-05-04 (Session 6, first pass — commit a7c44f9): re-anchored on LBNL
//   TTS 2024 observed market with 2024→2026 Tractova forward. Self-audit
//   (Aden's request) found three issues: (1) state TTS data cited as "1-5 MW"
//   when actually from 0.5-5 MW bracket; (2) forward methodology cited two
//   conflicting trend signals (LBNL +$0.10-$0.20/W vs NREL +22% YoY) but
//   applied only the lower one without disclosure; (3) "$2.40 national
//   median" was actually midpoint-of-band synthesis, not a published median.
// 2026-05-04 (Session 6, second pass — current): all three fixed.
//   (1) citations corrected to "0.5-5 MW LBNL large non-residential bracket".
//   (2) forward methodology now anchored on NREL +22% YoY (more relevant to
//       1-5 MW segment) with explicit explanation of why it's preferred over
//       LBNL's modest trend.
//   (3) actual TTS-derived national median ($1.91/W from CSV streaming, n=839)
//       replaces the prior midpoint-of-band proxy. Per-state Tier A
//       multipliers recomputed.
export const SOLAR_RATES_AS_OF = '2023 NREL CS MMP + LBNL TTS 2024 + Tractova 2026 forward'
export const CI_RATES_AS_OF    = '2023 NREL CS MMP -$0.05 C&I premium + LBNL TTS 2024 + Tractova 2026 forward (capex only; PPA + retail rates still 2025-Q2)'
export const BESS_RATES_AS_OF  = '2025/26 ISO clearing × accreditation + Tractova 2026 forward (capacity); NREL ATB 2024 Commercial + Utility-Scale Battery Storage (capex); demand+arb still seeded synthesis'

// ── Hardcoded fallback data ──────────────────────────────────────────────────
// CS $/W per state: 2024 LBNL TTS observed anchor + 2024→2026 Tractova
//   forward (FEOC + reshoring + oil + LBNL-trend layers, see header above).
// Where TTS observed n≥40 (NY/MA/CA): use TTS state ratio × national 2026 anchor.
// Where TTS thin: regional analog, with the regional choice documented per
//   state in the `notes` field.
const STATE_REVENUE_DATA = {
  // ── Tier A: TTS observed median (0.5-5 MW LBNL large non-res, install
  // years 2022-2024, n≥40) × forward applied via NREL CS MMP anchor. State
  // multiplier = state TTS median ÷ national TTS median ($1.91/W). National
  // 2026 anchor $2.45/W = NREL Q1 2023 CS MMP $1.76 + Tractova 2023→2026
  // forward (NREL Spring 2025 +22% YoY 2023→2024 + FEOC + reshoring + oil).
  NY: { billCreditCentsKwh: 10.5, recPerMwh: 0,     itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.0, installedCostPerWatt: 2.03, degradationPct: 0.5, label: 'New York (Value Stack)',         notes: '$/W: TTS observed median $1.58/W (n=183 large non-res 0.5-5 MW DC, install years 2022-2024) ÷ TTS national median $1.91/W = 0.83 × national 2026 anchor $2.45/W. NY-Sun is the largest CS market in nation; mature EPC bidding drives below-national pricing. Bill credit: NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). ITC 30% + Community Adder.' },
  MA: { billCreditCentsKwh: 12.8, recPerMwh: 35.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 16.5, installedCostPerWatt: 3.38, degradationPct: 0.5, label: 'Massachusetts (SMART 3.0)',      notes: '$/W: TTS observed median $2.64/W (n=84 large non-res 0.5-5 MW DC, 2022-2024) ÷ TTS national $1.91 = 1.38 × national 2026 anchor $2.45/W. SMART 3.0 permitting overhead + ISO-NE labor premium drive top-of-band pricing. Bill credit: NEM ~12.8¢/kWh + SMART 3.0 tranche adder (DOER). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder.' },
  CA: { billCreditCentsKwh: 14.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 10, capacityFactorPct: 21.0, installedCostPerWatt: 2.40, degradationPct: 0.5, label: 'California (VNEM / NEM-ST)',      notes: '$/W: TTS observed median $1.87/W (n=468 large non-res 0.5-5 MW DC, 2022-2024) ÷ TTS national $1.91 = 0.98 × national 2026 anchor $2.45/W. CAISO economies of scale roughly balance prevailing-wage premium. Bill credit: VNEM blended ~14¢/kWh under NEM-ST (CPUC tariff). RPS REC thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. CS status "limited" 2026.' },
  // ── Tier B: Regional analog (no TTS observed sample at n≥40). Multiplier
  // is Tractova editorial judgment anchored on the Tier A states' observed
  // ratios for similar regions. National 2026 anchor $2.45/W applied.
  IL: { billCreditCentsKwh: 8.2,  recPerMwh: 71.50, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 17.5, installedCostPerWatt: 2.70, degradationPct: 0.5, label: 'Illinois (ComEd territory)', notes: '$/W: PJM mature CS regional analog (1.10 × $2.45 national 2026 anchor) — Illinois Shines mature program, premium prevailing wage labor (CCC), Cook County permitting overhead. Lands middle of 2026 IL EPC quote range $2.60-$3.00 (Aden dev intel, with domestic content). REC: Illinois Shines ABP ~$71.50/MWh (DSIRE). Bill credit: ComEd ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder.' },
  MN: { billCreditCentsKwh: 9.5,  recPerMwh: 4.50,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 15.2, installedCostPerWatt: 2.21, degradationPct: 0.5, label: 'Minnesota (Xcel Energy)',         notes: '$/W: MISO Upper Midwest regional analog (0.90 × $2.45) — mature Xcel CSG program, reasonable labor vs national avg. Bill credit: Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC (~$4.50/MWh, M-RETS). ITC 30%.' },
  CO: { billCreditCentsKwh: 8.8,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.3, installedCostPerWatt: 2.21, degradationPct: 0.5, label: 'Colorado (Xcel Energy)',          notes: '$/W: SPP/Mountain regional analog (0.90 × $2.45) — top-quartile NREL PVWatts CF (18.3%) helps unit economics; SPP labor mid-tier; simple permitting. Bill credit: ~8.8¢/kWh (PUC tariff). REC thin ($3/MWh, WREGIS). ITC 30%.' },
  NJ: { billCreditCentsKwh: 11.0, recPerMwh: 85.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.5, installedCostPerWatt: 2.70, degradationPct: 0.5, label: 'New Jersey (SREC-II / SuSI)',     notes: '$/W: PJM-NJ mature CS regional analog (1.10 × $2.45) — strong SREC-II/SuSI market keeps EPC competitive but PJM-NJ labor premium. Bill credit: NEM ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI.' },
  ME: { billCreditCentsKwh: 9.0,  recPerMwh: 8.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.8, installedCostPerWatt: 2.70, degradationPct: 0.5, label: 'Maine',                           notes: '$/W: ISO-NE rural regional analog (1.10 × $2.45) — softer than MA SMART premium but on the ISO-NE labor curve. Bill credit: ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%.' },
  MD: { billCreditCentsKwh: 9.5,  recPerMwh: 55.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.8, installedCostPerWatt: 2.45, degradationPct: 0.5, label: 'Maryland',                        notes: '$/W: PJM-mid regional analog (1.00 × $2.45) — mature CS Pilot, mid-cost PJM labor. Bill credit: ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI.' },
  FL: { billCreditCentsKwh: 10.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.0, installedCostPerWatt: 2.08, degradationPct: 0.5, label: 'Florida (SolarTogether)',         notes: '$/W: SE non-RTO low-labor regional analog (0.85 × $2.45) — FL low labor; FPL/Duke utility-administered EPC procurement keeps prices competitive; weather risk priced in by bidding network. Bill credit: SolarTogether ~10¢/kWh (utility tariff). No state REC. ITC 30%. CS status "limited" — capped enrollment.' },
  CT: { billCreditCentsKwh: 12.0, recPerMwh: 30.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 3.19, degradationPct: 0.5, label: 'Connecticut (SCEF)',              notes: '$/W: ISO-NE high-labor regional analog (1.30 × $2.45) — between MA observed 1.38 and ISO-NE rural 1.10; CT premium permitting + ISO-NE labor. Bill credit: SCEF ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI.' },
  HI: { billCreditCentsKwh: 28.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 19.0, installedCostPerWatt: 3.80, degradationPct: 0.5, label: 'Hawaii (CBRE)',                   notes: '$/W: HI island-logistics premium (1.55 × $2.45) — multi-leg shipping, prevailing wage, small-grid IX overhead. Above any CONUS tier; consistent with documented industry HI premium of 30-50% over CONUS. Bill credit: HECO ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%.' },
  NM: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 22.0, installedCostPerWatt: 2.08, degradationPct: 0.5, label: 'New Mexico CS',                   notes: '$/W: WECC low-labor regional analog (0.85 × $2.45) — top NREL PVWatts CF (22%, best in nation) and low WECC labor allow lower per-W pricing. Bill credit: ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%.' },
  OR: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.5, installedCostPerWatt: 2.33, degradationPct: 0.5, label: 'Oregon CS',                       notes: '$/W: Pacific NW regional analog (0.95 × $2.45) — moderate labor premium balanced by reasonable permitting environment. Bill credit: ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%.' },
  RI: { billCreditCentsKwh: 13.0, recPerMwh: 45.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 2.94, degradationPct: 0.5, label: 'Rhode Island CS',                 notes: '$/W: ISO-NE mid regional analog (1.20 × $2.45) — between MA observed 1.38 and ME 1.10 on the ISO-NE labor curve. Strong RI Class I REC. Bill credit: ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI.' },
  VA: { billCreditCentsKwh: 9.0,  recPerMwh: 15.00, itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 17.0, installedCostPerWatt: 2.21, degradationPct: 0.5, label: 'Virginia CS',                     notes: '$/W: PJM-South regional analog (0.90 × $2.45) — emerging CS market, lower labor than PJM-North/Mid. Bill credit: VA Shared Solar ~9¢/kWh (SCC tariff). VA REC ~$15/MWh (PJM-EIS). ITC 30%.' },
  WA: { billCreditCentsKwh: 9.0,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 13.5, installedCostPerWatt: 2.33, degradationPct: 0.5, label: 'Washington (Shared Renewables)',  notes: '$/W: Pacific NW regional analog (0.95 × $2.45) — Pacific NW labor; low NREL PVWatts CF (13.5%, lowest-irradiance state) is a generation/economics issue not a capex issue. Bill credit: ~9¢/kWh (UTC tariff). WA REC thin (~$3/MWh, WREGIS). ITC 30%.' },
}

// ── C&I $/W methodology (recalibrated 2026-05-04 per audit) ───────────────
// Same Tier-A/B pattern as STATE_REVENUE_DATA. Anchor: $2.40/W national 2026
// (CS anchor $2.45 minus ~$0.05 CS-specific soft cost premium per NREL Q1 2023
// — C&I projects have single offtaker, no subscriber acquisition, no LMI
// compliance overhead). Same TTS state ratios apply since LBNL TTS 2024
// "large non-residential" bracket includes both CS and C&I projects.
//   Tier A (NY/MA/CA, n≥40 in TTS): state TTS median ÷ TTS national $1.91
//   Tier B (other 14 states): regional analog same as CS rebuild
// PPA rates + retail rates retained from prior 2025-Q2 EIA Form 861 anchor —
// not touched in this commit (see data-trust audit Tier C: ppaRateCentsKwh
// is editorial synthesis on top of retail; refresh path = LevelTen PPA Index).
const CI_REVENUE_DATA = {
  // ── Tier A: TTS observed (n≥40 in 0.5-5 MW LBNL large non-res) × $2.40 anchor ──
  NY: { ppaRateCentsKwh: 8.0,  escalatorPct: 2.0, installedCostPerWatt: 1.99, itcPct: 30, capacityFactorPct: 14.0, degradationPct: 0.5, retailRateCentsKwh: 18.5, label: 'New York (C&I PPA)' },
  MA: { ppaRateCentsKwh: 8.5,  escalatorPct: 1.5, installedCostPerWatt: 3.31, itcPct: 30, capacityFactorPct: 16.5, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'Massachusetts (C&I PPA)' },
  CA: { ppaRateCentsKwh: 9.0,  escalatorPct: 2.5, installedCostPerWatt: 2.35, itcPct: 30, capacityFactorPct: 21.0, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'California (C&I PPA)' },
  // ── Tier B: Regional analog × $2.40 national C&I anchor ──
  IL: { ppaRateCentsKwh: 7.0,  escalatorPct: 2.0, installedCostPerWatt: 2.64, itcPct: 30, capacityFactorPct: 17.5, degradationPct: 0.5, retailRateCentsKwh: 12.5, label: 'Illinois (C&I PPA)' },
  MN: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.16, itcPct: 30, capacityFactorPct: 15.2, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'Minnesota (C&I PPA)' },
  CO: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.5, installedCostPerWatt: 2.16, itcPct: 30, capacityFactorPct: 18.3, degradationPct: 0.5, retailRateCentsKwh: 12.0, label: 'Colorado (C&I PPA)' },
  NJ: { ppaRateCentsKwh: 7.5,  escalatorPct: 2.0, installedCostPerWatt: 2.64, itcPct: 30, capacityFactorPct: 15.5, degradationPct: 0.5, retailRateCentsKwh: 16.0, label: 'New Jersey (C&I PPA)' },
  ME: { ppaRateCentsKwh: 6.5,  escalatorPct: 1.5, installedCostPerWatt: 2.64, itcPct: 30, capacityFactorPct: 14.8, degradationPct: 0.5, retailRateCentsKwh: 15.5, label: 'Maine (C&I PPA)' },
  MD: { ppaRateCentsKwh: 7.0,  escalatorPct: 2.0, installedCostPerWatt: 2.40, itcPct: 30, capacityFactorPct: 15.8, degradationPct: 0.5, retailRateCentsKwh: 13.5, label: 'Maryland (C&I PPA)' },
  FL: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.04, itcPct: 30, capacityFactorPct: 18.0, degradationPct: 0.5, retailRateCentsKwh: 13.0, label: 'Florida (C&I PPA)' },
  CT: { ppaRateCentsKwh: 8.5,  escalatorPct: 1.5, installedCostPerWatt: 3.12, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 23.0, label: 'Connecticut (C&I PPA)' },
  HI: { ppaRateCentsKwh: 18.0, escalatorPct: 2.0, installedCostPerWatt: 3.72, itcPct: 30, capacityFactorPct: 19.0, degradationPct: 0.5, retailRateCentsKwh: 38.0, label: 'Hawaii (C&I PPA)' },
  NM: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.5, installedCostPerWatt: 2.04, itcPct: 30, capacityFactorPct: 22.0, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'New Mexico (C&I PPA)' },
  OR: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.0, installedCostPerWatt: 2.28, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'Oregon (C&I PPA)' },
  RI: { ppaRateCentsKwh: 8.0,  escalatorPct: 1.5, installedCostPerWatt: 2.88, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'Rhode Island (C&I PPA)' },
  VA: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.16, itcPct: 30, capacityFactorPct: 17.0, degradationPct: 0.5, retailRateCentsKwh: 12.0, label: 'Virginia (C&I PPA)' },
  WA: { ppaRateCentsKwh: 5.5,  escalatorPct: 2.0, installedCostPerWatt: 2.28, itcPct: 30, capacityFactorPct: 13.5, degradationPct: 0.5, retailRateCentsKwh: 10.0, label: 'Washington (C&I PPA)' },
}

// ── BESS capacityPerKwYear methodology (recalibrated 2026-05-04 per audit) ──
// Anchored on 2024-2025 ISO clearing prices × 4-hr BESS accreditation factor:
//
//   PJM RPM 2025/26 BRA cleared at $269.92/MW-day = $98.5/kW-yr (huge spike
//     from prior $10.5/kW-yr); BESS accreditation ~60% for 4-hr → ~$59/kW-yr
//     effective. + 2026 forward (load growth + reserve margin tightening).
//   NYISO ICAP 2024-2025: $30-50/kW-yr by zone × ~50-60% accreditation
//     → ~$25-35/kW-yr effective. NY-specific: VDER + ICAP zone stack pushes
//     paired-storage to ~$50/kW-yr.
//   ISO-NE FCM 2025/26 FCA: cleared $80-90/kW-yr × ~60% accreditation
//     → ~$48-54/kW-yr effective. Higher zones (MA/CT) +10%.
//   CAISO RA 2024 bilateral: $40-80/kW-yr × ~70% accreditation → ~$30-55
//     effective. Plus market opportunity for high-load events.
//   MISO PRA 2025/26 zonal: ~$50/kW-yr × 70% accreditation → ~$35/kW-yr.
//   SPP, WECC, SE: bilateral $20-40/kW-yr range.
//   HECO: no capacity market — IRP/Stage-3 RFP bilateral procurement
//     embedded in PPA, so capacityPerKwYear=0 (revenue captured in PPA price).
//
// Tractova synthesis layers:
//   - Accreditation factor for 4-hr BESS: 60-70% (ISO-specific, evolving as
//     ISOs revise methodologies — citing ISO accreditation rule pages).
//   - State-within-LDA allocation: editorial (PJM has 6+ LDAs, ISO-NE has
//     8 zones; state ≠ zone exactly).
//   - 2026 forward: +5-10% on 2025/26 clearing reflects load growth +
//     data-center demand surge + reserve margin tightening.
//
// All values are Tractova best estimate of 2026 vintage 4-hr BESS capacity
// revenue. Values were aggressively HIGH in prior version (especially
// ISO-NE / NY / CA) — not reflecting the substantial accreditation
// discount applied by ISOs to short-duration storage. Recalibration 2026-05-04
// brings them in line with realistic 4-hr BESS economics.
//
// Audit note: still Tier B (anchored on ISO public data + Tractova
// accreditation/allocation synthesis). Refresh path: pull each ISO's most
// recent annual capacity auction results (PJM RPM, NYISO ICAP, ISO-NE FCM,
// MISO PRA, CAISO RA reports). Annual cadence.
//
// ── BESS demandChargePerKwMonth + arbitragePerMwh methodology ──────────────
// (Recalibrated 2026-05-04 per audit. Was Tier C high-risk.)
//
// DEMAND CHARGES ($/kW-month, blended commercial customer):
//   Anchored on industry-standard regional ranges from NREL "Identifying
//   Potential Markets for Behind-the-Meter Battery Energy Storage" (NREL
//   TP-7A40-71162) + tracked utility tariff filings via state PUC dockets.
//   State value is a blended weighted-average across the dominant 1-3
//   utility tariffs serving large commercial customers in that state.
//   Wide intra-state variation exists (e.g., NJ PSE&G vs Atlantic City
//   Electric); single state value is approximation. Refresh path: pull
//   commercial demand schedules from each state's PUC tariff database.
//
//   Regional buckets:
//     HI: $20-25/kW-month (highest, island grid, isolated wholesale)
//     CA: $16-20/kW-month (CA IOU CCSF + PG&E + SCE/SDG&E aggressive
//       demand-charge-driven tariffs post-NEM 3.0)
//     NE high (NJ, MA, CT, NY): $13-15/kW-month (mature ISO-NE/NYISO/PJM-NJ
//       commercial tariffs)
//     PJM mid (IL, MD, VA): $12-13/kW-month
//     ISO-NE rural (RI, ME): $11-13/kW-month
//     MISO / SPP / WECC / SE: $9-11/kW-month
//
// ARBITRAGE SPREADS ($/MWh peak-offpeak, 4-hr BESS modeled):
//   Anchored on Lazard v18 LCOS Storage Value Snapshot (CAISO + ERCOT
//   examples on page 24-25) + ISO LMP histogram analysis. Spread captures
//   the typical 4-hour TBLS (Top of Book Less Spread) value a BESS can
//   capture during one daily charge/discharge cycle. State value is the
//   ISO/RTO-blended average; in-zone variation can be ±$10-15/MWh.
//   Refresh path: pull each ISO's published LMP datasets (PJM, NYISO,
//   ISO-NE, CAISO, ERCOT all publish hourly LMP — compute peak/off-peak
//   spreads quarterly).
//
//   Regional buckets:
//     HI: $70-90/MWh (high; isolated grid, peak/off-peak spread amplified)
//     CAISO: $40-50/MWh (duck curve + NEM 3.0 driving steeper midday valleys)
//     NYISO: $33-37/MWh (summer peaks, NYC zone wholesale spreads)
//     ISO-NE / PJM: $28-35/MWh
//     MISO / SPP: $22-28/MWh
//     WECC / SE non-RTO: $18-25/MWh (more uniform pricing)
//
// All state values are Tractova synthesis on top of ISO/regional anchors.
// Audit tier: B (industry-standard ranges + documented synthesis).
const BESS_REVENUE_DATA = {
  // ── PJM (IL, NJ, MD, VA): 2025/26 BRA $98.5/kW-yr × 60% accreditation = $59 base + LDA premium ──
  IL:  { isoRegion: 'PJM',    capacityPerKwYear: 65, demandChargePerKwMonth: 12, arbitragePerMwh: 30, installedCostPerKwh: 380, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Illinois (PJM ComEd)' },
  NJ:  { isoRegion: 'PJM',    capacityPerKwYear: 68, demandChargePerKwMonth: 15, arbitragePerMwh: 32, installedCostPerKwh: 390, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New Jersey (PJM EMAAC)' },
  MD:  { isoRegion: 'PJM',    capacityPerKwYear: 62, demandChargePerKwMonth: 13, arbitragePerMwh: 28, installedCostPerKwh: 375, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maryland (PJM)' },
  VA:  { isoRegion: 'PJM',    capacityPerKwYear: 62, demandChargePerKwMonth: 12, arbitragePerMwh: 28, installedCostPerKwh: 385, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Virginia (PJM)' },
  // ── NYISO (NY): VDER + ICAP zone stack ~$50/kW-yr; was $70 (high) ──
  NY:  { isoRegion: 'NYISO',  capacityPerKwYear: 50, demandChargePerKwMonth: 14, arbitragePerMwh: 35, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New York (NYISO)' },
  // ── ISO-NE (MA, CT, RI, ME): 2025/26 FCA $80-90/kW-yr × 60% = $48-54; was $75-80 (high) ──
  MA:  { isoRegion: 'ISO-NE', capacityPerKwYear: 60, demandChargePerKwMonth: 13, arbitragePerMwh: 32, installedCostPerKwh: 410, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Massachusetts (ISO-NE)' },
  CT:  { isoRegion: 'ISO-NE', capacityPerKwYear: 60, demandChargePerKwMonth: 14, arbitragePerMwh: 32, installedCostPerKwh: 415, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Connecticut (ISO-NE)' },
  RI:  { isoRegion: 'ISO-NE', capacityPerKwYear: 58, demandChargePerKwMonth: 13, arbitragePerMwh: 30, installedCostPerKwh: 410, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Rhode Island (ISO-NE)' },
  ME:  { isoRegion: 'ISO-NE', capacityPerKwYear: 55, demandChargePerKwMonth: 11, arbitragePerMwh: 28, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maine (ISO-NE)' },
  // ── CAISO (CA): RA bilateral $40-80/kW-yr × 70% accreditation; arbitrage bumped to $45 to reflect NEM 3.0 + duck-curve steepening 2024-2026 ──
  CA:  { isoRegion: 'CAISO',  capacityPerKwYear: 65, demandChargePerKwMonth: 18, arbitragePerMwh: 45, installedCostPerKwh: 390, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'California (CAISO)' },
  // ── MISO (MN): 2025/26 PRA zonal $50 × 70% = $35; was $40 (close) ──
  MN:  { isoRegion: 'MISO',   capacityPerKwYear: 35, demandChargePerKwMonth: 10, arbitragePerMwh: 22, installedCostPerKwh: 360, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Minnesota (MISO)' },
  // ── SPP / WECC / SE non-RTO: bilateral $20-40/kW-yr range ──
  CO:  { isoRegion: 'SPP',    capacityPerKwYear: 30, demandChargePerKwMonth: 11, arbitragePerMwh: 25, installedCostPerKwh: 350, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Colorado (SPP)' },
  NM:  { isoRegion: 'WECC',   capacityPerKwYear: 40, demandChargePerKwMonth: 10, arbitragePerMwh: 25, installedCostPerKwh: 355, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New Mexico (WECC)' },
  OR:  { isoRegion: 'WECC',   capacityPerKwYear: 35, demandChargePerKwMonth: 10, arbitragePerMwh: 22, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Oregon (WECC)' },
  WA:  { isoRegion: 'WECC',   capacityPerKwYear: 30, demandChargePerKwMonth: 9,  arbitragePerMwh: 20, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Washington (WECC)' },
  FL:  { isoRegion: 'SE',     capacityPerKwYear: 30, demandChargePerKwMonth: 9,  arbitragePerMwh: 20, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Florida (SE non-RTO)' },
  // ── HECO (HI): no capacity market — bilateral PPA captures capacity revenue. Demand charge bumped 20→22 reflecting island-grid premium ──
  HI:  { isoRegion: 'HECO',   capacityPerKwYear: 0,  demandChargePerKwMonth: 22, arbitragePerMwh: 80, installedCostPerKwh: 420, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Hawaii (HECO IRP)' },
}

const HOURS_PER_YEAR = 8760

// ── Map Supabase revenue_rates row → engine format ──────────────────────────
// Supabase returns snake_case; engine uses camelCase.
// Returns null if the rates row doesn't have the needed fields.

function mapCSRates(row) {
  if (!row) return null
  return {
    billCreditCentsKwh: Number(row.bill_credit_cents_kwh),
    recPerMwh:          Number(row.rec_per_mwh),
    itcPct:             Number(row.itc_pct),
    itcAdderPct:        Number(row.itc_adder_pct ?? 0),
    capacityFactorPct:  Number(row.capacity_factor_pct),
    installedCostPerWatt: Number(row.installed_cost_per_watt),
    degradationPct:     Number(row.degradation_pct),
    label:              row.label,
    notes:              row.notes,
  }
}

function mapCIRates(row) {
  if (!row) return null
  return {
    ppaRateCentsKwh:    Number(row.ci_ppa_rate_cents_kwh),
    escalatorPct:       Number(row.ci_escalator_pct),
    installedCostPerWatt: Number(row.ci_installed_cost_per_watt),
    itcPct:             Number(row.ci_itc_pct),
    capacityFactorPct:  Number(row.ci_capacity_factor_pct),
    degradationPct:     Number(row.ci_degradation_pct),
    retailRateCentsKwh: Number(row.ci_retail_rate_cents_kwh),
    label:              row.ci_label,
  }
}

function mapBESSRates(row) {
  if (!row) return null
  return {
    isoRegion:          row.bess_iso_region,
    capacityPerKwYear:  Number(row.bess_capacity_per_kw_year),
    demandChargePerKwMonth: Number(row.bess_demand_charge_per_kw_month),
    arbitragePerMwh:    Number(row.bess_arbitrage_per_mwh),
    installedCostPerKwh: Number(row.bess_installed_cost_per_kwh),
    roundTripEfficiency: Number(row.bess_round_trip_efficiency),
    annualDegradationPct: Number(row.bess_annual_degradation_pct),
    itcPct:             Number(row.bess_itc_pct),
    label:              row.bess_label,
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getRevenueData(stateId) {
  return STATE_REVENUE_DATA[stateId] ?? null
}

export function hasRevenueData(stateId) {
  return stateId in STATE_REVENUE_DATA
}

export function getSupportedStates() {
  return Object.entries(STATE_REVENUE_DATA).map(([id, d]) => ({ id, label: d.label }))
}

/**
 * Community-solar (CS) revenue projection — bill credit + REC + ITC,
 * 25-year NPV at an 8% discount rate. Returns null on null/zero/negative
 * MW or unsupported state.
 *
 * @param {string} stateId — USPS state code
 * @param {number|string} mwAC — system size in MW AC
 * @param {object} [rates] — optional Supabase revenue_rates row (snake_case); overrides the seeded fallback
 * @returns {{stateId, stateLabel, mw, capacityFactor, annualMWh, billCreditRevenue, recRevenue, itcValueOneTime, itcAnnualized, itcTotalPct, annualGrossRevenue, revenuePerMW, npv25, installedCostPerWatt, installedCostTotal, notes, billCreditCentsKwh, recPerMwh}|null}
 */
export function computeRevenueProjection(stateId, mwAC, rates) {
  const data = (rates ? mapCSRates(rates) : null) || STATE_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const cf = data.capacityFactorPct / 100
  const annualMWh = mw * HOURS_PER_YEAR * cf
  const annualKWh = annualMWh * 1000

  const billCreditRevenue = annualKWh * (data.billCreditCentsKwh / 100)
  const recRevenue = annualMWh * data.recPerMwh
  const installedCostTotal = mw * 1000000 * data.installedCostPerWatt
  const itcTotalPct = data.itcPct + data.itcAdderPct
  const itcValueOneTime = installedCostTotal * (itcTotalPct / 100)
  const itcAnnualized = itcValueOneTime / 6
  const annualGrossRevenue = billCreditRevenue + recRevenue + itcAnnualized
  const revenuePerMW = annualGrossRevenue / mw

  const discountRate = 0.08
  let npv25 = 0
  for (let year = 1; year <= 25; year++) {
    const degradation = Math.pow(1 - data.degradationPct / 100, year - 1)
    const yearBillCredit = billCreditRevenue * degradation
    const yearREC = recRevenue * degradation
    const yearITC = year <= 6 ? itcAnnualized : 0
    npv25 += (yearBillCredit + yearREC + yearITC) / Math.pow(1 + discountRate, year)
  }

  return {
    stateId,
    stateLabel: data.label,
    mw,
    capacityFactor: data.capacityFactorPct,
    annualMWh: Math.round(annualMWh),
    billCreditRevenue: Math.round(billCreditRevenue),
    recRevenue: Math.round(recRevenue),
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    itcTotalPct,
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(revenuePerMW),
    npv25: Math.round(npv25),
    installedCostPerWatt: data.installedCostPerWatt,
    installedCostTotal: Math.round(installedCostTotal),
    notes: data.notes,
    billCreditCentsKwh: data.billCreditCentsKwh,
    recPerMwh: data.recPerMwh,
  }
}

// ── C&I Solar projection (PPA-based) ─────────────────────────────────────────
export function getCIRevenueData(stateId) {
  return CI_REVENUE_DATA[stateId] ?? null
}

export function hasCIRevenueData(stateId) {
  return stateId in CI_REVENUE_DATA
}

/**
 * C&I (commercial / industrial) PPA revenue projection — retail rate
 * × capacity factor × hours, plus REC adder + ITC. Used by the C&I
 * Solar tech mode in the Lens form.
 *
 * @param {string} stateId
 * @param {number|string} mwAC
 * @param {object} [rates] — optional Supabase override
 * @returns {object|null}
 */
export function computeCIRevenueProjection(stateId, mwAC, rates) {
  const data = (rates ? mapCIRates(rates) : null) || CI_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const cf = data.capacityFactorPct / 100
  const annualMWh = mw * HOURS_PER_YEAR * cf
  const annualKWh = annualMWh * 1000

  const ppaRevenue = annualKWh * (data.ppaRateCentsKwh / 100)
  const installedCostTotal = mw * 1000000 * data.installedCostPerWatt
  const itcValueOneTime = installedCostTotal * (data.itcPct / 100)
  const itcAnnualized = itcValueOneTime / 6
  const annualGrossRevenue = ppaRevenue + itcAnnualized
  const savingsPercent = Math.round((1 - data.ppaRateCentsKwh / data.retailRateCentsKwh) * 100)

  const discountRate = 0.08
  let npv25 = 0
  for (let year = 1; year <= 25; year++) {
    const degradation = Math.pow(1 - data.degradationPct / 100, year - 1)
    const escalator = Math.pow(1 + data.escalatorPct / 100, year - 1)
    const yearPPA = ppaRevenue * degradation * escalator
    const yearITC = year <= 6 ? itcAnnualized : 0
    npv25 += (yearPPA + yearITC) / Math.pow(1 + discountRate, year)
  }

  return {
    stateId,
    stateLabel: data.label,
    mw,
    capacityFactor: data.capacityFactorPct,
    annualMWh: Math.round(annualMWh),
    ppaRevenue: Math.round(ppaRevenue),
    ppaRateCentsKwh: data.ppaRateCentsKwh,
    retailRateCentsKwh: data.retailRateCentsKwh,
    savingsPercent,
    escalatorPct: data.escalatorPct,
    itcPct: data.itcPct,
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(annualGrossRevenue / mw),
    npv25: Math.round(npv25),
    installedCostPerWatt: data.installedCostPerWatt,
    installedCostTotal: Math.round(installedCostTotal),
  }
}

// ── BESS projection (capacity market + demand charge + arbitrage) ─────────────
export function getBESSRevenueData(stateId) {
  return BESS_REVENUE_DATA[stateId] ?? null
}

export function hasBESSRevenueData(stateId) {
  return stateId in BESS_REVENUE_DATA
}

/**
 * BESS (battery energy storage) projection — capacity-market clearing
 * × accreditation + demand-charge management + arbitrage. Highly
 * state-dependent (CA + TX top markets; PNW limited).
 *
 * @param {string} stateId
 * @param {number|string} mwAC — power rating in MW AC
 * @param {number} [durationHrs=4] — battery duration in hours
 * @param {object} [rates] — optional Supabase override
 * @returns {object|null}
 */
export function computeBESSProjection(stateId, mwAC, durationHrs = 4, rates) {
  const data = (rates ? mapBESSRates(rates) : null) || BESS_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const kw = mw * 1000
  const mwh = mw * durationHrs

  const capacityRevenue = kw * data.capacityPerKwYear
  const demandChargeRevenue = kw * data.demandChargePerKwMonth * 12
  const arbitrageRevenue = mwh * data.arbitragePerMwh * 365 * data.roundTripEfficiency
  const annualGrossRevenue = capacityRevenue + demandChargeRevenue + arbitrageRevenue

  const installedCostTotal = mwh * 1000 * data.installedCostPerKwh
  const itcValueOneTime = installedCostTotal * (data.itcPct / 100)
  const itcAnnualized = itcValueOneTime / 6

  const discountRate = 0.08
  let npv15 = 0
  for (let year = 1; year <= 15; year++) {
    const degradation = Math.pow(1 - data.annualDegradationPct / 100, year - 1)
    const yearRevenue = (capacityRevenue + demandChargeRevenue + arbitrageRevenue) * degradation
    const yearITC = year <= 6 ? itcAnnualized : 0
    npv15 += (yearRevenue + yearITC) / Math.pow(1 + discountRate, year)
  }

  const paybackYears = annualGrossRevenue > 0 ? Math.round((installedCostTotal - itcValueOneTime) / annualGrossRevenue * 10) / 10 : null

  return {
    stateId,
    stateLabel: data.label,
    mw,
    durationHrs,
    mwh,
    isoRegion: data.isoRegion,
    capacityRevenue: Math.round(capacityRevenue),
    demandChargeRevenue: Math.round(demandChargeRevenue),
    arbitrageRevenue: Math.round(arbitrageRevenue),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(annualGrossRevenue / mw),
    itcPct: data.itcPct,
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    npv15: Math.round(npv15),
    installedCostPerKwh: data.installedCostPerKwh,
    installedCostTotal: Math.round(installedCostTotal),
    paybackYears,
    capacityPerKwYear: data.capacityPerKwYear,
    demandChargePerKwMonth: data.demandChargePerKwMonth,
    arbitragePerMwh: data.arbitragePerMwh,
    // Vintage of the seed constants (capacity payment, demand charge, arbitrage
    // spread). Rendered as an "as of" stamp on the BESS revenue panel because
    // these values do not auto-refresh and ISO clearing prices move fast.
    ratesAsOf: BESS_RATES_AS_OF,
  }
}

// ── Hybrid projection (solar + storage) ──────────────────────────────────────
/**
 * Hybrid (solar + storage) projection — composes computeRevenueProjection
 * + computeBESSProjection with shared interconnection economics.
 *
 * @param {string} stateId
 * @param {number} solarMW
 * @param {number} storageMW
 * @param {number} [durationHrs=4]
 * @param {object} [rates] — optional Supabase override
 * @returns {object|null}
 */
export function computeHybridProjection(stateId, solarMW, storageMW, durationHrs = 4, rates) {
  const csProj = computeRevenueProjection(stateId, solarMW, rates)
  const bessProj = computeBESSProjection(stateId, storageMW, durationHrs, rates)
  if (!csProj && !bessProj) return null

  const solarAnnual = csProj?.annualGrossRevenue || 0
  const storageAnnual = bessProj?.annualGrossRevenue || 0
  const annualGrossRevenue = solarAnnual + storageAnnual
  const totalMW = (parseFloat(solarMW) || 0) + (parseFloat(storageMW) || 0)

  return {
    stateId,
    stateLabel: csProj?.stateLabel || bessProj?.stateLabel,
    solarMW: parseFloat(solarMW) || 0,
    storageMW: parseFloat(storageMW) || 0,
    durationHrs,
    solarAnnualRevenue: Math.round(solarAnnual),
    storageAnnualRevenue: Math.round(storageAnnual),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: totalMW > 0 ? Math.round(annualGrossRevenue / totalMW) : 0,
    solarNpv25: csProj?.npv25 || 0,
    storageNpv15: bessProj?.npv15 || 0,
    solarInstalledCost: csProj?.installedCostTotal || 0,
    storageInstalledCost: bessProj?.installedCostTotal || 0,
    totalInstalledCost: (csProj?.installedCostTotal || 0) + (bessProj?.installedCostTotal || 0),
  }
}
