// Policy Impact Ecosystem — converts policy_impact_events rows into the
// Policy & Timing pillar's severity-based RISK score.
//
// Pure functions only. No I/O — callers fetch policy_impact_events rows via
// programData.getPolicyImpactEvents() and pass them in.
//
// The synthesized-$ layer (convertPolicyToInputDeltas / aggregatePolicyDeltas /
// applyDeltasToInputs / computePolicyAdjustments / computePolicyClimateScore)
// was removed in the 2026-05 signal pivot — policy is now scored as
// SEVERITY × PROBABILITY, never as IRR-bps or dollar deltas.
//
// Discipline:
//   - HONEST DATA: only impact_confidence='high' rows move the score.
//   - APPLICABILITY RESPECTED: stage flags, MW bands, tech filters applied
//     before scoring. A 2 MW project doesn't get hit by the 3-5 MW tier's fee.
//   - NO STATE-NAME HARDCODING anywhere.

// ── Shape normalization ─────────────────────────────────────────────────
// Policy event rows reach this engine in TWO shapes:
//   - snake_case — raw Supabase rows (server-side: api/lens-insight folds
//     published rows into the AI prompt).
//   - camelCase  — programData.getPolicyImpactEvents() (client-side: the Lens
//     passes results.policyEvents into computeSubScores).
// The engine reads snake_case throughout, so a camelCase object would have
// every gate field read as undefined → silently filtered out (the Policy &
// Timing pillar would never see state policy). Coerce camelCase → snake_case
// at the single choke point (filterApplicablePolicies) so both callers score
// identically. Snake_case rows pass through untouched.
function normalizePolicyEvent(p) {
  if (!p || 'impact_confidence' in p) return p   // already snake_case (or null)
  return {
    ...p,
    id:                            p.id,
    event_name:                    p.eventName,
    pillar:                        p.pillar,
    impact_confidence:             p.impactConfidence,
    impact_severity:               p.impactSeverity,
    impact_probability:            p.impactProbability,
    irr_impact_bps:                p.irrImpactBps,
    is_active:                     p.isActive,
    review_status:                 p.reviewStatus,
    min_mw_ac:                     p.minMwAc,
    max_mw_ac:                     p.maxMwAc,
    applicable_technologies:       p.applicableTechnologies,
    applies_to_new_applications:   p.appliesToNewApplications,
    applies_to_existing_queue:     p.appliesToExistingQueue,
    applies_to_operating_projects: p.appliesToOperatingProjects,
    safe_harbor_eligible:          p.safeHarborEligible,
    safe_harbor_cutoff_date:       p.safeHarborCutoffDate,
    source_url:                    p.sourceUrl,
    effective_date:                p.effectiveDate,
  }
}

// ── Applicability: stage → boolean-flag-applicability mapping ──────────
// Maps project stage to which applicability flag must be set for the
// policy to apply. Each stage is treated as the developer's decision
// horizon — Prospecting/Site Control/Pre-Dev are "new applications"
// territory; Development/NTP straddle queue + operating; Construction/
// Operational hit operating projects.
const STAGE_APPLICABILITY = {
  'Prospecting':       'applies_to_new_applications',
  'Site Control':      'applies_to_new_applications',
  'Pre-Development':   'applies_to_new_applications',
  'Development':       'applies_to_existing_queue',
  'NTP':               'applies_to_existing_queue',
  'Construction':      'applies_to_operating_projects',
  'Operational':       'applies_to_operating_projects',
}

// Default to new_applications when stage is unknown — most runs are
// forward-looking prospecting/site-control evaluations.
const DEFAULT_APPLICABILITY_FLAG = 'applies_to_new_applications'

/**
 * Returns the subset of policies that apply to a given project.
 * Hard rules:
 *   - confidence === 'high'   (gate for moving the score)
 *   - is_active === true
 *   - review_status === 'published'
 *   - MW within [min_mw_ac, max_mw_ac] band (null = unbounded)
 *   - technology in applicable_technologies (null = all techs)
 *   - applicability flag matches project stage
 *
 * Accepts rows in either snake_case (server) or camelCase (client) shape —
 * normalized to snake_case here so every downstream consumer is uniform.
 *
 * @param {Array} rawPolicies — rows from policy_impact_events
 * @param {{mw: number, stage: string, technology: string}} project
 * @returns {Array} filtered + normalized policies
 */
export function filterApplicablePolicies(rawPolicies, { mw, stage, technology } = {}) {
  if (!Array.isArray(rawPolicies) || rawPolicies.length === 0) return []
  // Coerce camelCase (client) → snake_case (engine) before any field reads,
  // so the returned rows are uniform for every downstream consumer.
  const policies = rawPolicies.map(normalizePolicyEvent)
  const hasMw = mw != null && Number.isFinite(Number(mw)) && Number(mw) > 0
  const mwNum = hasMw ? Number(mw) : null
  // When stage is null, accept policies with ANY applicability flag set
  // (state-level scoring context — e.g. the map view).
  const flag = stage ? (STAGE_APPLICABILITY[stage] || DEFAULT_APPLICABILITY_FLAG) : null

  return policies.filter(p => {
    if (!p) return false
    if (p.impact_confidence !== 'high') return false
    if (p.is_active === false) return false
    if (p.review_status && p.review_status !== 'published') return false

    // MW band (skip filter when mw not provided — state-level context).
    if (hasMw) {
      if (p.min_mw_ac != null && mwNum < p.min_mw_ac) return false
      if (p.max_mw_ac != null && mwNum >= p.max_mw_ac) return false
    }

    // Technology filter (null array = applies to all techs; skip when
    // technology not provided).
    if (technology && Array.isArray(p.applicable_technologies) && p.applicable_technologies.length > 0) {
      if (!p.applicable_technologies.includes(technology)) return false
    }

    // Stage filter via applicability flag. When no stage given, accept
    // policies whose ANY applicability flag is true.
    if (flag) {
      if (!p[flag]) return false
    } else {
      if (!p.applies_to_new_applications && !p.applies_to_existing_queue && !p.applies_to_operating_projects) return false
    }

    return true
  })
}

// ── Severity-based policy RISK score (Pillar 5 — Policy & Timing) ────────────
// Policy is scored as SEVERITY tiers (Severe / Medium / Small) × PROBABILITY of
// hitting the project. Returns a 0-100 RISK score where 100 = no policy
// headwind. Uses impact_severity when the admin has set it; until events are
// re-classified it BRIDGES from the legacy |irr_impact_bps| magnitude so the
// pillar produces sensible values immediately. No dollars leave this function.
const SEVERITY_PENALTY = { severe: 30, medium: 15, small: 6 }
const PROBABILITY_FACTOR = { high: 1.0, medium: 0.6, low: 0.3 }

export function policySeverityTier(p) {
  if (!p) return null
  if (p.impact_severity && SEVERITY_PENALTY[p.impact_severity]) return p.impact_severity
  // Transitional bridge from the legacy synthesized bps until severity is set.
  // Only headwinds (negative bps) count as risk; tailwinds/neutral → no penalty.
  const bps = Number(p.irr_impact_bps) || 0
  if (bps >= 0) return null
  const mag = Math.abs(bps)
  if (mag >= 300) return 'severe'
  if (mag >= 100) return 'medium'
  return 'small'
}

/**
 * @param {Array} policyEvents
 * @param {{mw, stage, technology}|null} project
 * @returns {{score:number, applicableCount:number, events:Array}} 100 = clean
 */
export function computeStatePolicyRiskScore(policyEvents, project = null) {
  if (!Array.isArray(policyEvents) || policyEvents.length === 0) return { score: 100, applicableCount: 0, events: [] }
  const applicable = filterApplicablePolicies(policyEvents, project || {})
  if (applicable.length === 0) return { score: 100, applicableCount: 0, events: [] }

  let penalty = 0
  const events = []
  for (const p of applicable) {
    const tier = policySeverityTier(p)
    if (!tier) continue
    const prob = PROBABILITY_FACTOR[p.impact_probability] ?? 0.7  // assume likely when unset
    penalty += SEVERITY_PENALTY[tier] * prob
    events.push({ id: p.id, event_name: p.event_name, severity: tier, probability: p.impact_probability || 'assumed', pillar: p.pillar, source_url: p.source_url })
  }
  return { score: Math.max(0, Math.round(100 - penalty)), applicableCount: applicable.length, events }
}
