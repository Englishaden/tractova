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
// ── CS $/W sources (literal, separated from Tractova synthesis) ─────────────
//
// PRIMARY 2024 ANCHOR (LBNL Tracking the Sun 2024, October 2024 release):
//   - Large non-residential 2023 installed-price 20-80th percentile band:
//       $1.7 – $3.1 / Wdc (LBNL TTS 2024 Report, page 35)
//   - LBNL-reported 2022→2023 trend for non-residential: +$0.1-$0.2/W in
//       real terms (first rise in 15 years; LBNL TTS 2024 Report, page 30)
//   - State-level $/W medians (where n≥40) from the TTS public CSV
//       (TTS_LBNL_public_file_29-Sep-2025_all.csv) for non-residential
//       installs 1-5 MWdc, install years 2022-2024:
//       NY: $1.58/W (n=183) | MA: $2.64/W (n=84) | CA: $1.87/W (n=468)
//
// SECONDARY ANCHOR (NREL Q1 2024 Cost Benchmark + Q1 2023 CS-specific):
//   - Q1 2023 NREL benchmarked 3-MWdc community solar PV-only at MMP
//       $1.76/Wdc (modeled market price); PV+1.8MW/7.2MWh storage at $2.94/Wdc
//   - Q1 2024 NREL benchmark switched the CPV scale model to a 3-MWdc
//       agrivoltaic ground-mount ($1.55/Wdc MMP) — the modeled CS line item
//       was discontinued in 2024. Use 2023 NREL CS as last published
//       NREL-specific CS anchor.
//
// TRACTOVA SYNTHESIS on top of these anchors (forward extrapolation 2024 → 2026):
//   - National 2024 PV-only large non-res anchor: $2.55/Wdc
//       = LBNL TTS 2023 large non-res median (~$2.40, midpoint of $1.7-$3.1
//         band) + 1-yr forward at LBNL-published +$0.10-$0.20/W trend
//   - National 2024→2026 forward bump: +$0.20-$0.35/Wdc (PV-only); driver
//       breakdown:
//         • FEOC restrictions phasing in (IRA §45X, post-2024 ITC eligibility
//           restrictions on Chinese-supplier components → premium for
//           non-Chinese supply): +$0.05-$0.10/W
//         • Reshoring + domestic content threshold rising (IRA bonus credit
//           threshold 40%→55% by 2027; US module mfg capacity insufficient
//           to meet demand at premium-free pricing): +$0.03-$0.05/W
//         • Iran-Israel conflict / oil-logistics pass-through (Brent $80-110
//           ranges 2024-2025 raise transport, polymer feedstock, install-
//           labor diesel cost): +$0.02-$0.05/W
//         • Continued LBNL observed trend (non-residential prices rising
//           +$0.10-$0.20/W per year, first sustained rise in 15 years): +$0.10/W
//   - National 2026 PV-only anchor (after forward): $2.80/Wdc
//   - National 2026 PV+storage hybrid anchor: $3.15/Wdc (NREL 2023 MMP $2.94
//       + battery cost component movement + same forward layers)
//   - State-level multipliers:
//       Tier A (TTS observed, n≥40): NY 0.66, MA 1.10, CA 0.78
//         (computed as state TTS median ÷ national 2023 large non-res median ~$2.40)
//       Tier B (regional analog with LBNL/NREL state-cost gradient):
//         see per-state notes below
//   - Forward extrapolation magnitudes are Tractova editorial judgment, not
//     numbers LBNL or NREL published. Each driver named explicitly above for
//     transparency. Replace any of these +$X.XX bumps as new primary-source
//     data becomes available.
//
// CAVEAT: LBNL TTS notes its observed prices may include dealer fees adding
// 5-50% for loan-financed systems; the >$1,000 kW segment we care about is
// less affected by this loan-financing distortion (commercial-scale projects
// rarely use consumer loan products) but the band still overstates "delivered
// EPC cost" by some amount. Tractova's per-state values are our best estimate
// of all-in delivered project cost a CS developer faces for a 1-5 MW project
// in 2026 vintage.
//
// CAPACITY FACTORS: NREL PVWatts API v8 state averages (state-specific,
// not Lazard's 15-20% national range).
// BILL CREDITS: state PUC tariff filings tracked via DSIRE.
// REC PRICES: DSIRE + GATS / PJM-EIS / M-RETS depending on state.
// ITC: federal §48, 30% base + 10% adders per state qualifying status.
//
// BESS_RATES_AS_OF '2026-04' anchored on ISO/RTO clearing prices (PJM RPM,
// NYISO ICAP, ISO-NE FCM, CAISO RA) + BloombergNEF 2024 utility-scale 4hr
// BESS capex $295-$340/kWh.
//
// ── Recalibration history ──
// 2026-05-04 (Session 5): Lazard v18-anchored values shipped; values were
// based on Lazard's published $1.60-$3.30/W "Community & C&I" range with
// Tractova state allocation. Aden caught the citation problem (state-level
// data isn't what Lazard publishes) and the magnitude problem (Aden's
// IL EPC-with-domestic-content quotes ran $2.6-3.0/W, well above what
// Lazard-derived synthesis produced).
// 2026-05-04 (Session 6): re-anchored on LBNL TTS 2024 observed market data
// (1-5 MW non-res) with explicit 2024→2026 forward extrapolation. State
// values reflect all-in delivered EPC cost for 1-5 MW PV-only CS projects in
// 2026 vintage. Hybrid (PV+storage) computed by computeHybridProjection
// combining the new PV-only $/W with existing BESS_REVENUE_DATA $/kWh.
export const SOLAR_RATES_AS_OF = '2024 LBNL TTS + Tractova 2026 forward'
export const CI_RATES_AS_OF    = '2025-06'
export const BESS_RATES_AS_OF  = '2026-04'

// ── Hardcoded fallback data ──────────────────────────────────────────────────
// CS $/W per state: 2024 LBNL TTS observed anchor + 2024→2026 Tractova
//   forward (FEOC + reshoring + oil + LBNL-trend layers, see header above).
// Where TTS observed n≥40 (NY/MA/CA): use TTS state ratio × national 2026 anchor.
// Where TTS thin: regional analog, with the regional choice documented per
//   state in the `notes` field.
const STATE_REVENUE_DATA = {
  // ── Tier A: TTS observed median × forward (n≥40 in TTS public CSV) ──────
  NY: { billCreditCentsKwh: 10.5, recPerMwh: 0,     itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.0, installedCostPerWatt: 1.85, degradationPct: 0.5, label: 'New York (Value Stack)',         notes: '$/W: TTS observed median $1.58/W (n=183 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward (+~$0.27/W). NY-Sun is the largest CS market in nation, mature EPC bidding drives below-national pricing. Bill credit: NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). ITC 30% + Community Adder.' },
  MA: { billCreditCentsKwh: 12.8, recPerMwh: 35.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 16.5, installedCostPerWatt: 3.08, degradationPct: 0.5, label: 'Massachusetts (SMART 3.0)',      notes: '$/W: TTS observed median $2.64/W (n=84 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward. SMART 3.0 permitting overhead + ISO-NE labor premium drive top-of-band pricing. Bill credit: NEM ~12.8¢/kWh + SMART 3.0 tranche adder (DOER). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder.' },
  CA: { billCreditCentsKwh: 14.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 10, capacityFactorPct: 21.0, installedCostPerWatt: 2.18, degradationPct: 0.5, label: 'California (VNEM / NEM-ST)',      notes: '$/W: TTS observed median $1.87/W (n=468 large non-res 1-5 MW 2022-2024) × Tractova 2024→2026 forward. CAISO economies of scale offset prevailing-wage premium. Bill credit: VNEM blended ~14¢/kWh under NEM-ST (CPUC tariff). RPS REC thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. CS status "limited" 2026.' },
  // ── Tier B: Regional analog × national 2026 anchor ($2.80/W PV-only) ─────
  IL: { billCreditCentsKwh: 8.2,  recPerMwh: 71.50, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 17.5, installedCostPerWatt: 2.94, degradationPct: 0.5, label: 'Illinois (ComEd territory)', notes: '$/W: PJM mature CS regional analog ($2.80 national × 1.05 IL premium) — Illinois Shines mature program, premium prevailing wage labor (CCC), Cook County permitting overhead. Matches 2026 IL EPC quote range ($2.60-$3.00 with domestic content per dev intel). REC: Illinois Shines ABP ~$71.50/MWh (DSIRE). Bill credit: ComEd ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder.' },
  MN: { billCreditCentsKwh: 9.5,  recPerMwh: 4.50,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 15.2, installedCostPerWatt: 2.66, degradationPct: 0.5, label: 'Minnesota (Xcel Energy)',         notes: '$/W: MISO Upper Midwest regional analog ($2.80 × 0.95) — mature Xcel CSG program, reasonable labor cost vs national avg. Bill credit: Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC (~$4.50/MWh, M-RETS). ITC 30%.' },
  CO: { billCreditCentsKwh: 8.8,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.3, installedCostPerWatt: 2.38, degradationPct: 0.5, label: 'Colorado (Xcel Energy)',          notes: '$/W: SPP/Mountain low-cost regional analog ($2.80 × 0.85) — top-quartile NREL PVWatts CF (18.3%) lets developers pay less per W; SPP labor + simple permitting. Bill credit: ~8.8¢/kWh (PUC tariff). REC thin ($3/MWh, WREGIS). ITC 30%.' },
  NJ: { billCreditCentsKwh: 11.0, recPerMwh: 85.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.5, installedCostPerWatt: 2.80, degradationPct: 0.5, label: 'New Jersey (SREC-II / SuSI)',     notes: '$/W: PJM-NJ regional analog at national anchor ($2.80) — mature SREC-II/SuSI market keeps EPC competitive; high SREC value drives developer interest, balances PJM-NJ labor premium. Bill credit: NEM ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI.' },
  ME: { billCreditCentsKwh: 9.0,  recPerMwh: 8.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.8, installedCostPerWatt: 2.80, degradationPct: 0.5, label: 'Maine',                           notes: '$/W: ISO-NE rural regional analog at national anchor ($2.80) — between MA premium and lower-cost states; rural development with reasonable labor. Bill credit: ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%.' },
  MD: { billCreditCentsKwh: 9.5,  recPerMwh: 55.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.8, installedCostPerWatt: 2.66, degradationPct: 0.5, label: 'Maryland',                        notes: '$/W: PJM-mid regional analog ($2.80 × 0.95) — mature CS Pilot, mid-cost PJM labor, no extreme premium. Bill credit: ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI.' },
  FL: { billCreditCentsKwh: 10.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.0, installedCostPerWatt: 2.38, degradationPct: 0.5, label: 'Florida (SolarTogether)',         notes: '$/W: SE non-RTO low-labor regional analog ($2.80 × 0.85) — FL low labor; FPL/Duke utility-administered EPC procurement keeps prices competitive; weather risk priced in by FPL bidding network. Bill credit: SolarTogether ~10¢/kWh (utility tariff). No state REC. ITC 30%. CS status "limited" — capped enrollment.' },
  CT: { billCreditCentsKwh: 12.0, recPerMwh: 30.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 3.08, degradationPct: 0.5, label: 'Connecticut (SCEF)',              notes: '$/W: ISO-NE high-labor regional analog ($2.80 × 1.10) — premium ISO-NE labor + CT permitting overhead, similar to MA pricing posture. Bill credit: SCEF ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI.' },
  HI: { billCreditCentsKwh: 28.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 19.0, installedCostPerWatt: 4.06, degradationPct: 0.5, label: 'Hawaii (CBRE)',                   notes: '$/W: HI island-logistics premium ($2.80 × 1.45) — multi-leg shipping, prevailing wage, small-grid IX overhead. Above all-CONUS ranges; consistent with documented HI premium. Bill credit: HECO ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%.' },
  NM: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 22.0, installedCostPerWatt: 2.38, degradationPct: 0.5, label: 'New Mexico CS',                   notes: '$/W: WECC low-labor regional analog ($2.80 × 0.85) — top NREL PVWatts CF (22%, best in nation) and low WECC labor allow lower per-W pricing. Bill credit: ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%.' },
  OR: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.5, installedCostPerWatt: 2.66, degradationPct: 0.5, label: 'Oregon CS',                       notes: '$/W: Pacific NW regional analog ($2.80 × 0.95) — moderate labor premium balanced by reasonable permitting environment. Bill credit: ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%.' },
  RI: { billCreditCentsKwh: 13.0, recPerMwh: 45.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 2.94, degradationPct: 0.5, label: 'Rhode Island CS',                 notes: '$/W: ISO-NE mid regional analog ($2.80 × 1.05) — between MA and ME on the ISO-NE labor curve. Strong RI Class I REC market. Bill credit: ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI.' },
  VA: { billCreditCentsKwh: 9.0,  recPerMwh: 15.00, itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 17.0, installedCostPerWatt: 2.52, degradationPct: 0.5, label: 'Virginia CS',                     notes: '$/W: PJM-South regional analog ($2.80 × 0.90) — emerging CS market, lower labor than PJM-North/Mid. Bill credit: VA Shared Solar ~9¢/kWh (SCC tariff). VA REC ~$15/MWh (PJM-EIS). ITC 30%.' },
  WA: { billCreditCentsKwh: 9.0,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 13.5, installedCostPerWatt: 2.66, degradationPct: 0.5, label: 'Washington (Shared Renewables)',  notes: '$/W: Pacific NW regional analog ($2.80 × 0.95) — Pacific NW labor, low NREL PVWatts CF (13.5%, lowest-irradiance state) is a generation/economics issue not a capex issue. Bill credit: ~9¢/kWh (UTC tariff). WA REC thin (~$3/MWh, WREGIS). ITC 30%.' },
}

const CI_REVENUE_DATA = {
  // ── 8 originally curated (recalibrated 2026-05-04) ──
  IL: { ppaRateCentsKwh: 7.0,  escalatorPct: 2.0, installedCostPerWatt: 2.30, itcPct: 30, capacityFactorPct: 17.5, degradationPct: 0.5, retailRateCentsKwh: 12.5, label: 'Illinois (C&I PPA)' },
  NY: { ppaRateCentsKwh: 8.0,  escalatorPct: 2.0, installedCostPerWatt: 2.55, itcPct: 30, capacityFactorPct: 14.0, degradationPct: 0.5, retailRateCentsKwh: 18.5, label: 'New York (C&I PPA)' },
  MA: { ppaRateCentsKwh: 8.5,  escalatorPct: 1.5, installedCostPerWatt: 2.55, itcPct: 30, capacityFactorPct: 16.5, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'Massachusetts (C&I PPA)' },
  MN: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 15.2, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'Minnesota (C&I PPA)' },
  CO: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.5, installedCostPerWatt: 2.10, itcPct: 30, capacityFactorPct: 18.3, degradationPct: 0.5, retailRateCentsKwh: 12.0, label: 'Colorado (C&I PPA)' },
  NJ: { ppaRateCentsKwh: 7.5,  escalatorPct: 2.0, installedCostPerWatt: 2.45, itcPct: 30, capacityFactorPct: 15.5, degradationPct: 0.5, retailRateCentsKwh: 16.0, label: 'New Jersey (C&I PPA)' },
  ME: { ppaRateCentsKwh: 6.5,  escalatorPct: 1.5, installedCostPerWatt: 2.30, itcPct: 30, capacityFactorPct: 14.8, degradationPct: 0.5, retailRateCentsKwh: 15.5, label: 'Maine (C&I PPA)' },
  MD: { ppaRateCentsKwh: 7.0,  escalatorPct: 2.0, installedCostPerWatt: 2.35, itcPct: 30, capacityFactorPct: 15.8, degradationPct: 0.5, retailRateCentsKwh: 13.5, label: 'Maryland (C&I PPA)' },
  // ── 9 new (added 2026-05-04) ──
  CA: { ppaRateCentsKwh: 9.0,  escalatorPct: 2.5, installedCostPerWatt: 2.65, itcPct: 30, capacityFactorPct: 21.0, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'California (C&I PPA)' },
  FL: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.10, itcPct: 30, capacityFactorPct: 18.0, degradationPct: 0.5, retailRateCentsKwh: 13.0, label: 'Florida (C&I PPA)' },
  CT: { ppaRateCentsKwh: 8.5,  escalatorPct: 1.5, installedCostPerWatt: 2.40, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 23.0, label: 'Connecticut (C&I PPA)' },
  HI: { ppaRateCentsKwh: 18.0, escalatorPct: 2.0, installedCostPerWatt: 3.10, itcPct: 30, capacityFactorPct: 19.0, degradationPct: 0.5, retailRateCentsKwh: 38.0, label: 'Hawaii (C&I PPA)' },
  NM: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.5, installedCostPerWatt: 2.00, itcPct: 30, capacityFactorPct: 22.0, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'New Mexico (C&I PPA)' },
  OR: { ppaRateCentsKwh: 6.0,  escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'Oregon (C&I PPA)' },
  RI: { ppaRateCentsKwh: 8.0,  escalatorPct: 1.5, installedCostPerWatt: 2.40, itcPct: 30, capacityFactorPct: 14.5, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'Rhode Island (C&I PPA)' },
  VA: { ppaRateCentsKwh: 6.5,  escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 17.0, degradationPct: 0.5, retailRateCentsKwh: 12.0, label: 'Virginia (C&I PPA)' },
  WA: { ppaRateCentsKwh: 5.5,  escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 13.5, degradationPct: 0.5, retailRateCentsKwh: 10.0, label: 'Washington (C&I PPA)' },
}

const BESS_REVENUE_DATA = {
  // ── 8 originally curated (BESS unchanged — BloombergNEF 2024 supports current values) ──
  IL:  { isoRegion: 'PJM',    capacityPerKwYear: 65, demandChargePerKwMonth: 12, arbitragePerMwh: 30, installedCostPerKwh: 380, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Illinois (PJM)' },
  NY:  { isoRegion: 'NYISO',  capacityPerKwYear: 70, demandChargePerKwMonth: 14, arbitragePerMwh: 35, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New York (NYISO)' },
  MA:  { isoRegion: 'ISO-NE', capacityPerKwYear: 80, demandChargePerKwMonth: 13, arbitragePerMwh: 32, installedCostPerKwh: 410, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Massachusetts (ISO-NE)' },
  MN:  { isoRegion: 'MISO',   capacityPerKwYear: 40, demandChargePerKwMonth: 10, arbitragePerMwh: 22, installedCostPerKwh: 360, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Minnesota (MISO)' },
  CO:  { isoRegion: 'SPP',    capacityPerKwYear: 35, demandChargePerKwMonth: 11, arbitragePerMwh: 25, installedCostPerKwh: 350, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Colorado (SPP)' },
  NJ:  { isoRegion: 'PJM',    capacityPerKwYear: 70, demandChargePerKwMonth: 15, arbitragePerMwh: 32, installedCostPerKwh: 390, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New Jersey (PJM)' },
  ME:  { isoRegion: 'ISO-NE', capacityPerKwYear: 75, demandChargePerKwMonth: 11, arbitragePerMwh: 28, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maine (ISO-NE)' },
  MD:  { isoRegion: 'PJM',    capacityPerKwYear: 60, demandChargePerKwMonth: 13, arbitragePerMwh: 28, installedCostPerKwh: 375, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maryland (PJM)' },
  // ── 9 new (added 2026-05-04 — capacity payments per ISO + state regs) ──
  CA:  { isoRegion: 'CAISO',  capacityPerKwYear: 90, demandChargePerKwMonth: 16, arbitragePerMwh: 40, installedCostPerKwh: 390, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'California (CAISO)' },
  FL:  { isoRegion: 'SE',     capacityPerKwYear: 30, demandChargePerKwMonth: 9,  arbitragePerMwh: 20, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Florida (SE non-RTO)' },
  CT:  { isoRegion: 'ISO-NE', capacityPerKwYear: 80, demandChargePerKwMonth: 14, arbitragePerMwh: 32, installedCostPerKwh: 415, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Connecticut (ISO-NE)' },
  HI:  { isoRegion: 'HECO',   capacityPerKwYear: 0,  demandChargePerKwMonth: 20, arbitragePerMwh: 80, installedCostPerKwh: 420, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Hawaii (HECO IRP)' },
  NM:  { isoRegion: 'WECC',   capacityPerKwYear: 50, demandChargePerKwMonth: 10, arbitragePerMwh: 25, installedCostPerKwh: 355, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New Mexico (WECC)' },
  OR:  { isoRegion: 'WECC',   capacityPerKwYear: 40, demandChargePerKwMonth: 10, arbitragePerMwh: 22, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Oregon (WECC)' },
  RI:  { isoRegion: 'ISO-NE', capacityPerKwYear: 78, demandChargePerKwMonth: 13, arbitragePerMwh: 30, installedCostPerKwh: 410, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Rhode Island (ISO-NE)' },
  VA:  { isoRegion: 'PJM',    capacityPerKwYear: 60, demandChargePerKwMonth: 12, arbitragePerMwh: 28, installedCostPerKwh: 385, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Virginia (PJM)' },
  WA:  { isoRegion: 'WECC',   capacityPerKwYear: 30, demandChargePerKwMonth: 9,  arbitragePerMwh: 20, installedCostPerKwh: 370, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Washington (WECC)' },
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

// rates: optional Supabase revenue_rates row (snake_case). If provided,
// overrides the hardcoded fallback for this computation.
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
