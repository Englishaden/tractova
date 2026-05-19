// Lever adjustments — bounded post-processing layer on top of computeSubScores
// that lets the Dev Feasibility "Feasibility Levers" (Subscription %, COD year,
// IX Assumption) shift pillar sub-scores so users can proxy rational scenario
// changes against the composite score.
//
// Design discipline mirrors STAGE_MODIFIERS + ixLiveAdjustment in scoreEngine.js:
//   - Small, bounded deltas (per-pillar ±10 clamp).
//   - Categorical OR threshold-tiered → fixed-point delta.
//   - Stacks across multiple levers, total clamped per pillar.
//   - Pure function — no I/O.
//   - Returns rationale rows so the UI can list which levers fired.
//
// Math is EDITORIAL — disclosed via the verdict tile tooltip in
// DevFeasibilityView. Not empirically calibrated; calibrate against
// observed dev outcomes when that data becomes available.
//
// Important: this DOES NOT modify the structural baseline. The §04 Pillar
// Diagnostics cards on the Lens header (OfftakeCard, InterconnectionCard,
// SiteControlCard) read the unadjusted scores. Only the Dev Feasibility
// view's verdict + pillar readouts reflect lever adjustments. Disclosure
// to users: "Reflects Dev Feasibility levers — structural baseline shown
// in Lens header gauge."

const PER_PILLAR_DELTA_CAP = 10

// Subscription % → offtake delta (CS / Hybrid only — subscription is a CS
// program structure, not a C&I or BESS concept). Threshold-tiered around
// the 80% editorial baseline. Capped ±5 since subscription is the user's
// projection (not market-observed data).
function subscriptionDelta(subscriptionPct, technology) {
  const isCS = technology === 'Community Solar' || technology === 'Hybrid'
  if (!isCS) return { delta: 0, label: null }

  const pct = Number(subscriptionPct)
  if (!Number.isFinite(pct)) return { delta: 0, label: null }

  if (pct < 50)  return { delta: -5, label: `${Math.round(pct)}% subscription — project may not pencil` }
  if (pct < 70)  return { delta: -2, label: `${Math.round(pct)}% subscription — below typical fill rate` }
  if (pct < 90)  return { delta:  0, label: null }
  return { delta: +3, label: `${Math.round(pct)}% subscription — anchor offtaker / CCA confidence` }
}

// COD year + observed IX queue depth → IX delta. The math: if the time
// budget between COD and today is less than (avgStudyMonths + 12-month
// permit/construction buffer), the timeline is structurally tight — dock
// IX. If COD is ≥3 years out and study window is heavy, give a modest
// buffer bonus.
//
// Falls back to 0 when live IX data isn't wired for the state.
function codTimelineDelta(codYear, avgStudyMonths) {
  const year = Number(codYear)
  const months = Number(avgStudyMonths)
  if (!Number.isFinite(year) || !Number.isFinite(months) || months <= 0) {
    return { delta: 0, label: null }
  }

  // Anchor "today" to 2026 — matches the COD year options surfaced in the UI.
  // When this code is read in 2028 and beyond, swap to a runtime year source.
  const currentYear = 2026
  const monthsToCOD = (year - currentYear) * 12
  const requiredMonths = months + 12  // study + permit/construction buffer

  if (monthsToCOD < requiredMonths) {
    return { delta: -8, label: `COD ${year} tight vs ${months}-mo IX study + 12-mo permit/construction window` }
  }
  if ((year - currentYear) >= 3 && months >= 18) {
    return { delta: +3, label: `COD ${year} gives ample buffer to clear ${months}-mo queue` }
  }
  return { delta: 0, label: null }
}

// IX assumption (greenfield queue / acquire mid-queue / distribution fast-
// track) → IX delta. Stacks with codTimelineDelta; combined IX delta still
// clamped at ±10 per the cap convention shared with ixLiveAdjustment.
function ixAssumptionDelta(ixAssumption) {
  switch (ixAssumption) {
    case 'queue':
      return { delta: 0, label: null }
    case 'acquire':
      return { delta: +6, label: 'Acquired queue position — skips ~50% of study wait' }
    case 'distribution':
      return { delta: +10, label: 'Distribution fast-track — bypasses transmission queue (project ≤2 MW)' }
    default:
      return { delta: 0, label: null }
  }
}

function clampPillar(value) {
  if (!Number.isFinite(value)) return value
  if (value > PER_PILLAR_DELTA_CAP) return PER_PILLAR_DELTA_CAP
  if (value < -PER_PILLAR_DELTA_CAP) return -PER_PILLAR_DELTA_CAP
  return value
}

function clampScore(value) {
  if (!Number.isFinite(value)) return value
  if (value > 100) return 100
  if (value < 0) return 0
  return value
}

/**
 * Apply user-controlled lever adjustments to the structural sub-scores.
 *
 * @param {{offtake:number, ix:number, site:number, policyClimate:number|null, coverage:object}} subScores
 * @param {{subscriptionPct:number, codYear:number, ixAssumption:string}} levers
 * @param {{technology:string, ixQueueSummary:object|null}} context
 * @returns {{
 *   adjusted: {offtake:number, ix:number, site:number, policyClimate:number|null, coverage:object},
 *   deltas:   {offtake:number, ix:number, site:number},
 *   rationale: Array<{pillar:string, lever:string, delta:number, label:string}>,
 * }}
 */
export function applyLeverAdjustments(subScores, levers, context = {}) {
  if (!subScores) {
    return {
      adjusted: subScores,
      deltas: { offtake: 0, ix: 0, site: 0 },
      rationale: [],
    }
  }

  const rationale = []

  // Offtake levers
  const sub = subscriptionDelta(levers?.subscriptionPct, context?.technology)
  if (sub.delta !== 0 && sub.label) {
    rationale.push({ pillar: 'Offtake', lever: 'subscription', delta: sub.delta, label: sub.label })
  }
  const offtakeDelta = clampPillar(sub.delta)

  // IX levers — both COD and IX assumption stack
  const codDelta = codTimelineDelta(levers?.codYear, context?.ixQueueSummary?.avgStudyMonths)
  if (codDelta.delta !== 0 && codDelta.label) {
    rationale.push({ pillar: 'IX', lever: 'codYear', delta: codDelta.delta, label: codDelta.label })
  }
  const ixAssump = ixAssumptionDelta(levers?.ixAssumption)
  if (ixAssump.delta !== 0 && ixAssump.label) {
    rationale.push({ pillar: 'IX', lever: 'ixAssumption', delta: ixAssump.delta, label: ixAssump.label })
  }
  const ixDelta = clampPillar(codDelta.delta + ixAssump.delta)

  // Site levers — none today; reserved for future expansion
  const siteDelta = 0

  return {
    adjusted: {
      offtake: clampScore((subScores.offtake ?? 0) + offtakeDelta),
      ix:      clampScore((subScores.ix ?? 0) + ixDelta),
      site:    clampScore((subScores.site ?? 0) + siteDelta),
      policyClimate: subScores.policyClimate,
      coverage: subScores.coverage,
    },
    deltas: {
      offtake: offtakeDelta,
      ix:      ixDelta,
      site:    siteDelta,
    },
    rationale,
  }
}
