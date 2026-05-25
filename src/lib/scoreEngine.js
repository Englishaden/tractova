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
// CA — Net Billing Tariff (NEM 3.0), effective 2023-04-15: exports valued at the
//   CPUC Avoided Cost Calculator (ACC), ~8-9¢/kWh vs ~30-44¢/kWh retail → roughly
//   0.20-0.27 of retail. Using 0.23 (CA-IOU approximation). Sources: Aurora Solar
//   NBT analysis (SDG&E Aug example: 8.8¢ export vs 44¢ grid) · PV Magazine (avg
//   ~30¢→~8¢, ~75% cut vs NEM 2.0). [verified via WebFetch 2026-05-25]
const NET_BILLING_EXPORT_RATIO = {
  CA: 0.23,
}

// Sorted state lists for user-facing "coverage" messaging. Kept here so the
// scoring engine is a single source of truth — the Lens UI reads these via
// getOfftakeCoverageStates() to render the "limited coverage" caption.
export const CI_OFFTAKE_COVERAGE = Object.keys(CI_OFFTAKE_SCORES).sort()
export const BESS_OFFTAKE_COVERAGE = Object.keys(BESS_OFFTAKE_SCORES).sort()
export const NET_BILLING_OFFTAKE_COVERAGE = Object.keys(NET_BILLING_EXPORT_RATIO).sort()

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
export function computeIncentiveScore(incentives) {
  if (!incentives) return { score: null, coverage: 'none', adders: {} }
  const { energyCommunity, nmtcLic, hudQctDda } = incentives
  const hasCoverage = energyCommunity != null || nmtcLic != null || hudQctDda != null
  if (!hasCoverage) return { score: null, coverage: 'none', adders: {} }

  const ec = !!(energyCommunity && energyCommunity.isEnergyCommunity)
  const nmtc = !!(nmtcLic && nmtcLic.isEligible)
  const hud = !!(hudQctDda && (hudQctDda.qctCount > 0 || hudQctDda.isNonMetroDda))
  const lic = nmtc || hud   // §48(e) Low-Income Community bonus via either pathway

  // 50 = base §48E (30% with PW&A), no location bonus. +25 Energy Community,
  // +25 Low-Income Community → up to 100 (full adder stack, potential ~50% ITC).
  const score = 50 + (ec ? 25 : 0) + (lic ? 25 : 0)
  return { score, coverage: 'live', adders: { energyCommunity: ec, lowIncomeCommunity: lic, nmtc, hudQctDda: hud } }
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
function computeSiteSubScore(architecture, availableLand, wetlandWarning) {
  if (architecture === 'Standalone BESS') {
    // Legacy standalone BESS depends primarily on wetland permitting, not land
    // area (1-2 acres/MW vs solar's 5-7).
    if (wetlandWarning === false) return 78
    if (wetlandWarning === true)  return 58
    return 68  // wetland unknown — midpoint of (78, 58)
  }
  // Solar (Standalone PV / PV + Storage) — footprint dominated by the PV array.
  const land = availableLand
  const wet  = wetlandWarning
  if (land === true  && wet === false) return 82
  if (land === true  && wet === true)  return 56
  if (land === false && wet === false) return 42
  if (land === false && wet === true)  return 26
  // Partial-input midpoints
  if (land === true  && wet == null)   return 69  // (82+56)/2
  if (land === false && wet == null)   return 34  // (42+26)/2
  if (land == null   && wet === false) return 62  // (82+42)/2
  if (land == null   && wet === true)  return 41  // (56+26)/2
  // Both null — no info, neutral baseline
  return 60
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
  //                  SSURGO prime farmland) — covers all 3,142 counties /
  //                  50 states once Path B ingest completes.
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
    // Net metering credits exports at the FULL retail rate, so its offtake value
    // tracks the same retail-rate signal as C&I — reuse that curated anchor (EIA
    // Form 861). 'researched' where curated; the UI discloses net_metering_status
    // (expose + disclose) rather than gating on per-state NM availability.
    if (CI_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    offtake = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
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
    //   availableLand  = prime_farmland_pct  >= 25 (matches BUILD_LOG)
    // wetland_coverage_pct can exceed 100% from NWI polygon overlap +
    // water inclusion; the >=15 threshold is unaffected.
    if (geo.wetlandCoveragePct != null) {
      wetlandWarning = geo.wetlandCoveragePct >= 15
    }
    if (geo.primeFarmlandPct != null) {
      availableLand = geo.primeFarmlandPct >= 25
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

  site = computeSiteSubScore(architecture, availableLand, wetlandWarning)

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
  const inc = computeIncentiveScore(opts.incentives)
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
// Default weights for the headline Feasibility Index: offtake 40%, IX 35%,
// site 25%. THESE ARE TRACTOVA EDITORIAL — there is no primary-source
// citation for "how much should offtake matter vs IX vs site" in CS project
// underwriting. The choice reflects product judgment:
//   - Offtake (40%): the revenue mechanism. If the program is closed or
//     CS rates are low, the project doesn't pencil regardless of other inputs.
//   - IX (35%): typically the binary go/no-go gate. Long studies + huge
//     upgrade costs kill projects mid-development.
//   - Site (25%): more solvable than IX/offtake — wetlands and farmland are
//     real friction but most CS projects find a workable parcel.
//
// Audit 2026-05-04 acknowledged this is editorial. To make it transparent
// we expose alternate weight scenarios + a range computation so the Lens UI
// can show "Score 73 (range 67-78 across reasonable weight schemes)" letting
// users see how sensitive their project's score is to the methodology choice.
//
// If/when we get developer-survey or empirical IRR-vs-pillar data that would
// anchor these weights, replace WEIGHT_SCENARIOS with the empirical values.
// Five-pillar weights (2026-05 pivot). Tractova-editorial (Tier C — no primary
// anchor for "how much should each pillar count"); surfaced transparently via
// the weight-sensitivity range below. computeDisplayScore REBALANCES over
// whichever pillars are present + finite, so a surface that hasn't fetched a
// pillar (e.g. Library lacks county incentive data) isn't penalized with a
// fabricated baseline — it scores on the pillars it has.
//   Offtake (25) — revenue mechanism / program gate.
//   Interconnection (25) — the classic binary go/no-go (queue / cost / timeline).
//   Incentives (20) — post-OBBBA the ITC adder stack is make-or-break; real,
//     county-level eligibility (EPA energy community / Census-CDFI NMTC / HUD).
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
 * Annotate each project with a `score` derived from the curated state program
 * + the project's stage / technology. Projects whose state isn't in the
 * program map get score=0 (treated as "no data" rather than NaN-poisoning the
 * weighted average upstream).
 */
export function scoreProjects(projects, stateProgramMap, policyEventsByState = null) {
  if (!Array.isArray(projects)) return []
  return projects.map(p => {
    const sp = stateProgramMap?.[p.state]
    if (!sp) return { ...p, score: 0 }
    const policies = policyEventsByState?.[p.state] || null
    // Pass codYear so the Policy & Timing pillar (federal tax-credit cliff) is
    // included for saved projects. Incentives stays excluded here (no county
    // incentive fetch in the portfolio path) → rebalanced out of the composite.
    const subs = computeSubScores(sp, null, p.stage, p.technology, null, policies, p.mw, { codYear: p.cod_target_year })
    return { ...p, score: safeScore(subs) }
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
