// Scalability discipline tests for the Policy & Timing engine. The $ layer
// (convertPolicyToInputDeltas / aggregate / applyDeltas / computePolicyAdjustments
// / computePolicyClimateScore) was removed in the 2026-05 signal pivot — policy
// is now SEVERITY × PROBABILITY. These tests prove the engine stays fully
// data-driven (no state-name hardcoding), confidence-gated, MW/stage/tech-
// applicable, and shape-tolerant (camelCase client rows score like snake_case).

import { describe, it, expect } from 'vitest'
import {
  filterApplicablePolicies,
  computeStatePolicyRiskScore,
  policySeverityTier,
} from '../../src/lib/policyAdjustments.js'

describe('computeStatePolicyRiskScore — severity-based Policy & Timing input', () => {
  const hi = (over = {}) => ({ impact_confidence: 'high', is_active: true, review_status: 'published', applies_to_new_applications: true, ...over })

  it('returns 100 (clean) when no events or none applicable', () => {
    expect(computeStatePolicyRiskScore([]).score).toBe(100)
    expect(computeStatePolicyRiskScore(null).score).toBe(100)
  })

  it('uses explicit impact_severity when set; severe drops the score more than small', () => {
    const severe = computeStatePolicyRiskScore([hi({ event_name: 'X', impact_severity: 'severe', impact_probability: 'high' })], { stage: 'Prospecting' })
    const small = computeStatePolicyRiskScore([hi({ event_name: 'Y', impact_severity: 'small', impact_probability: 'high' })], { stage: 'Prospecting' })
    expect(severe.score).toBeLessThan(small.score)
    expect(severe.score).toBe(70)   // 100 - 30*1.0
    expect(small.score).toBe(94)    // 100 - 6*1.0
  })

  it('probability scales the penalty', () => {
    const high = computeStatePolicyRiskScore([hi({ event_name: 'X', impact_severity: 'severe', impact_probability: 'high' })], { stage: 'Prospecting' })
    const low = computeStatePolicyRiskScore([hi({ event_name: 'X', impact_severity: 'severe', impact_probability: 'low' })], { stage: 'Prospecting' })
    expect(low.score).toBeGreaterThan(high.score)  // 100 - 30*0.3 = 91 > 70
  })

  it('bridges from legacy irr_impact_bps magnitude when severity unset; tailwinds add no risk', () => {
    expect(policySeverityTier({ irr_impact_bps: -476 })).toBe('severe')
    expect(policySeverityTier({ irr_impact_bps: -150 })).toBe('medium')
    expect(policySeverityTier({ irr_impact_bps: -40 })).toBe('small')
    expect(policySeverityTier({ irr_impact_bps: 200 })).toBeNull()  // tailwind → no penalty
  })
})

describe('shape tolerance — camelCase (client) rows score like snake_case (server)', () => {
  // programData.getPolicyImpactEvents() returns camelCase; the engine reads
  // snake_case. Before normalization, a camelCase row had every gate field
  // read as undefined → silently dropped → state policy never reached the
  // Policy & Timing pillar. This guards the choke-point coercion.
  const camel = {
    id: 'c1', state: 'ZZ', eventName: 'CamelCase Bill', pillar: 'offtake',
    impactConfidence: 'high', isActive: true, reviewStatus: 'published',
    appliesToNewApplications: true, impactSeverity: 'severe', impactProbability: 'high',
    minMwAc: null, maxMwAc: null, applicableTechnologies: null,
  }

  it('filterApplicablePolicies accepts a camelCase row and returns it normalized', () => {
    const r = filterApplicablePolicies([camel], { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })
    expect(r).toHaveLength(1)
    expect(r[0].impact_confidence).toBe('high')   // coerced to snake_case
    expect(r[0].event_name).toBe('CamelCase Bill')
  })

  it('computeStatePolicyRiskScore reads severity off a camelCase row', () => {
    const r = computeStatePolicyRiskScore([camel], { stage: 'Prospecting' })
    expect(r.applicableCount).toBe(1)
    expect(r.score).toBe(70)   // severe (30) × high (1.0) → 100-30
    expect(r.events[0].event_name).toBe('CamelCase Bill')
  })
})

// Test-fixture factory — produces a policy row with sensible defaults.
// Tests override only the field they're exercising.
function makePolicy(overrides = {}) {
  return {
    id:                                'test-1',
    state:                             'ZZ',           // fake state — proves engine is data-driven
    event_name:                        'ZZ Test Bill',
    pillar:                            'offtake',
    impact_confidence:                 'high',
    is_active:                         true,
    review_status:                     'published',
    min_mw_ac:                         null,
    max_mw_ac:                         null,
    applicable_technologies:           null,
    applies_to_new_applications:       true,
    applies_to_existing_queue:         false,
    applies_to_operating_projects:     false,
    irr_impact_bps:                    null,
    source_url:                        'https://example.gov/test',
    verified_at:                       '2026-05-11T00:00:00Z',
    ...overrides,
  }
}

describe('filterApplicablePolicies — confidence gate', () => {
  it('excludes medium and low confidence', () => {
    const policies = [
      makePolicy({ impact_confidence: 'high' }),
      makePolicy({ impact_confidence: 'medium' }),
      makePolicy({ impact_confidence: 'low' }),
    ]
    const r = filterApplicablePolicies(policies, { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })
    expect(r).toHaveLength(1)
    expect(r[0].impact_confidence).toBe('high')
  })

  it('excludes inactive and unpublished', () => {
    const policies = [
      makePolicy({ is_active: false }),
      makePolicy({ review_status: 'draft' }),
      makePolicy(),
    ]
    const r = filterApplicablePolicies(policies, { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })
    expect(r).toHaveLength(1)
  })
})

describe('filterApplicablePolicies — MW band', () => {
  it('respects inclusive lower / exclusive upper bounds', () => {
    const tier1to3 = makePolicy({ id: 't1', min_mw_ac: 1, max_mw_ac: 3, event_name: '1-3 MW' })
    const tier3to5 = makePolicy({ id: 't2', min_mw_ac: 3, max_mw_ac: 5, event_name: '3-5 MW' })
    const policies = [tier1to3, tier3to5]

    const r1 = filterApplicablePolicies(policies, { mw: 2, stage: 'Prospecting' })
    expect(r1.map(p => p.id)).toEqual(['t1'])

    const r2 = filterApplicablePolicies(policies, { mw: 4, stage: 'Prospecting' })
    expect(r2.map(p => p.id)).toEqual(['t2'])

    // 3 MW: upper of t1 exclusive (mw < 3 false), lower of t2 inclusive (mw >= 3 true)
    const r3 = filterApplicablePolicies(policies, { mw: 3, stage: 'Prospecting' })
    expect(r3.map(p => p.id)).toEqual(['t2'])

    const r4 = filterApplicablePolicies(policies, { mw: 7, stage: 'Prospecting' })
    expect(r4).toHaveLength(0)
  })

  it('skips MW filter when mw not provided (state-level scoring)', () => {
    const tier = makePolicy({ min_mw_ac: 1, max_mw_ac: 3 })
    const r = filterApplicablePolicies([tier], {})
    expect(r).toHaveLength(1)
  })
})

describe('filterApplicablePolicies — applicability flag', () => {
  it('Prospecting hits applies_to_new_applications policies', () => {
    const p = makePolicy({ applies_to_new_applications: true, applies_to_existing_queue: false, applies_to_operating_projects: false })
    expect(filterApplicablePolicies([p], { mw: 5, stage: 'Prospecting' })).toHaveLength(1)
  })

  it('Operational hits applies_to_operating_projects policies', () => {
    const p = makePolicy({ applies_to_new_applications: false, applies_to_existing_queue: false, applies_to_operating_projects: true })
    expect(filterApplicablePolicies([p], { mw: 5, stage: 'Operational' })).toHaveLength(1)
    expect(filterApplicablePolicies([p], { mw: 5, stage: 'Prospecting' })).toHaveLength(0)
  })

  it('no stage → accepts policies with ANY applicability flag', () => {
    const newOnly = makePolicy({ id: 'n', applies_to_new_applications: true, applies_to_existing_queue: false, applies_to_operating_projects: false })
    const noFlags = makePolicy({ id: 'x', applies_to_new_applications: false, applies_to_existing_queue: false, applies_to_operating_projects: false })
    const r = filterApplicablePolicies([newOnly, noFlags], { mw: 5 })
    expect(r.map(p => p.id)).toEqual(['n'])
  })
})

describe('filterApplicablePolicies — tech filter', () => {
  it('excludes policies whose applicable_technologies array does not include project tech', () => {
    const bessOnly = makePolicy({ applicable_technologies: ['BESS'] })
    expect(filterApplicablePolicies([bessOnly], { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })).toHaveLength(0)
    expect(filterApplicablePolicies([bessOnly], { mw: 5, stage: 'Prospecting', technology: 'BESS' })).toHaveLength(1)
  })

  it('null applicable_technologies = applies to all techs', () => {
    const allTech = makePolicy({ applicable_technologies: null })
    expect(filterApplicablePolicies([allTech], { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })).toHaveLength(1)
  })
})

// Scalability guard: a fake "AK" state row (not in our CS states) flows through
// filter + risk scoring identically. If engine code ever path-matches on state
// name, this fails.
describe('SCALABILITY DISCIPLINE — no state-name hardcoding', () => {
  it('a fake state policy flows through filter + severity scoring the same as a real state', () => {
    const fakeAkPolicy = makePolicy({
      state: 'AK',
      event_name: 'AK Hypothetical Reform',
      impact_confidence: 'high',
      impact_severity: 'severe',
      impact_probability: 'high',
      applies_to_new_applications: true,
    })
    const filtered = filterApplicablePolicies([fakeAkPolicy], { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })
    expect(filtered).toHaveLength(1)

    const risk = computeStatePolicyRiskScore([fakeAkPolicy], { mw: 5, stage: 'Prospecting' })
    expect(risk.applicableCount).toBe(1)
    expect(risk.score).toBe(70)  // severe × high
  })
})
