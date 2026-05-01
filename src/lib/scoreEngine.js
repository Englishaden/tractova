export const STAGE_MODIFIERS = {
  'Prospecting':              [  0,   0,   0 ],
  'Site Control':             [  0, +10, +15 ],
  'Pre-Development':          [  0,   0, +20 ],
  'Development':              [ +5,   0, +25 ],
  'NTP (Notice to Proceed)':  [ +8,  -5, +25 ],
  'Construction':             [+10,  -8, +25 ],
  'Operational':              [+10, +10, +25 ],
}

// Retail rate tiers for C&I offtake scoring (higher rates = better C&I economics)
const CI_OFFTAKE_SCORES = {
  NY: 82, MA: 85, NJ: 78, CT: 80,  // High-rate states
  IL: 65, MD: 64, CO: 60, ME: 68,  // Medium-rate states
  MN: 55, VA: 58, OR: 56, WA: 52,  // Lower-rate states
}

// ISO capacity market tiers for BESS offtake scoring
const BESS_OFFTAKE_SCORES = {
  MA: 80, ME: 78,                   // ISO-NE
  IL: 75, NJ: 75, MD: 70,          // PJM
  NY: 72,                           // NYISO
  MN: 55, CO: 50,                   // MISO / SPP
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
  // Site coverage is fallback when countyData (or its siteControl block) is
  // missing — only ~18 states currently have county_intelligence rows seeded,
  // so for the other 32 the "site = 60" line below is a placeholder.
  const siteCoverage = countyData?.siteControl ? 'researched' : 'fallback'
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
  site = 60
  if (countyData?.siteControl) {
    const { availableLand, wetlandWarning } = countyData.siteControl
    if (technology === 'BESS') {
      // BESS needs much less land (1-2 acres/MW vs 5-7 for solar)
      if (!wetlandWarning) site = 78
      else site = 58
    } else {
      if (availableLand && !wetlandWarning)  site = 82
      else if (availableLand && wetlandWarning)  site = 56
      else if (!availableLand && !wetlandWarning) site = 42
      else site = 26
    }
  }

  // ── Stage modifiers ──
  const [dOft, dIX, dSite] = STAGE_MODIFIERS[stage] ?? [0, 0, 0]
  offtake = Math.max(0, Math.min(100, offtake + dOft))
  ix      = Math.max(0, Math.min(100, ix      + dIX))
  site    = Math.max(0, Math.min(100, site    + dSite))

  return { offtake, ix, site, coverage: { offtake: offtakeCoverage, ix: ixCoverage, site: siteCoverage } }
}

export function computeDisplayScore(offtake, ix, site) {
  return Math.round(offtake * 0.40 + ix * 0.35 + site * 0.25)
}
