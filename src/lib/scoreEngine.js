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

// Sorted state lists for user-facing "coverage" messaging. Kept here so the
// scoring engine is a single source of truth — the Lens UI reads these via
// getOfftakeCoverageStates() to render the "limited coverage" caption.
export const CI_OFFTAKE_COVERAGE = Object.keys(CI_OFFTAKE_SCORES).sort()
export const BESS_OFFTAKE_COVERAGE = Object.keys(BESS_OFFTAKE_SCORES).sort()

export function getOfftakeCoverageStates(technology) {
  if (technology === 'C&I Solar') return CI_OFFTAKE_COVERAGE
  if (technology === 'BESS' || technology === 'Hybrid') return BESS_OFFTAKE_COVERAGE
  return null
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
function computeSiteSubScore(technology, availableLand, wetlandWarning) {
  if (technology === 'BESS') {
    // BESS depends primarily on wetland permitting, not land area
    // (1-2 acres/MW vs solar's 5-7).
    if (wetlandWarning === false) return 78
    if (wetlandWarning === true)  return 58
    return 68  // wetland unknown — midpoint of (78, 58)
  }
  // Solar (CS / C&I / Hybrid)
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

export function computeSubScores(stateProgram, countyData, stage = '', technology = 'Community Solar', ixQueueSummary = null) {
  if (!stateProgram) return { offtake: 0, ix: 0, site: 0, coverage: { offtake: 'researched', ix: 'curated', site: 'researched' } }

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

  // ── Offtake sub-score (varies by tech type) ──
  if (technology === 'C&I Solar') {
    if (CI_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    offtake = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
  } else if (technology === 'BESS') {
    if (BESS_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    offtake = BESS_OFFTAKE_SCORES[stateProgram.id] ?? 45
  } else if (technology === 'Hybrid') {
    const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
    const csOfftake = csBase[stateProgram.csStatus] ?? 8
    if (BESS_OFFTAKE_SCORES[stateProgram.id] == null) offtakeCoverage = 'fallback'
    const bessOfftake = BESS_OFFTAKE_SCORES[stateProgram.id] ?? 45
    offtake = Math.min(85, Math.round((csOfftake + bessOfftake) / 2))
  } else {
    // Community Solar (default) — driven entirely by state_programs DB,
    // which has all 50 states curated, so coverage stays 'researched'.
    const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
    offtake = csBase[stateProgram.csStatus] ?? 8
    if (stateProgram.csStatus === 'active' && stateProgram.capacityMW > 500) offtake += 8
    if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) offtake -= 10
    else if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 25) offtake -= 5
  }

  // ── IX sub-score (adjusted by tech type + optional live blend) ──
  // Curated baseline from stateProgram.ixDifficulty (covers all 50 states).
  ix = { easy: 88, moderate: 65, hard: 38, very_hard: 14 }[stateProgram.ixDifficulty] ?? 50
  if (technology === 'BESS') ix += 5          // Storage typically has faster IX studies
  else if (technology === 'Hybrid') ix -= 5   // Combined resources = more complex IX
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

  site = computeSiteSubScore(technology, availableLand, wetlandWarning)

  // ── Stage modifiers ──
  const [dOft, dIX, dSite] = STAGE_MODIFIERS[stage] ?? [0, 0, 0]
  offtake = Math.max(0, Math.min(100, offtake + dOft))
  ix      = Math.max(0, Math.min(100, ix      + dIX))
  site    = Math.max(0, Math.min(100, site    + dSite))

  return { offtake, ix, site, coverage: { offtake: offtakeCoverage, ix: ixCoverage, site: siteCoverage } }
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
export const WEIGHT_SCENARIOS = {
  default:    { offtake: 0.40, ix: 0.35, site: 0.25, label: 'Default (offtake-led)',
                rationale: 'Tractova default — offtake gets highest weight as the revenue mechanism, IX second as the binary go/no-go gate, site third as the most solvable.' },
  revenue:    { offtake: 0.50, ix: 0.30, site: 0.20, label: 'Revenue-tilt',
                rationale: 'For developers who view CS programs (REC value, capacity availability) as the dominant project-success predictor.' },
  ix:         { offtake: 0.30, ix: 0.40, site: 0.30, label: 'IX-tilt',
                rationale: 'For developers in long-queue ISO regions (PJM, MISO) where interconnection delays are the project killer.' },
  permit:     { offtake: 0.30, ix: 0.30, site: 0.40, label: 'Permit-tilt',
                rationale: 'For developers in permit-heavy markets (NJ farmland, MA wetlands) where site control is the dominant friction.' },
}

const DEFAULT_WEIGHTS = WEIGHT_SCENARIOS.default

export function computeDisplayScore(offtake, ix, site, weights = DEFAULT_WEIGHTS) {
  return Math.round(offtake * weights.offtake + ix * weights.ix + site * weights.site)
}

// 2026-05-05 (C4 fix): defensive wrapper. If any sub-score is non-numeric
// (null / undefined / NaN — e.g., partial data, computeSubScores returned
// fallback shape), returns null instead of NaN. Consumers can render '—'.
//
// Earlier this session a Library.jsx bug spread `coverage` (a string-keyed
// object) as `weights` into computeDisplayScore, producing NaN that
// poisoned every downstream aggregate (Portfolio Health, Geographic
// Spread). The destructure was fixed at the source but defense-in-depth
// here means future bugs of the same shape can't re-poison.
//
// Use safeScore in EVERY consumer that displays the result; reserve
// computeDisplayScore for internal score math where you know all 3 inputs
// are valid finite numbers.
export function safeScore(offtake, ix, site, weights = DEFAULT_WEIGHTS) {
  if (!Number.isFinite(offtake) || !Number.isFinite(ix) || !Number.isFinite(site)) return null
  if (!weights || !Number.isFinite(weights.offtake) || !Number.isFinite(weights.ix) || !Number.isFinite(weights.site)) return null
  const result = computeDisplayScore(offtake, ix, site, weights)
  return Number.isFinite(result) ? result : null
}

// Returns { default, min, max, scenarios } showing the score under each of
// the WEIGHT_SCENARIOS so users can see methodology sensitivity. If the
// range is wide (e.g., 15+ pts), the project's verdict is sensitive to
// methodology choice and worth flagging in the UI.
export function computeDisplayScoreRange(offtake, ix, site) {
  const scenarios = {}
  let min = Infinity, max = -Infinity
  for (const [k, w] of Object.entries(WEIGHT_SCENARIOS)) {
    const s = computeDisplayScore(offtake, ix, site, w)
    scenarios[k] = { score: s, label: w.label, rationale: w.rationale, weights: { offtake: w.offtake, ix: w.ix, site: w.site } }
    if (s < min) min = s
    if (s > max) max = s
  }
  return {
    default: scenarios.default.score,
    min,
    max,
    spread: max - min,
    scenarios,
  }
}
