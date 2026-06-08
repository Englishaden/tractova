import { computeStatePolicyRiskScore } from './policyAdjustments'
import { assessFederalTiming } from './federalTimeline'
import { axesFromTechnology, composeTechnology, normalizeStructure } from './lensFormConstants'

export const STAGE_MODIFIERS = {
  'Prospecting':              [  0,   0,   0 ],
  'Site Control':             [  0, +10, +15 ],
  'Pre-Development':          [  0,   0, +20 ],
  'Development':              [ +5,   0, +25 ],
  'NTP (Notice to Proceed)':  [ +8,  -5, +25 ],
  'Construction':             [+10,  -8, +25 ],
  'Operational':              [+10, +10, +25 ],
}

// Retail rate tiers for C&I offtake scoring (higher rates = better C&I economics).
//
// Calibrated against EIA Form 861 commercial retail rates (2024) + qualitative
// market-depth adjustments. A high score reflects either (a) high retail rate
// = strong PPA economics, or (b) large industrial market depth even at modest
// rates (e.g. TX at 8c/kWh but enormous off-take volume). 88+ = best-in-nation;
// 70-87 = strong; 55-69 = workable; <55 = thin economics.
//
// Source: https://www.eia.gov/electricity/sales_revenue_price/  (commercial sector)
//
// COVERAGE (2026-06 data audit, Wave 3): extended from 32 → 49 entries (48 states
// + DC). The original 32 above are hand-tuned (rate + qualitative market depth).
// The "── 2026-06 extension ──" block below adds the remaining continental states
// off a TRANSPARENT rate-anchored formula — score = clamp(round(34 + 1.8·¢/kWh),
// 45, 72) — sourced from EIA EPM Table 5.6.B (Mar-2026, Form EIA-861M) and recorded
// on disk in docs/eia-861/commercial-retail-rates.json (audit-check.mjs fails CI
// when that file's review_due passes). New-cohort states get NO deep-market boost
// (thin / non-ISO markets, so retail rate is the honest dominant signal). AK + HI
// are deliberately NOT listed — real high rates but islanded/atypical offtake; they
// stay on the 55 fallback (see the docs `gated` block). Two-layer throughout:
// the rate is sourced, the score is disclosed synthesis.
const CI_OFFTAKE_SCORES = {
  // ── ISO-NE — highest retail rates in the nation ───────────────────────────
  RI: 90, MA: 85, NH: 84, CT: 80, VT: 82, ME: 68,
  // ── NYISO ─────────────────────────────────────────────────────────────────
  NY: 82,
  // ── PJM — broad mid-Atlantic market ───────────────────────────────────────
  NJ: 78, DC: 78, DE: 72, MD: 64, PA: 68, OH: 60, VA: 58,
  // ── MISO + Midwest ────────────────────────────────────────────────────────
  IL: 65, MI: 74, MN: 55, WI: 60, IN: 56, MO: 54,
  // ── SPP + Mountain West ───────────────────────────────────────────────────
  CO: 60, NM: 60,
  // ── CAISO + Southwest — large markets ─────────────────────────────────────
  CA: 88, AZ: 70, NV: 64,
  // ── ERCOT + South — large markets but lower retail ────────────────────────
  TX: 62, FL: 72, NC: 66, GA: 62, SC: 62,
  // ── Pacific Northwest — low retail, limited C&I depth ─────────────────────
  OR: 56, WA: 52,
  // ── 2026-06 extension — EIA EPM 5.6.B (Mar-2026) · score = clamp(round(34 + 1.8·¢/kWh), 45, 72) ──
  // Trailing comment = the sourced commercial ¢/kWh. No deep-market boost (thin /
  // non-ISO markets). Full source + rationale: docs/eia-861/commercial-retail-rates.json.
  AL: 61, // 15.06¢
  AR: 55, // 11.41¢
  IA: 53, // 10.53¢
  ID: 51, // 9.42¢
  KS: 55, // 11.57¢
  KY: 57, // 12.96¢
  LA: 56, // 12.20¢
  MS: 60, // 14.52¢
  MT: 56, // 12.25¢
  ND: 48, // 7.68¢ (lowest in nation)
  NE: 51, // 9.26¢
  OK: 50, // 9.00¢
  SD: 55, // 11.56¢
  TN: 58, // 13.55¢
  UT: 52, // 9.91¢
  WV: 55, // 11.77¢
  WY: 51, // 9.64¢
  // AK (22.38¢) + HI (37.94¢) deliberately omitted → 55 fallback (islanded/atypical
  // offtake; high rate ≠ real distribution-scale depth — see the docs `gated` block).
}

// ISO capacity market tiers for BESS offtake scoring.
//
// Calibrated against ISO/RTO 2024-2025 capacity-market clearing prices,
// state storage carve-outs (e.g. CA SB 100 + RA, TX ERCOT ancillary
// services market), and IRP procurement plans. 80+ = aggressive paying
// markets; 60-79 = workable; <60 = thin / spec.
const BESS_OFFTAKE_SCORES = {
  // ── CAISO — aggressive RA + storage carve-outs, best paying market ────────
  CA: 88,
  // ── ERCOT — massive ancillary services + arbitrage tailwind ───────────────
  TX: 85,
  // ── ISO-NE ────────────────────────────────────────────────────────────────
  MA: 80, ME: 78,
  // ── PJM — broad mid-Atlantic + capacity market ────────────────────────────
  IL: 75, NJ: 75, MD: 70, VA: 72, PA: 70, OH: 65, DE: 68, DC: 66,
  // ── NYISO ─────────────────────────────────────────────────────────────────
  NY: 72,
  // ── Mountain West / SW ────────────────────────────────────────────────────
  AZ: 65, NV: 60, NM: 55, CO: 50,
  // ── MISO ──────────────────────────────────────────────────────────────────
  MN: 55, MI: 58, WI: 52,
  // ── Pacific Northwest — limited capacity market ───────────────────────────
  WA: 48, OR: 45,
  // ── SE — modest capacity-market depth ─────────────────────────────────────
  FL: 60, NC: 55, GA: 52,
}

// Net Billing export-credit basis. Under net billing, EXPORTS are credited
// BELOW the retail rate (at "avoided cost"), unlike net metering's full-retail
// export — so the offtake signal hinges on how far below retail the export
// credit sits. Stored as the sourced export-credit-to-retail RATIO per state.
// Only states with a sourced ratio score for real ('researched'); every other
// state stays honestly gated on a directional baseline (no fabricated values).
// Add a state ONLY with a citable source.
//
// Two-layer (data-honesty): the RATIO is sourced/real; the 0-100 offtake SIGNAL
// is Tractova's disclosed synthesis — anchor × (0.35 + 0.65·ratio), where anchor
// is the state's retail offtake (CI_OFFTAKE_SCORES) and the 0.35 floor is the
// residual self-consumption value retained when exports ≈ worthless. See the
// Net Billing branch in computeSubScores.
//
// TOU methodology call (2026-05-27): when an export tariff is time-of-use, we
// use the DOMINANT-RATE APPROXIMATION — the rate that applies to most kWh of
// solar export across the year (typically the off-peak / non-summer band). This
// is what ID already does. The alternative — production-weighting by an
// assumed solar generation shape — would introduce internal synthesis (which
// shape? which lat/orientation?) on top of the export rate, breaking the
// two-layer pattern (ratio sourced, signal disclosed). Dominant-rate is the
// honest, conservative call: in states with strong summer on-peak premiums and
// summer-peaking solar, the real-world export value may be HIGHER than this
// signal reflects. Per-state override only when the utility/PUC itself
// publishes a production-weighted "effective" rate we can cite.
//
// Each ratio below is sourced + WebFetch-verified; states whose export tariff
// is per-interval time-varying (HI Smart DER, NY VDER value-stack) and where
// no single dominant rate applies are intentionally LEFT OUT (gated) rather
// than approximated loosely. NV credits exports at 75% of retail but calls it
// net METERING (not avoided-cost net billing) — fits NET_METERING_HAIRCUT
// roadmap (#2 in BUILD_LOG), not this list.
const NET_BILLING_EXPORT_RATIO = {
  // AR — Non-legacy net metering (after Sep 30 2024): avoided cost = MISO/SPP
  //   prior 12-month LMP avg for the utility load zone (per Ark. Code § 23-18-
  //   604 / S.B. 295, 2023). Entergy AR ~4¢/kWh; SWEPCO AR ~4-6¢ → ~4.0¢ vs
  //   11.50¢ retail (EIA EPM Mar-2026 commercial) → 0.348 ≈ 0.35. Legacy
  //   customers (interconnected by Sep 30 2024) are grandfathered at full
  //   retail through 2040 — we score the non-legacy regime that applies to NEW
  //   builds. Source on disk: docs/dsire-net-billing/AR.txt; rate cross-refs:
  //   Wattbuild AR + Daily Energy Insider ("around $0.04/kWh") + Arkansas
  //   Advanced Energy Association (SWEPCO 4-6¢).
  AR: 0.35,
  // AZ — APS export compensation under the ACC-approved rate (phasing down to
  //   avoided cost via the RCP framework): 6.171¢/kWh as of Feb 25 2026 vs APS
  //   residential ~12.8¢/kWh retail → 0.482 ≈ 0.48. TEP 5.13¢ and UNS 6.12¢ are
  //   slightly lower; APS dominates state load so it anchors the signal.
  //   Source on disk: docs/dsire-net-billing/AZ.txt (DSIRE paste, fetched 2026-05-26).
  AZ: 0.48,
  // CA — Net Billing Tariff (NEM 3.0), eff. 2023-04-15: exports at the CPUC
  //   Avoided Cost Calculator, ~8-9¢/kWh vs ~30-44¢ retail → ~0.20-0.27. Using
  //   0.23. Sources: Aurora Solar NBT (SDG&E Aug: 8.8¢ vs 44¢) · PV Magazine
  //   (avg ~30¢→~8¢, ~75% cut vs NEM 2.0).
  CA: 0.23,
  // ID — Idaho Power moved net metering → net billing (Jan 2024); avoided-cost
  //   Export Credit Rate ~2.9-3.4¢/kWh for the vast majority of the year vs
  //   ~8-10¢ retail → ~0.33. (TOU: a narrow summer on-peak window clears 15.7¢,
  //   above retail — this is the dominant-rate approximation, conservative for
  //   summer-peaking solar.) Source: pv-magazine-usa (Idaho PUC 2025-09-30 order
  //   2.9¢/3.4¢/15.7¢; "pays 3¢, sells 8-10¢").
  ID: 0.33,
  // IN — S.B. 309 (2017) Excess Distributed Generation: exports credited at
  //   1.25 × prior-year avg wholesale LMP, updated annually per IOU. 2026 EDG
  //   rates (Solar United Neighbors, sourced from IURC orders): NIPSCO 4.97¢,
  //   AES Indiana 5.43¢, Indiana Michigan Power 5.47¢, Duke Energy IN 5.51¢,
  //   CenterPoint (Vectren) 5.56¢ — 5-utility avg ~5.30¢ vs 14.32¢ retail (EIA
  //   EPM Mar-2026 commercial) → 0.370 ≈ 0.37. Source on disk:
  //   docs/dsire-net-billing/IN.txt.
  IN: 0.37,
  // KY — S.B. 100 (2019) moved IOUs from net metering to net billing; each IOU
  //   triggered transition in its next rate case. Post-Sep 24 2021 customers
  //   take service under NMS-2 (dollar-denominated bill credits). KPSC 2021
  //   order set LG&E 6.9¢ + KU 7.4¢ as the export credit rate, distinct from
  //   the full retail rate; KPSC rejected utilities' proposed 2.3¢ floor. LG&E
  //   and KU are sister utilities (PPL Corp) and split ~all KY IOU load
  //   between them — avg 7.15¢ vs 13.20¢ retail (EIA EPM Mar-2026 commercial)
  //   → 0.542 ≈ 0.54. Pre-Sep 24 2021 customers grandfathered at full retail
  //   for 25 years (covered by NM list, not NB). Electric cooperatives stay
  //   on full-retail net metering (not in scope for this NB list). Duke KY +
  //   Kentucky Power transition at each IOU's next rate case but are smaller
  //   share — rate not separately wired. Source on disk:
  //   docs/dsire-net-billing/KY.txt; rate cite: Mountain Association article
  //   on 2021 KPSC order (NMS-2 export rates).
  KY: 0.54,
  // LA — Post-Dec 31 2019 systems: exports at the utility's avoided cost rate,
  //   instantaneous netting (Rider Schedule DG, two-channel billing). Entergy
  //   LA publishes 2.59331¢/kWh eff. Apr 1 2025 — dominant utility by load,
  //   anchors the signal. Pre-2020 systems are grandfathered at full retail
  //   through 2034 (covered by NM list, not NB). 2.59¢ vs 12.93¢ retail (EIA
  //   EPM Mar-2026 commercial) → 0.200 ≈ 0.20. Source on disk:
  //   docs/dsire-net-billing/LA.txt; rate cite: entergylouisiana.com/net-metering.
  LA: 0.20,
  // MI — Inflow-Outflow tariff (post-2018, applies to all DG up to 550 kW —
  //   Tractova's distribution-scale band): outflow credited at power-supply
  //   component of retail. DTE Rider 18 D1.2 ~6.89-7.02¢/kWh; Consumers Energy
  //   RSP-DG off-peak ~7.89¢ (on-peak 11.78¢ — dominant rate methodology uses
  //   off-peak as the majority-of-kWh credit). 2-utility avg ~7.8¢ vs 15.66¢
  //   retail (EIA EPM Mar-2026 commercial) → 0.499 ≈ 0.50. Modified-NM
  //   crediting basis ("power supply component of retail OR monthly avg LMP")
  //   yields the same ratio. Source on disk: docs/dsire-net-billing/MI.txt;
  //   rate cites: aurorasolar.com/blog/dte-net-metering + solarreviews
  //   michigan-net-metering.
  MI: 0.50,
  // NC — Post-Oct 1 2023 systems: monthly netting (TOU self-netting within
  //   each period), any excess credited at the Net Excess Energy Credit (NEEC)
  //   avoided-cost rate. Duke Energy Carolinas + Duke Energy Progress (~95%
  //   of NC IOU load) publish a single NEEC rate ~3.4¢/kWh (reviewed every two
  //   years). 3.4¢ vs 10.63¢ retail (EIA EPM Mar-2026 commercial) → 0.320 ≈
  //   0.32. The TOU element is internal self-netting only; the export credit
  //   itself is a flat avoided-cost rate, so dominant-rate methodology applies
  //   directly. Source on disk: docs/dsire-net-billing/NC.txt; rate cites:
  //   solarreviews + energysage (Duke NEEC ~$0.034).
  NC: 0.32,
  // OH — Net metering credits excess at the "energy-only component of the
  //   utility's Standard Service Offer" — the unbundled GENERATION rate, not
  //   the full bundled retail (which adds distribution + transmission charges
  //   + riders). This is a net-billing structure even though Ohio calls it
  //   "net metering." AEP Ohio Generation Energy Rider (GENE) 11.0¢/kWh as of
  //   2025 — dominant IOU by load, anchors the signal. Duke OH + FirstEnergy
  //   (AEP, Cleveland Illuminating, Toledo Edison) follow the same structure
  //   with their own SSO generation rates; not separately wired here. 11.0¢
  //   vs 14.03¢ retail (EIA EPM Mar-2026 commercial) → 0.784 ≈ 0.78. Highest
  //   ratio in the sourced cohort — reflects OH's competitive-retail market
  //   structure where generation is a substantial share of the bundled rate
  //   even when unbundled at the GENE. Source on disk:
  //   docs/dsire-net-billing/OH.txt; rate cite: solarreviews.com
  //   /blog/going-solar-with-aep-ohio (2025 GENE 11.0¢).
  OH: 0.78,
  // SC — Solar Choice Permanent Tariffs (post Jan 1 2022) per PSC Orders
  //   2021-390 + 2021-391: monthly TOU self-netting; any excess kWh at end of
  //   month credited at a utility-specific avoided-cost rate (NEEC). DSIRE-
  //   quoted 2023 rates (most recently verifiable single-source figures):
  //   Duke Energy Carolinas 2.70¢, Duke Energy Progress 2.30¢, Dominion
  //   Energy SC 3.36¢. Simple 3-IOU avg 2.79¢ (≈ the three serve roughly
  //   comparable SC loads, with DEC largest in upstate, Dominion in midlands,
  //   DEP in coastal areas) vs 11.70¢ retail (EIA EPM Mar-2026 commercial)
  //   → 0.239 ≈ 0.24. Pre-Jan 2022 customers grandfathered on a prior
  //   net-metering tariff through 2025-2029 (covered by NM list, not NB).
  //   Like NC, TOU self-netting → flat avoided-cost export credit (dominant-
  //   rate applies cleanly). Note: 2023 rates may have been refreshed since;
  //   tariff revisions roll through the PSC eTariff system roughly annually.
  //   Source on disk: docs/dsire-net-billing/SC.txt (DSIRE 2026-03-02 last-
  //   updated, but DSIRE itself only cites the 2023 figures).
  SC: 0.24,
  // UT — Rocky Mountain Power net billing Export Credit Rate 5.636¢ (summer) /
  //   4.745¢ (winter) vs ~10.2¢ retail → "roughly half". Recalculated each Mar 1.
  //   Sources: PUCN/RMP ECR figures · EnergySage ("~6¢, roughly half of retail").
  UT: 0.49,
}

// Deliberately NOT in the NB list — each is documented here so the absence
// is recorded as a deliberate scope decision, not a missing TODO:
//
// MT — Net METERING (not net billing): full-retail crediting with annual
//   surrender of unused credits at each customer-elected anchor month
//   (Jan/Apr/Jul/Oct). Use-it-or-lose-it reset doesn't fit the net-billing
//   export-ratio model (the ratio is 1.0 until the year-end surrender, then
//   the unused-balance haircut kicks in). Belongs to the NET_METERING_HAIRCUT
//   roadmap (BUILD_LOG DO NEXT #2), not this list. Source on disk:
//   docs/dsire-net-billing/MT.txt.
//
// VA — Net METERING: monthly netting at full retail rate; 12-month carry-
//   forward with customer's choice between rolling credit forward indefinitely
//   OR cashing out at avoided cost. A savvy operator sized for annual self-
//   consumption clears at full retail; only the year-end residual is cashed
//   out (small haircut). 2025 Appalachian Power transition to NMS II RETAINED
//   monthly netting (SCC explicitly rejected utility's NB proposal). Stays on
//   the NM full-retail anchor (CI_OFFTAKE_SCORES VA). Source on disk:
//   docs/dsire-net-billing/VA.txt.
//
// MN — HYBRID NM/NB tiered by size: <40 kW = full retail (NM); 40 kW – 1 MW
//   (the Tractova-scale band) = avoided cost DEFAULT, with customer-opt-in
//   kWh-credit alternative (year-end residual cash at avoided cost). For a
//   typical commercial system sized to self-consume, the kWh-credit option
//   dominates economically (≈ NM), but the regulatory DEFAULT is avoided
//   cost (≈ NB). Treating MN as pure NB would overstate the haircut for
//   savvy developers; treating as pure NM understates it for export-sized
//   projects. Additionally, Xcel's Rider QF1 avoided-cost rate isn't
//   WebFetch-accessible (sits inside Xcel's tariff-book PDFs); the
//   community-solar VOS rate is published but is a different tariff
//   (~9-11¢ vs ~3-4¢ pure avoided cost). Stays gated until either a
//   sourced Xcel QF1 figure or a separate hybrid-tier treatment lands.
//   Source on disk: docs/dsire-net-billing/MN.txt.

// Net Metering export-credit basis. Under traditional NM, exports are
// credited at the FULL retail rate, so the offtake signal tracks the
// state's retail-rate tier (CI_OFFTAKE_SCORES) — that's the default
// behavior in the Net Metering branch of computeSubScores. A small number
// of states have moved to a PER-KWH-NET-EXPORT haircut while still calling
// it "net metering" — these have an entry here. Same two-layer pattern as
// NET_BILLING_EXPORT_RATIO: the ratio is sourced/real; the 0-100 signal is
// disclosed synthesis (anchor × (0.35 + 0.65·ratio); 0.35 floor = residual
// self-consumption value, identical formula as NB for cross-structure
// consistency). Add a state ONLY with a citable per-kWh haircut.
//
// Deliberately NOT in this map (conditional/year-end-only haircuts; the
// state-level signal stays at the NM full-retail anchor):
//   MT — annual surrender of unused credits at each customer-elected anchor
//        month. Only haircuts oversized systems; load-matched systems take
//        no haircut. State-level signal stays at NM anchor; project-level
//        sizing belongs to §03 Dev Feasibility, not §04 monetization signal.
//   IA — within-year credits at full retail; year-end residual cashed out
//        at avoided cost. Same logic as MT — only oversized systems lose
//        meaningful value. Stay on NM anchor.
//   VA — 12-month carryover with customer-OPT-IN cash-out (or indefinite
//        roll-forward). The default-savvy choice is indefinite roll-forward
//        (no haircut). 2025 SCC Appalachian Power NMS II order rejected the
//        utility's NB proposal — NM regime retained.
//   HI — Smart Export per-island TOU; can't be reduced to single dominant
//        rate (per the TOU methodology call, dominant-rate doesn't apply
//        where the export rate itself is per-interval). Stays gated.
const NET_METERING_EXPORT_RATIO = {
  // NV — NV Energy NMR-405 Tier 4 (current tier for new applicants since
  //   Tier 3 capacity benchmark filled in June 2019): excess export
  //   credited at 75% of NV Energy's then-effective retail rate, per
  //   AB-405's tiered net-metering schedule (Tier 1 95% → 2 88% → 3 81%
  //   → 4 75%, each tier closing when 80 MW of new capacity hits). Earlier-
  //   tier customers keep their rate for 20 years (grandfathered). 0.75
  //   confirmed by Solar United Neighbors NV resource page + NV Energy
  //   NMR-405 rate schedule (2025-11-15 effective). Source: WebFetch
  //   solarunitedneighbors.org/resources/net-metering-in-nevada/.
  NV: 0.75,
}

// Sorted state lists for user-facing "coverage" messaging. Kept here so the
// scoring engine is a single source of truth — the Lens UI reads these via
// getOfftakeCoverageStates() to render the "limited coverage" caption.
export const CI_OFFTAKE_COVERAGE = Object.keys(CI_OFFTAKE_SCORES).sort()
export const BESS_OFFTAKE_COVERAGE = Object.keys(BESS_OFFTAKE_SCORES).sort()
export const NET_BILLING_OFFTAKE_COVERAGE = Object.keys(NET_BILLING_EXPORT_RATIO).sort()
// States where Net Metering ≠ full retail (per-kWh-net-export haircut).
// Distinct from NB coverage: these are still full-retail in structure for
// self-consumption, with a defined export-credit reduction on top.
export const NET_METERING_HAIRCUT_STATES = Object.keys(NET_METERING_EXPORT_RATIO).sort()

// Curated offtake coverage for a project's monetization structure (accepts a
// legacy technology string or an {architecture, structure} axes object).
//   - C&I Solar → EIA Form 861 retail-rate coverage list
//   - legacy Standalone BESS → ISO capacity-market coverage list
//   - Net Metering → retail-rate coverage list (full-retail export anchor)
//   - Net Billing → states with a sourced export-credit ratio (else gated)
//   - Community Solar → null (all 50 states curated)
export function getOfftakeCoverageStates(technology) {
  const { architecture, structure } = axesFromTechnology(technology)
  if (architecture === 'Standalone BESS') return BESS_OFFTAKE_COVERAGE
  if (structure === 'C&I Solar') return CI_OFFTAKE_COVERAGE
  if (structure === 'Net Metering') return CI_OFFTAKE_COVERAGE        // retail-rate anchor
  if (structure === 'Net Billing') return NET_BILLING_OFFTAKE_COVERAGE // sourced export-credit states
  return null
}

// ── Incentives pillar (Pillar 4 — ITC step-up eligibility) ───────────────────
// "Can we get ITC step-ups in this county?" Scored from REAL, observed,
// county-level federal eligibility — EPA Energy Communities, Census/CDFI NMTC
// Low-Income Communities, HUD QCT/DDA. NO dollars: this measures how rich the
// ITC ADDER STACK is at this location. The §48E base 30% (with prevailing-wage
// + apprenticeship) is available nationwide; the location bonus stack
// (+10% Energy Community, +10% Low-Income Community) is what varies by county.
//
// Input is the raw getter results { energyCommunity, nmtcLic, hudQctDda } (from
// programData.getEnergyCommunity / getNmtcLic / getHudQctDda). A null getter
// result means "no qualifying row for this county" → treated as not-eligible
// for that pathway. When ALL three are null we have no coverage → score null
// (excluded from the composite via rebalance) rather than fabricate a baseline.
export function computeIncentiveScore(incentives, mw = null) {
  if (!incentives) return { score: null, coverage: 'none', adders: {} }
  const { energyCommunity, nmtcLic, hudQctDda } = incentives
  const hasCoverage = energyCommunity != null || nmtcLic != null || hudQctDda != null
  if (!hasCoverage) return { score: null, coverage: 'none', adders: {} }

  const ec = !!(energyCommunity && energyCommunity.isEnergyCommunity)
  const nmtc = !!(nmtcLic && nmtcLic.isEligible)
  const hud = !!(hudQctDda && (hudQctDda.qctCount > 0 || hudQctDda.isNonMetroDda))
  // §48(e) Category 1 Low-Income Community bonus uses the NMTC LIC definition —
  // NOT the LIHTC QCT designation. So the LIC pathway is NMTC-only (Aden's
  // 2026-06 call). HUD QCT/DDA is still computed + surfaced (`hudQctDda` in
  // adders) as informational context, but it no longer grants the +25 adder —
  // the prior `nmtc || hud` OR-logic over-granted it to QCT-only counties
  // (lowering those counties' incentive score by 25 now is the intended fix).
  const licTract = nmtc
  // The LIC bonus is also statutorily capped at facilities ≤5 MW AC net output
  // (the engine previously awarded +25 regardless of size, over-granting it to
  // the 10-20 MW projects in Tractova's scope, which the UI flags "≤5 MW only").
  // The Energy Community +10% has no size cap. mw=null (unknown) → don't cap.
  const licSizeEligible = mw == null || mw <= 5
  const lic = licTract && licSizeEligible

  // 50 = base §48E (30% with PW&A), no location bonus. +25 Energy Community,
  // +25 Low-Income Community → up to 100 (full adder stack, potential ~50% ITC).
  const score = 50 + (ec ? 25 : 0) + (lic ? 25 : 0)
  return { score, coverage: 'live', adders: { energyCommunity: ec, lowIncomeCommunity: lic, nmtc, hudQctDda: hud, licSizeCapped: licTract && !licSizeEligible } }
}

// ── IX live-blend thresholds ─────────────────────────────────────────────────
// Calibrated 2026-04-30 from the actual ix_queue_data row distribution
// (probe: scripts/probe-ix-queue.mjs). Adjustments stack and are clamped to
// ±10 so the live signal can move a curated baseline meaningfully but
// never dominate it (a "moderate" curated score should not flip to "easy"
// from queue stats alone — the curated label encodes structural ISO context
// the queue snapshots don't see).
//
// Bias direction: HIGHER score = easier IX. Long study months and large
// pending MW = queue is more crowded = harder = NEGATIVE adjustment.
function ixLiveAdjustment(ixQueueSummary) {
  if (!ixQueueSummary || !ixQueueSummary.totalProjects) return 0

  // cs_pipeline (NYSERDA distribution) is a DEPLOYMENT-PIPELINE signal, not ISO
  // study-queue depth — it carries no study-months/withdrawal/upgrade-cost. We
  // do NOT blend it into the score (a large active CS pipeline ≠ a slow study
  // queue); it surfaces as live CONTEXT only, with the score held on the
  // curated ixDifficulty baseline. Coverage still reads 'live' (real data shown).
  if (ixQueueSummary.signalType === 'cs_pipeline') return 0

  let adj = 0

  // Study-time band — strongest signal. p50=20, p75=24 across observed rows.
  const months = Number(ixQueueSummary.avgStudyMonths) || 0
  if      (months >= 24) adj -= 8
  else if (months >= 20) adj -= 3
  else if (months >= 14) adj += 0
  else if (months > 0)   adj += 5  // <14mo studies → very healthy queue

  // MW-pending band — secondary signal. p50=720, p75=980 across observed.
  const mw = Number(ixQueueSummary.totalMW) || 0
  if      (mw >= 1500) adj -= 6
  else if (mw >= 1000) adj -= 3
  else if (mw >=  500) adj += 0
  else if (mw >    0)  adj += 3   // <500MW → uncrowded

  // Clamp so live signal can shift score by at most ±10 from curated baseline.
  if (adj >  10) adj =  10
  if (adj < -10) adj = -10
  return adj
}

// Site sub-score from (availableLand, wetlandWarning) tri-state inputs.
// Each input is one of: true, false, null (unknown).
//
// Calibration matrix (solar; BESS uses just wetland with land less critical):
//   land=true,  wet=false → 82  (best — open developable, no permit risk)
//   land=true,  wet=true  → 56  (mixed — land available but wetland constraint)
//   land=false, wet=false → 42  (mixed — limited land but no wetland constraint)
//   land=false, wet=true  → 26  (worst — limited land + wetland permit risk)
//
// Partial-input semantics (only one of the two known): return the MIDPOINT
// of the two outcomes consistent with the known input. This is the honest
// answer to "we know X but not Y" — communicates the uncertainty in the
// score itself rather than picking a favorable default. Replaces a prior
// `null → favorable` shortcut that could mis-score by 30+ pts when the
// missing input later filled in unfavorably (e.g. SSURGO done first, then
// NWI catches up showing high wetland coverage).
//
// Both null → site=60 baseline (no info, neutral).
//
// Flood (2026-06 Wave 3 — third constraint): a county heavy in FEMA Special
// Flood Hazard Area is a real siting constraint (buildable acreage, insurability,
// permitting), so floodWarning=true applies a flat additive penalty on top of the
// land×wetland base. It's lighter than the wetland hit (flood is mitigable/
// insurable; a wetland 404 is a hard permit gate). Unknown flood (null) → no
// penalty — we don't penalize missing data, matching the partial-input discipline
// above; the penalty never drives the score below 0.
const SITE_FLOOD_PENALTY = 12
function computeSiteSubScore(architecture, availableLand, wetlandWarning, floodWarning = null) {
  let base
  if (architecture === 'Standalone BESS') {
    // Legacy standalone BESS depends primarily on wetland permitting, not land
    // area (1-2 acres/MW vs solar's 5-7).
    if (wetlandWarning === false)     base = 78
    else if (wetlandWarning === true) base = 58
    else                              base = 68  // wetland unknown — midpoint of (78, 58)
  } else {
    // Solar (Standalone PV / PV + Storage) — footprint dominated by the PV array.
    const land = availableLand
    const wet  = wetlandWarning
    if      (land === true  && wet === false) base = 82
    else if (land === true  && wet === true)  base = 56
    else if (land === false && wet === false) base = 42
    else if (land === false && wet === true)  base = 26
    // Partial-input midpoints
    else if (land === true  && wet == null)   base = 69  // (82+56)/2
    else if (land === false && wet == null)   base = 34  // (42+26)/2
    else if (land == null   && wet === false) base = 62  // (82+42)/2
    else if (land == null   && wet === true)  base = 41  // (56+26)/2
    else                                      base = 60  // both null — neutral
  }
  if (floodWarning === true) base = Math.max(0, base - SITE_FLOOD_PENALTY)
  return base
}

/**
 * Main entry point — computes the three sub-scores (offtake, ix, site)
 * + per-axis coverage tier strings. Engine is LIVE (re-evaluated on
 * every render) so an underlying data refresh propagates without any
 * cache-invalidation step.
 *
 * @param {object|null} stateProgram — row from state_programs
 * @param {object|null} countyData — { siteControl, geospatial, ... }
 * @param {string} [stage] — project stage ('Prospecting' .. 'Operational') for stage modifiers
 * @param {string|{architecture:string, structure:string}} [technology] — two-axis
 *        project model: pass {architecture, structure}, OR a legacy/derived
 *        technology string (normalized via axesFromTechnology for back-compat).
 *        Offtake is driven by structure; the IX/site modifier by architecture.
 * @param {{totalProjects:number, totalMW:number, avgStudyMonths:number}|null} [ixQueueSummary] — when present, blends ±10 pts onto the curated IX baseline
 * @returns {{offtake:number, ix:number, site:number, coverage:{offtake:'researched'|'fallback', ix:'live'|'curated', site:'live'|'researched'|'fallback'}}}
 */
export function computeSubScores(stateProgram, countyData, stage = '', technology = 'Community Solar', ixQueueSummary = null, policyEvents = null, mw = null, opts = {}) {
  if (!stateProgram) return { offtake: 0, ix: 0, site: 0, incentives: null, policyTiming: null, coverage: { offtake: 'researched', ix: 'curated', site: 'researched', incentives: 'none', policyTiming: 'none' } }

  // Two-axis model: accept {architecture, structure} or a legacy technology string.
  // normalizeStructure maps the pre-2026-05-24 'C&I behind-the-meter' label that
  // legacy saved rows carry to the canonical 'C&I Solar' so they score correctly.
  const axes = (technology && typeof technology === 'object')
    ? technology
    : axesFromTechnology(technology)
  const architecture = axes.architecture
  const structure = normalizeStructure(axes.structure)
  const isLegacyBess = architecture === 'Standalone BESS'

  let offtake, ix, site
  // 'researched' = state is in our curated coverage list for this tech / county
  //                has seeded site-control data.
  // 'fallback'   = state is outside curated coverage / county lacks site data;
  //                sub-score reflects an estimated baseline, not a researched
  //                value. UI surfaces this as a "limited coverage" caption to
  //                match the honesty already shown on the revenue panel.
  let offtakeCoverage = 'researched'
  // Site coverage tier (highest-to-lowest authority):
  //   'live'       = derived from county_geospatial_data (NWI wetlands +
  //                  SSURGO prime farmland). SSURGO farmland is live weekly
  //                  (49 states); NWI wetlands are seeded for a partial set of
  //                  counties, so a county can be 'live' on farmland alone.
  //   'researched' = curated boolean from county_intelligence (only ~18
  //                  states currently seeded). Used as fallback when the
  //                  live row hasn't been ingested yet for this county.
  //   'fallback'   = neither source available; site=60 placeholder.
  const geo = countyData?.geospatial
  const hasLiveGeo = geo && (geo.wetlandCoveragePct != null || geo.primeFarmlandPct != null)
  const siteCoverage = hasLiveGeo
    ? 'live'
    : (countyData?.siteControl ? 'researched' : 'fallback')
  // IX coverage flag: 'live' when ix_queue_data signals are blended into the
  // score (8 states as of 2026-04-30 — top CS markets); 'curated' when the
  // score is driven by stateProgram.ixDifficulty alone. Library calls don't
  // pass ixQueueSummary so all Library scores stay 'curated' — opt-in
  // architecture means no regression where the data isn't pre-fetched.
  const ixCoverage = (ixQueueSummary && ixQueueSummary.totalProjects > 0) ? 'live' : 'curated'

  // ── Offtake sub-score (driven by monetization STRUCTURE) ──
  if (isLegacyBess) {
    // Legacy standalone BESS (merchant capacity market) — preserved for existing
    // saved projects; not offered for new ones (scope: merchant storage is OUT).
    if (BESS_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    offtake = BESS_OFFTAKE_SCORES[stateProgram.id] ?? 45
  } else if (structure === 'C&I Solar') {
    if (CI_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    offtake = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
  } else if (structure === 'Net Metering') {
    // Net metering credits exports at the FULL retail rate by default, so its
    // offtake value tracks the same retail-rate signal as C&I — reuse that
    // curated anchor (EIA Form 861). 'researched' where curated; the UI
    // discloses net_metering_status (expose + disclose) rather than gating on
    // per-state NM availability.
    //
    // EXCEPTION: states that still call it "net metering" but apply a
    // per-kWh-net-export haircut (NV NMR-405 Tier 4 at 75% of retail).
    // Same two-layer formula as Net Billing — anchor × (0.35 + 0.65·ratio),
    // floor captures self-consumption value retained at retail. At ratio=1.0
    // the formula degenerates to anchor exactly, so unsourced NM states are
    // unaffected.
    if (CI_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    const nmAnchor = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
    const nmRatio = NET_METERING_EXPORT_RATIO[stateProgram.id]
    if (nmRatio != null) {
      offtake = Math.round(nmAnchor * (0.35 + 0.65 * nmRatio))
    } else {
      offtake = nmAnchor
    }
  } else if (structure === 'Net Billing') {
    // Exports credited at avoided cost (below retail). Where the export-credit
    // ratio is sourced (NET_BILLING_EXPORT_RATIO), score it for real: anchor to
    // the state retail offtake, scaled by the sourced ratio (0.35 floor =
    // residual self-consumption value when exports ≈ worthless). States without
    // a sourced ratio stay honestly gated on a directional baseline.
    const nbRatio = NET_BILLING_EXPORT_RATIO[stateProgram.id]
    if (nbRatio != null) {
      const anchor = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
      offtake = Math.round(anchor * (0.35 + 0.65 * nbRatio))
    } else {
      offtakeCoverage = 'fallback'
      offtake = 45
    }
  } else {
    // Community Solar (default) — driven entirely by state_programs DB,
    // which has all 50 states curated, so coverage stays 'researched'.
    const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
    offtake = csBase[stateProgram.csStatus] ?? 8
    if (stateProgram.csStatus === 'active' && stateProgram.capacityMW > 500) offtake += 8
    if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) offtake -= 10
    else if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 25) offtake -= 5
  }

  // ── IX sub-score (adjusted by ARCHITECTURE + optional live blend) ──
  // Curated baseline from stateProgram.ixDifficulty (covers all 50 states).
  ix = { easy: 88, moderate: 65, hard: 38, very_hard: 14 }[stateProgram.ixDifficulty] ?? 50
  if (isLegacyBess) ix += 5                           // legacy storage — faster IX studies
  else if (architecture === 'PV + Storage') ix -= 5  // combined resource — more complex IX
  // Live-blend: when ix_queue_data covers this state, layer the quantitative
  // queue-health signal on top. Top-CS-markets coverage as of 2026-04-30:
  // CO, IL, MA, MD, ME, MN, NJ, NY (~8 of 50). For the other 42, ixCoverage
  // stays 'curated' and the score is unchanged.
  ix += ixLiveAdjustment(ixQueueSummary)

  // ── Site sub-score (adjusted by tech type) ──
  // Three input layers, in priority order:
  //   1. Live geospatial (county_geospatial_data) — derived from NWI wetlands
  //      and SSURGO prime farmland. Covers all 50 states. Drives the score
  //      whenever present.
  //   2. Curated county_intelligence — qualitative booleans for ~18 states.
  //      Used as fallback when live geospatial is missing for this county.
  //   3. Hard-coded baseline (site = 60) — last resort when neither layer
  //      has data for the county.
  let availableLand = null
  let wetlandWarning = null
  if (hasLiveGeo) {
    // Calibrated 2026-05-01 from scripts/probe-geospatial.mjs:
    //   wetlandWarning = wetland_coverage_pct >= 15 (matches BUILD_LOG)
    //   availableLand  = prime_farmland_pct  <  25
    // NOTE (2026-06 data audit fix): `availableLand` means "favorable,
    // low-constraint land." HIGH prime-farmland coverage is a siting
    // CONSTRAINT (ag-conversion / FPPA review, ag-preservation ordinances,
    // community opposition), NOT an opportunity — so favorable = LOW farmland
    // (< 25%). This matches the SiteControlCard UI + glossary, which already
    // treat high farmland as a constraint; the prior `>= 25` mapping was
    // inverted and scored high-farmland counties as best-site.
    // wetland_coverage_pct can exceed 100% from NWI polygon overlap +
    // water inclusion; the >=15 threshold is unaffected.
    if (geo.wetlandCoveragePct != null) {
      wetlandWarning = geo.wetlandCoveragePct >= 15
    }
    if (geo.primeFarmlandPct != null) {
      availableLand = geo.primeFarmlandPct < 25
    }
    // Bridge: if one layer is missing from the live row, fill the gap from
    // curated where possible (e.g. SSURGO ingest done but NWI seed still
    // running for this county).
    if (wetlandWarning == null && countyData?.siteControl?.wetlandWarning != null) {
      wetlandWarning = countyData.siteControl.wetlandWarning
    }
    if (availableLand == null && countyData?.siteControl?.availableLand != null) {
      availableLand = countyData.siteControl.availableLand
    }
  } else if (countyData?.siteControl) {
    availableLand = countyData.siteControl.availableLand
    wetlandWarning = countyData.siteControl.wetlandWarning
  }

  // Flood (2026-06 Wave 3, third site constraint) — FEMA NRI county flood risk
  // RATING. 'relatively_high' | 'very_high' = flood-constrained (the disclosed
  // threshold; these two tokens must match _floodNri.isFloodConstrained, which the
  // ingest writes). null until the flood_nri ingest reaches this county →
  // computeSiteSubScore applies no penalty. (Was an NFHL SFHA-% threshold in the
  // slice-1 foundation; Aden chose the NRI county layer — cleaner, no GIS math.)
  let floodWarning = null
  if (geo?.floodRiskRating != null) {
    floodWarning = geo.floodRiskRating === 'relatively_high' || geo.floodRiskRating === 'very_high'
  }

  site = computeSiteSubScore(architecture, availableLand, wetlandWarning, floodWarning)

  // ── Stage modifiers ──
  const [dOft, dIX, dSite] = STAGE_MODIFIERS[stage] ?? [0, 0, 0]
  offtake = Math.max(0, Math.min(100, offtake + dOft))
  ix      = Math.max(0, Math.min(100, ix      + dIX))
  site    = Math.max(0, Math.min(100, site    + dSite))

  const techLabel = typeof technology === 'string' ? technology : composeTechnology(architecture, structure)

  // ── Incentives (Pillar 4 — ITC step-up eligibility) ──
  // opts.incentives = raw { energyCommunity, nmtcLic, hudQctDda } getter results.
  // Absent → score null → excluded from the composite (weights rebalance), so
  // surfaces that don't fetch county incentive data (Library/Compare) aren't
  // penalized with a fabricated baseline.
  const inc = computeIncentiveScore(opts.incentives, mw)
  const incentives = inc.score
  const incentivesCoverage = inc.coverage

  // ── Policy & Timing (Pillar 5) ──
  // Federal tax-credit TIMING risk (OBBBA §48E/§45Y · FEOC · safe harbor — a
  // pure rules engine over published law, keyed to stage + target COD) blended
  // with STATE policy headwind risk (severity × probability). No dollars. Each
  // component is included only when we have a basis for it; the pillar is null
  // (excluded) when we know neither timing nor any applicable policy.
  const federal = assessFederalTiming({ codYear: opts.codYear, stage, mwAc: mw })
  const haveTimingBasis = !!stage || opts.codYear != null
  const parts = []
  if (haveTimingBasis) parts.push(federal.score)
  let statePolicy = null
  if (Array.isArray(policyEvents) && policyEvents.length > 0) {
    statePolicy = computeStatePolicyRiskScore(policyEvents, { mw, stage, technology: techLabel, codYear: opts.codYear })
    if (statePolicy.applicableCount > 0) parts.push(statePolicy.score)
  }
  const policyTiming = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null
  const policyTimingCoverage = policyTiming != null ? 'live' : 'none'

  return {
    offtake, ix, site, incentives, policyTiming,
    // Rich detail for the new pillar cards (federal timing tier + reasons,
    // applicable state policy events with severity).
    incentiveDetail: inc.adders,
    policyDetail: { federal, statePolicy },
    coverage: {
      offtake: offtakeCoverage, ix: ixCoverage, site: siteCoverage,
      incentives: incentivesCoverage, policyTiming: policyTimingCoverage,
    },
  }
}

// ── Composite weights ────────────────────────────────────────────────────────
// Five-pillar weights (2026-05 pivot). Tractova-editorial (Tier C — there is no
// primary-source anchor for "how much should each pillar count" in CS
// underwriting); surfaced transparently via the weight-sensitivity range below
// (the Lens shows "Score 73 (range 67-78 across reasonable weight schemes)").
// computeDisplayScore REBALANCES over whichever pillars are present + finite, so
// a surface that hasn't fetched a pillar (e.g. a portfolio path without county
// incentive data) isn't penalized with a fabricated baseline — it scores on the
// pillars it has. If/when developer-survey or empirical IRR-vs-pillar data lands,
// replace WEIGHT_SCENARIOS with the empirical values.
//   Offtake (25) — revenue mechanism / program gate.
//   Interconnection (25) — the classic binary go/no-go (queue / cost / timeline).
//   Incentives (20) — post-OBBBA the ITC adder stack is make-or-break; real,
//     county-level eligibility (DOE NETL energy community / Census-CDFI NMTC / HUD).
//   Site (20) — real friction (land / wetland / farmland / zoning) but solvable.
//   Policy & Timing (10) — federal tax-credit cliffs (§48E/§45Y, FEOC, safe
//     harbor) keyed to COD/NTP + state policy headwind risk (severity tiers);
//     weighted lightest as the most situational / fastest-moving signal.
export const WEIGHT_SCENARIOS = {
  default:   { offtake: 0.25, ix: 0.25, incentives: 0.20, site: 0.20, policyTiming: 0.10, label: 'Default (balanced go/no-go)',
               rationale: 'Tractova default — offtake + interconnection lead as the classic gates, incentives weighted high post-OBBBA, site most solvable, policy & timing the acute regulatory risk.' },
  revenue:   { offtake: 0.35, ix: 0.20, incentives: 0.20, site: 0.10, policyTiming: 0.15, label: 'Offtake-tilt',
               rationale: 'For developers who view the monetization structure (program / PPA) as the dominant success predictor.' },
  ix:        { offtake: 0.20, ix: 0.35, incentives: 0.15, site: 0.15, policyTiming: 0.15, label: 'Interconnection-tilt',
               rationale: 'For long-queue ISO regions (PJM, MISO) where interconnection is the project killer.' },
  permit:    { offtake: 0.20, ix: 0.20, incentives: 0.15, site: 0.30, policyTiming: 0.15, label: 'Site / Permit-tilt',
               rationale: 'For permit-heavy markets (NJ farmland, MA wetlands) where site control dominates.' },
  incentive: { offtake: 0.20, ix: 0.20, incentives: 0.35, site: 0.10, policyTiming: 0.15, label: 'Incentive-tilt',
               rationale: 'For tax-equity-driven developers where ITC adder eligibility + federal timing make or break the deal.' },
}

const DEFAULT_WEIGHTS = WEIGHT_SCENARIOS.default
const PILLAR_KEYS = ['offtake', 'ix', 'site', 'incentives', 'policyTiming']

// Accept either a subs object {offtake,ix,site,incentives,policyTiming} (new)
// or legacy positional (offtake, ix, site). Returns { subs, weights }.
function resolveScoreArgs(a, b, c, d) {
  if (a && typeof a === 'object') {
    const w = b === undefined ? DEFAULT_WEIGHTS : b
    return { subs: a, weights: w }
  }
  const w = d === undefined ? DEFAULT_WEIGHTS : d
  return { subs: { offtake: a, ix: b, site: c }, weights: w }
}

/**
 * Weighted feasibility score. Blends whichever of the 5 pillars are present +
 * finite, REBALANCING the weights over them (a surface missing incentives /
 * policyTiming scores on the pillars it has — no fabricated baseline). Accepts
 * a subs object (preferred) or legacy positional (offtake, ix, site).
 *
 * @returns {number|null} rounded rebalanced weighted average (null if no pillars)
 */
export function computeDisplayScore(a, b, c, d) {
  const { subs, weights } = resolveScoreArgs(a, b, c, d)
  if (!weights || typeof weights !== 'object') return null
  let acc = 0, wsum = 0
  for (const k of PILLAR_KEYS) {
    if (Number.isFinite(subs?.[k]) && Number.isFinite(weights[k])) { acc += subs[k] * weights[k]; wsum += weights[k] }
  }
  if (wsum === 0) return null
  return Math.round(acc / wsum)
}

/**
 * Defensive boundary wrapper. Requires the three CORE pillars (offtake/ix/site)
 * finite; incentives + policyTiming are optional (rebalanced when absent).
 * Returns null on a broken weights object so a malformed shape can't NaN-poison
 * downstream aggregates (Portfolio Health etc.).
 *
 * @returns {number|null}
 */
export function safeScore(a, b, c, d) {
  const { subs, weights } = resolveScoreArgs(a, b, c, d)
  if (!weights || typeof weights !== 'object'
      || !Number.isFinite(weights.offtake) || !Number.isFinite(weights.ix) || !Number.isFinite(weights.site)) return null
  if (!Number.isFinite(subs?.offtake) || !Number.isFinite(subs?.ix) || !Number.isFinite(subs?.site)) return null
  const result = computeDisplayScore(subs, weights)
  return Number.isFinite(result) ? result : null
}

/**
 * Score under each WEIGHT_SCENARIOS so the UI can show methodology sensitivity.
 * A wide spread = the verdict depends on weight choice. Accepts a subs object
 * or legacy positional (offtake, ix, site).
 */
export function computeDisplayScoreRange(a, b, c) {
  const subs = (a && typeof a === 'object') ? a : { offtake: a, ix: b, site: c }
  const scenarios = {}
  let min = Infinity, max = -Infinity
  for (const [k, w] of Object.entries(WEIGHT_SCENARIOS)) {
    const s = computeDisplayScore(subs, w)
    scenarios[k] = { score: s, label: w.label, rationale: w.rationale, weights: { offtake: w.offtake, ix: w.ix, site: w.site, incentives: w.incentives, policyTiming: w.policyTiming } }
    if (s != null && s < min) min = s
    if (s != null && s > max) max = s
  }
  return {
    default: scenarios.default.score,
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    spread: (Number.isFinite(min) && Number.isFinite(max)) ? max - min : 0,
    scenarios,
  }
}

// ── scoreSavedProject ─────────────────────────────────────────────────────────
// THE canonical way to score a SAVED project (Library card/table/board/map,
// Compare, Portfolio, export). It threads the SAME inputs the Lens uses
// (src/pages/Search.jsx computeSubScores call) so the identical project yields
// the identical 5-pillar Feasibility Index on every surface — ending the
// per-call-site argument drift the 2026-06 data audit found (8+ sites each
// passed a different arg set, so the same project scored differently on the
// card vs table vs Lens).
//
// Full Lens parity: pass opts.incentives ({ energyCommunity, nmtcLic,
// hudQctDda }), opts.policyEvents (state events), and opts.ixQueueSummary when
// the container has fetched them. Omit any and computeDisplayScore rebalances
// over the pillars present — an honest reduced score, never a fabricated
// baseline (scoreEngine rebalance, computeDisplayScore). codYear comes off the
// normalized project (normalizeProject surfaces it as `codTargetYear`).
//
// @param {object} project — normalized project (mw, stage, technology, codTargetYear)
// @param {object} stateProgram — stateProgramMap[project.state]
// @param {object|null} countyData — countyDataMap[`${state}::${county}`]
// @param {object} opts — { incentives?, policyEvents?, ixQueueSummary? }
// @returns {{ subs: object|null, score: number|null }}
export function scoreSavedProject(project, stateProgram, countyData = null, opts = {}) {
  if (!project || !stateProgram) return { subs: null, score: null }
  const subs = computeSubScores(
    stateProgram,
    countyData,
    project.stage,
    project.technology,
    opts.ixQueueSummary ?? null,
    opts.policyEvents ?? null,
    parseFloat(project.mw) || null,
    { incentives: opts.incentives, codYear: project.codTargetYear ?? null },
  )
  return { subs, score: safeScore(subs) }
}

// ── scoreProjectFromMaps ───────────────────────────────────────────────────────
// Library-surface convenience over scoreSavedProject: every Library view holds
// the same four lookup maps (state programs, county geospatial, county-level ITC
// incentive eligibility, per-state policy events). This resolves a project's row
// out of those maps using the canonical `${state}::${county}` / `${state}` keys
// and delegates to scoreSavedProject, so the card, table, board, map, sort, and
// export all read ONE arg-resolution path. A map being empty (`{}`) yields a
// null pillar → computeDisplayScore rebalances it out (honest reduced score, not
// a fabricated baseline) — the same lazy-population pattern as countyDataMap.
//
// @param {object} project — normalized project (state, county, stage, technology, mw, codTargetYear)
// @param {{stateProgramMap?, countyDataMap?, incentivesMap?, policyEventsMap?}} maps
// @returns {{ subs: object|null, score: number|null }}
export function scoreProjectFromMaps(project, maps = {}) {
  const { stateProgramMap, countyDataMap, incentivesMap, policyEventsMap } = maps
  const sp = stateProgramMap?.[project.state]
  if (!sp) return { subs: null, score: null }
  const key = `${project.state}::${project.county}`
  return scoreSavedProject(project, sp, countyDataMap?.[key] || null, {
    incentives:   incentivesMap?.[key] || null,
    policyEvents: policyEventsMap?.[project.state] || null,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio-level helpers — used by Library + Profile to score a set of saved
// projects and roll them up into a single MW-weighted health number.
//
// Both surfaces previously inlined identical `scored = projects.map(...)` and
// near-identical (but subtly divergent) healthScore computations. Profile
// silently skipped the `Number.isFinite` filter and the divide-by-zero guard,
// which meant a project with a null score (state hydrating, score column
// genuinely missing) would NaN-poison the Profile gauge while the Library
// gauge correctly fell back to 0. Unifying here means both surfaces inherit
// the same guards and the same answer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Annotate each project with a `score` via the canonical scoreSavedProject
 * path, so a portfolio rollup scores each project exactly as its Library card
 * does. Projects whose state isn't in the program map get score=0 (treated as
 * "no data" rather than NaN-poisoning the weighted average upstream).
 *
 * Pass `opts` maps to reach full 5-pillar parity: `countyDataMap` (site),
 * `incentivesMap` (ITC adders), `policyEventsMap` (state policy). Any map
 * omitted → that pillar rebalances out (honest reduced score). The portfolio
 * path previously read `p.cod_target_year` (raw), which is undefined on a
 * normalized project — routing through scoreSavedProject (reads `codTargetYear`)
 * fixes that silently-dropped Policy & Timing input too.
 *
 * @param {Array} projects — normalized project rows
 * @param {object} stateProgramMap — keyed by state id
 * @param {{countyDataMap?, incentivesMap?, policyEventsMap?}} [opts]
 */
export function scoreProjects(projects, stateProgramMap, opts = {}) {
  if (!Array.isArray(projects)) return []
  const { countyDataMap = null, incentivesMap = null, policyEventsMap = null } = opts
  return projects.map(p => {
    const sp = stateProgramMap?.[p.state]
    if (!sp) return { ...p, score: 0 }
    const key = `${p.state}::${p.county}`
    const { score } = scoreSavedProject(p, sp, countyDataMap?.[key] || null, {
      incentives:   incentivesMap?.[key] || null,
      policyEvents: policyEventsMap?.[p.state] || null,
    })
    return { ...p, score }
  })
}

/**
 * MW-weighted average score across a portfolio. Filters out non-finite scores
 * (null from safeScore, or stale data) and guards divide-by-zero when every
 * project has 0 MW. Falls back to 0 when nothing valid remains so the gauge
 * always renders a number, never "NaN".
 */
export function computePortfolioHealth(scored) {
  if (!Array.isArray(scored) || !scored.length) return 0
  const valid = scored.filter(p => Number.isFinite(p.score))
  if (!valid.length) return 0
  const totalMW = valid.reduce((s, p) => s + (parseFloat(p.mw) || 1), 0)
  if (totalMW === 0) return 0
  const weighted = valid.reduce((s, p) => s + ((parseFloat(p.mw) || 1) * p.score), 0)
  return Math.round(weighted / totalMW)
}
