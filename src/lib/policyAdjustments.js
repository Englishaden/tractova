// Policy Impact Ecosystem (PIE-001) — converts policy_impact_events rows
// into Scenario Studio input deltas + breakdown rows.
//
// Pure functions only. No I/O — callers fetch policy_impact_events rows
// via programData.getPolicyImpactEvents() and pass them in.
//
// Discipline:
//   - HONEST DATA: only impact_confidence='high' rows move the numbers.
//     medium/low surface in prose and card chips (Phases D + F) but DO NOT
//     adjust IRR / capex / opex.
//   - APPLICABILITY RESPECTED: stage flags, MW bands, tech filters all
//     applied before adjustments. A 2 MW project doesn't get hit by the
//     3-5 MW tier's fee.
//   - PROVENANCE: every adjustment row carries event_name + source_url +
//     verified_at so the user can audit any number back to the source.
//   - NO STATE-NAME HARDCODING anywhere. Engine consumes whatever rows
//     exist for the state.

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

// Default to new_applications when stage is unknown — most Studio
// runs are forward-looking prospecting/site-control evaluations.
const DEFAULT_APPLICABILITY_FLAG = 'applies_to_new_applications'

/**
 * Returns the subset of policies that apply to a given project.
 * Hard rules:
 *   - confidence === 'high'   (gate for moving numbers)
 *   - is_active === true       (caller should already filter, defense in depth)
 *   - review_status === 'published'
 *   - MW within [min_mw_ac, max_mw_ac] band (null = unbounded)
 *   - technology in applicable_technologies (null = all techs)
 *   - applicability flag matches project stage
 *
 * @param {Array} policies — rows from policy_impact_events
 * @param {{mw: number, stage: string, technology: string}} project
 * @returns {Array} filtered policies
 */
export function filterApplicablePolicies(policies, { mw, stage, technology }) {
  if (!Array.isArray(policies) || policies.length === 0) return []
  const mwNum = Number(mw) || 0
  const flag = STAGE_APPLICABILITY[stage] || DEFAULT_APPLICABILITY_FLAG

  return policies.filter(p => {
    if (!p) return false
    if (p.impact_confidence !== 'high') return false
    if (p.is_active === false) return false
    if (p.review_status && p.review_status !== 'published') return false

    // MW band: inclusive lower, exclusive upper (matches tier semantics —
    // "1-3 MW AC" tier covers 1 MW up to but not including 3 MW; the 3 MW
    // project gets the next tier).
    if (p.min_mw_ac != null && mwNum < p.min_mw_ac) return false
    if (p.max_mw_ac != null && mwNum >= p.max_mw_ac) return false

    // Technology filter (null array = applies to all techs)
    if (Array.isArray(p.applicable_technologies) && p.applicable_technologies.length > 0) {
      if (!p.applicable_technologies.includes(technology)) return false
    }

    // Stage filter via applicability flag. If the flag isn't set on the
    // row, this stage isn't affected.
    if (!p[flag]) return false

    return true
  })
}

/**
 * Compute input-side deltas from a single policy row, given the project's
 * MW (used to convert per-MW dollar amounts to total-system or per-watt
 * deltas matching the scenario engine's input shape).
 *
 * Returns an object whose keys match scenarioEngine input keys:
 *   - capexPerWatt: $/W increment (one_time_fee_per_kw / 1000 = $/W)
 *   - opexPerKwYear: $/kW/yr increment (ongoing_fee_per_mw_yr_usd / 1000 = $/kW/yr)
 *   - revenueHaircutPct: % scale on REC + billCredit revenue
 *
 * @param {object} policy — policy_impact_events row
 * @returns {{capexPerWatt: number, opexPerKwYear: number, revenueHaircutPct: number}}
 */
export function convertPolicyToInputDeltas(policy) {
  if (!policy) return { capexPerWatt: 0, opexPerKwYear: 0, revenueHaircutPct: 0 }

  // capex_impact_per_mw_usd is in $/MW. Convert to $/W: divide by 1M.
  const capexPerWatt = policy.capex_impact_per_mw_usd != null
    ? Number(policy.capex_impact_per_mw_usd) / 1_000_000
    : 0

  // ongoing_fee_per_mw_yr_usd is in $/MW/yr. Convert to $/kW/yr: divide by 1000.
  const opexPerKwYear = policy.ongoing_fee_per_mw_yr_usd != null
    ? Number(policy.ongoing_fee_per_mw_yr_usd) / 1000
    : 0

  // revenue_haircut_pct stays as a percent (positive = revenue cut).
  const revenueHaircutPct = policy.revenue_haircut_pct != null
    ? Number(policy.revenue_haircut_pct)
    : 0

  return { capexPerWatt, opexPerKwYear, revenueHaircutPct }
}

/**
 * Aggregate multiple policies into a single set of input deltas.
 * Deltas SUM across policies (multiple ongoing fees stack); revenue
 * haircuts MULTIPLY (a 10% cut on top of a 20% cut = 1 - 0.9*0.8 = 28%
 * total cut, not 30%). The breakdown array preserves per-policy
 * provenance for the UI to render line-by-line.
 *
 * @param {Array} policies — already filtered to applicable rows
 * @returns {{ totals: {capexPerWatt, opexPerKwYear, revenueHaircutPct}, breakdown: Array }}
 */
export function aggregatePolicyDeltas(policies) {
  let capexPerWatt = 0
  let opexPerKwYear = 0
  let revenueSurvivalFactor = 1   // start at 100%, multiply by (1 - haircut/100) per policy
  const breakdown = []

  for (const p of policies) {
    const d = convertPolicyToInputDeltas(p)
    capexPerWatt += d.capexPerWatt
    opexPerKwYear += d.opexPerKwYear
    if (d.revenueHaircutPct > 0) {
      revenueSurvivalFactor *= (1 - d.revenueHaircutPct / 100)
    }
    breakdown.push({
      id:                p.id,
      event_name:        p.event_name,
      pillar:            p.pillar,
      effective_date:    p.effective_date,
      impact_confidence: p.impact_confidence,
      min_mw_ac:         p.min_mw_ac,
      max_mw_ac:         p.max_mw_ac,
      capex_delta:       d.capexPerWatt,        // $/W
      opex_delta:        d.opexPerKwYear,       // $/kW/yr
      revenue_haircut:   d.revenueHaircutPct,   // %
      irr_impact_bps:    p.irr_impact_bps,      // engine-computed bps (display only — adjustedIRR is re-computed)
      source_url:        p.source_url,
      verified_at:       p.verified_at,
      methodology:       p.impact_methodology,
    })
  }

  const revenueHaircutPct = (1 - revenueSurvivalFactor) * 100

  return {
    totals: { capexPerWatt, opexPerKwYear, revenueHaircutPct, revenueSurvivalFactor },
    breakdown,
  }
}

/**
 * Apply aggregated policy deltas to a Scenario Studio inputs object.
 * Returns a NEW inputs object — does not mutate the input.
 *
 * The math:
 *   - capexPerWatt: adds the delta on top of baseline
 *   - opexPerKwYear: adds the delta on top of baseline
 *   - billCredit + REC revenue scaled by revenueSurvivalFactor (compounded
 *     across multi-policy haircuts)
 *
 * @param {object} inputs — scenarioEngine baseline inputs
 * @param {object} totals — from aggregatePolicyDeltas
 * @returns {object} adjusted inputs object
 */
export function applyDeltasToInputs(inputs, totals) {
  if (!inputs) return inputs
  const adjusted = { ...inputs }

  if (totals.capexPerWatt && adjusted.capexPerWatt != null) {
    adjusted.capexPerWatt = Number((adjusted.capexPerWatt + totals.capexPerWatt).toFixed(4))
  }
  if (totals.opexPerKwYear && adjusted.opexPerKwYear != null) {
    adjusted.opexPerKwYear = Number((adjusted.opexPerKwYear + totals.opexPerKwYear).toFixed(4))
  }
  // Revenue haircut: scale the revenue-side inputs the scenario engine reads.
  // CS uses billCreditCentsKwh + recPricePerMwh; C&I uses ppaRateCentsKwh.
  // We scale all three by the same factor — appropriate because policy
  // revenue cuts (NEB rate reductions, REC price cuts) hit the displayed
  // revenue regardless of source.
  if (totals.revenueSurvivalFactor != null && totals.revenueSurvivalFactor < 1) {
    if (adjusted.recPricePerMwh != null) {
      adjusted.recPricePerMwh = Number((adjusted.recPricePerMwh * totals.revenueSurvivalFactor).toFixed(2))
    }
    if (adjusted.ppaRateCentsKwh != null) {
      adjusted.ppaRateCentsKwh = Number((adjusted.ppaRateCentsKwh * totals.revenueSurvivalFactor).toFixed(2))
    }
    // billCreditCentsKwh lives in `raw`, not `inputs` — handled by scaling
    // programAllocation instead (close proxy: a 30% revenue cut reads
    // equivalent to a 30% allocation reduction in CS economics).
    if (adjusted.programAllocation != null) {
      adjusted.programAllocation = Number((adjusted.programAllocation * totals.revenueSurvivalFactor).toFixed(4))
    }
  }

  return adjusted
}

/**
 * High-level orchestrator: filter → aggregate → return a structured
 * adjustment package that scenarioEngine.computeBaseline applies to its
 * baseline. Pure — caller fetches policies and supplies them.
 *
 * @param {Array} policies — raw rows from getPolicyImpactEvents
 * @param {object} inputs — baseline scenario inputs (capexPerWatt etc.)
 * @param {{mw, stage, technology}} project
 * @returns {{ adjustedInputs, breakdown: Array, applicableCount: number, totalCount: number }}
 */
export function computePolicyAdjustments({ policies, inputs, mw, stage, technology }) {
  const totalCount = Array.isArray(policies) ? policies.length : 0
  const applicable = filterApplicablePolicies(policies || [], { mw, stage, technology })
  const { totals, breakdown } = aggregatePolicyDeltas(applicable)
  const adjustedInputs = applyDeltasToInputs(inputs, totals)
  return {
    adjustedInputs,
    breakdown,
    totals,
    applicableCount: applicable.length,
    totalCount,
  }
}
