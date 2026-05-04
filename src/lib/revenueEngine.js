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
// automated refresh cron yet (P2 backlog: pull-quarterly cron from EIA Form
// 860 + annual Lazard LCOE rebuild). The AS_OF stamps are surfaced in the
// Lens revenue methodology dropdown so users see vintage at a glance.
//
// ── Sources (literal, separated from Tractova synthesis) ────────────────────
//
// LAZARD LCOE+ v18.0 (June 2025), page 34 ("LCOE--Key Assumptions") —
//   what Lazard literally publishes:
//   - Solar PV—Community and C&I (one combined category):
//       Total Capital Cost: $1,600 – $3,300 / kW   (= $1.60 – $3.30/W)
//       Fixed O&M:          $13.00 – $20.00 / kW-yr
//       Capacity Factor:    20% – 15%
//       Facility Life:      30 years
//       Net Facility Output: 2.0 MW (Lazard's assumed scale)
//   - Solar PV—Utility:
//       Total Capital Cost: $1,150 – $1,600 / kW   (= $1.15 – $1.60/W)
//       Fixed O&M:          $11.00 – $14.00 / kW-yr
//       Capacity Factor:    30% – 20%
//       Facility Life:      35 years
//
// TRACTOVA SYNTHESIS on top of Lazard:
//   - State allocation across Lazard's $1.60–$3.30/W national range is
//     editorial judgment, not data Lazard publishes. Allocation reflects
//     RS Means 2024 state labor cost index + observed permitting/IX friction
//     + DSIRE program complexity. Median Tractova state value sits near
//     Lazard's range midpoint ($2.45/W); spread runs $1.85–$3.10/W within
//     Lazard's published $1.60–$3.30/W band.
//   - Capacity Factor uses NREL PVWatts API v8 STATE averages (more granular
//     than Lazard's 15–20% national range — Lazard CF range bracket is wider
//     because CS projects don't always pick optimal sites).
//   - Bill credits per state: state PUC tariff filings tracked via DSIRE.
//   - REC prices per state: DSIRE state pages + GATS / PJM-EIS / M-RETS.
//   - ITC: federal §48, 30% base + 10% adders per state qualifying status.
//
// BESS_RATES_AS_OF '2026-04' anchored on ISO/RTO clearing prices (PJM RPM,
// NYISO ICAP, ISO-NE FCM, CAISO RA) + BloombergNEF 2024 utility-scale 4hr
// BESS capex $295-$340/kWh — Lazard v18 LCOS chapter (page 17+) covers
// storage but Tractova uses BloombergNEF for the cell-level primary.
//
// ── Recalibration history ──
// 2026-05-04 (Site-walk Session 5): bumped CS $/W to align with Lazard v18's
// ACTUAL $1.60–$3.30/W published range — prior 2024-vintage values were
// ~$0.40–$0.85/W understated. Added 9 new states (CA/FL/CT/HI/NM/OR/RI/VA/WA)
// so all 17 cs_status ∈ ('active','limited') states have parity. Citations
// rewritten to separate Lazard's literal numbers from Tractova's synthesis.
export const SOLAR_RATES_AS_OF = '2025-06'
export const CI_RATES_AS_OF    = '2025-06'
export const BESS_RATES_AS_OF  = '2026-04'

// ── Hardcoded fallback data (matches Supabase seed in 003 + migration 043) ──
// CS $/W per state = Tractova allocation across Lazard v18's published
//   $1.60-$3.30/W Community & C&I range (page 34 of the v18 PDF).
// Capacity factors = NREL PVWatts state averages (state-specific, finer-
//   grained than Lazard's national 15-20% bracket).
// Bill credits = state PUC tariffs via DSIRE; REC prices = DSIRE + GATS /
//   PJM-EIS / M-RETS depending on state.
const STATE_REVENUE_DATA = {
  // ── 8 originally curated (re-recalibrated 2026-05-04 against literal Lazard v18) ──
  IL: { billCreditCentsKwh: 8.2,  recPerMwh: 71.50, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 17.5, installedCostPerWatt: 2.10, degradationPct: 0.5, label: 'Illinois (ComEd territory)', notes: 'Illinois Shines REC ~$71.50/MWh (DSIRE) + ComEd bill credit ~8.2¢/kWh (PUC tariff). ITC 30% + 10% LMI adder where qualifying. $/W in lower-mid Lazard v18 $1.60-$3.30/W range — PJM mid-cost labor + scale economies vs Lazard 2 MW assumption.' },
  NY: { billCreditCentsKwh: 10.5, recPerMwh: 0,     itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.0, installedCostPerWatt: 2.75, degradationPct: 0.5, label: 'New York (Value Stack)',         notes: 'NY-Sun / Value Stack ~10.5¢/kWh blended (LBMP + ICAP + E + DRV per NYSERDA). No separate SREC market. ITC 30% + Community Adder. $/W in upper-mid Lazard v18 range — NYISO labor premium + NY-Sun siting friction.' },
  MA: { billCreditCentsKwh: 12.8, recPerMwh: 35.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 16.5, installedCostPerWatt: 2.75, degradationPct: 0.5, label: 'Massachusetts (SMART 3.0)',      notes: 'Net metering ~12.8¢/kWh. SMART 3.0 adder varies by tranche (DOER tariff). SREC-II ~$35/MWh (NEPOOL GIS). ITC 30% + LMI adder. $/W in upper-mid Lazard v18 range — ISO-NE labor + SMART permitting overhead.' },
  MN: { billCreditCentsKwh: 9.5,  recPerMwh: 4.50,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 15.2, installedCostPerWatt: 2.00, degradationPct: 0.5, label: 'Minnesota (Xcel Energy)',         notes: 'Value-of-Solar ~9.5¢/kWh (Xcel VoS tariff). Minimal REC market (~$4.50/MWh, M-RETS). ITC 30%. $/W in lower Lazard v18 range — MISO Upper Midwest labor.' },
  CO: { billCreditCentsKwh: 8.8,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.3, installedCostPerWatt: 1.90, degradationPct: 0.5, label: 'Colorado (Xcel Energy)',          notes: 'Bill credit ~8.8¢/kWh (PUC tariff). Minimal REC market ($3/MWh, WREGIS). NREL PVWatts CF 18.3% (top quartile). ITC 30%. $/W near Lazard v18 floor — SPP low-cost labor + premium siting.' },
  NJ: { billCreditCentsKwh: 11.0, recPerMwh: 85.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.5, installedCostPerWatt: 2.65, degradationPct: 0.5, label: 'New Jersey (SREC-II / SuSI)',     notes: 'Net metering ~11¢/kWh. SREC-II / SuSI ~$85/MWh (PJM-EIS GATS) — strongest REC market in nation. ITC 30% + LMI. $/W in upper Lazard v18 range — PJM-NJ labor + SREC market complexity.' },
  ME: { billCreditCentsKwh: 9.0,  recPerMwh: 8.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.8, installedCostPerWatt: 2.45, degradationPct: 0.5, label: 'Maine',                           notes: 'Bill credit ~9¢/kWh (PUC tariff). Class I REC ~$8/MWh (NEPOOL GIS). ITC 30%. $/W at Lazard v18 midpoint — ISO-NE rural labor.' },
  MD: { billCreditCentsKwh: 9.5,  recPerMwh: 55.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 15.8, installedCostPerWatt: 2.30, degradationPct: 0.5, label: 'Maryland',                        notes: 'Bill credit ~9.5¢/kWh (PUC tariff). SREC ~$55/MWh (PJM-EIS GATS). ITC 30% + LMI. $/W at Lazard v18 midpoint — PJM-mid labor.' },
  // ── 9 new (added 2026-05-04 — full active+limited CS program coverage) ──
  CA: { billCreditCentsKwh: 14.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 10, capacityFactorPct: 21.0, installedCostPerWatt: 2.85, degradationPct: 0.5, label: 'California (VNEM / NEM-ST)',      notes: 'Virtual Net Energy Metering blended ~14¢/kWh under NEM-ST (CPUC tariff). CA RPS REC market thin (~$5/MWh, WREGIS). ITC 30% + LIC adder. $/W in upper Lazard v18 range — CAISO labor + IX backlog. CS market "limited" status 2026.' },
  FL: { billCreditCentsKwh: 10.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 18.0, installedCostPerWatt: 1.95, degradationPct: 0.5, label: 'Florida (SolarTogether)',         notes: 'FPL/Duke SolarTogether bill credit ~10¢/kWh (utility tariff). No state REC market. ITC 30%. $/W in lower Lazard v18 range — FL low labor; weather risk priced into FPL EPC bids. Status "limited" — utility-administered, capped enrollment.' },
  CT: { billCreditCentsKwh: 12.0, recPerMwh: 30.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 2.65, degradationPct: 0.5, label: 'Connecticut (SCEF)',              notes: 'Shared Clean Energy Facility bill credit ~12¢/kWh (PURA tariff). CT Class I REC + ZREC ~$30/MWh (NEPOOL GIS). ITC 30% + LMI. $/W in upper Lazard v18 range — ISO-NE labor.' },
  HI: { billCreditCentsKwh: 28.0, recPerMwh: 0,     itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 19.0, installedCostPerWatt: 3.10, degradationPct: 0.5, label: 'Hawaii (CBRE)',                   notes: 'Community-Based Renewable Energy: HECO bill credit ~28¢/kWh (PUC tariff — highest in nation). RPS goal-based, no traded REC. ITC 30%. $/W near Lazard v18 ceiling — HI island logistics + prevailing-wage + small-grid IX overhead.' },
  NM: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 22.0, installedCostPerWatt: 1.85, degradationPct: 0.5, label: 'New Mexico CS',                   notes: 'Bill credit ~10¢/kWh (PRC tariff). NM RPS REC thin (~$5/MWh, WREGIS). ITC 30%. NREL PVWatts CF 22% (top in nation). $/W near Lazard v18 floor — WECC low-cost labor.' },
  OR: { billCreditCentsKwh: 10.0, recPerMwh: 5.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 14.5, installedCostPerWatt: 2.25, degradationPct: 0.5, label: 'Oregon CS',                       notes: 'Oregon CS Program bill credit ~10¢/kWh (PUC tariff). OR RPS REC ~$5/MWh (WREGIS). ITC 30%. $/W in lower-mid Lazard v18 range — Pacific NW labor.' },
  RI: { billCreditCentsKwh: 13.0, recPerMwh: 45.00, itcPct: 30, itcAdderPct: 10, capacityFactorPct: 14.5, installedCostPerWatt: 2.55, degradationPct: 0.5, label: 'Rhode Island CS',                 notes: 'Rhode Island CS bill credit ~13¢/kWh (PUC tariff). RI Class I REC ~$45/MWh (NEPOOL GIS — strong). ITC 30% + LMI. $/W in upper-mid Lazard v18 range — ISO-NE labor.' },
  VA: { billCreditCentsKwh: 9.0,  recPerMwh: 15.00, itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 17.0, installedCostPerWatt: 2.20, degradationPct: 0.5, label: 'Virginia CS',                     notes: 'Virginia Shared Solar bill credit ~9¢/kWh (SCC tariff). VA REC market ~$15/MWh (PJM-EIS). ITC 30%. $/W in lower-mid Lazard v18 range — PJM-South labor.' },
  WA: { billCreditCentsKwh: 9.0,  recPerMwh: 3.00,  itcPct: 30, itcAdderPct: 0,  capacityFactorPct: 13.5, installedCostPerWatt: 2.25, degradationPct: 0.5, label: 'Washington (Shared Renewables)',  notes: 'Washington Shared Renewables bill credit ~9¢/kWh (UTC tariff). WA REC market thin (~$3/MWh, WREGIS). ITC 30%. NREL PVWatts CF 13.5% (lowest-irradiance state). $/W in lower-mid Lazard v18 range — Pacific NW labor.' },
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
