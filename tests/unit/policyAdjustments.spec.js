// PIE-001 Phase E — scalability discipline tests for the policy
// adjustment math. These tests prove the engine is fully data-driven:
//   - No state-name hardcoding anywhere (a fake "ZZ" policy flows
//     through the engine the same as a real one).
//   - Confidence gating: only impact_confidence='high' moves numbers.
//   - MW band: inclusive lower / exclusive upper.
//   - Applicability: stage → flag mapping respected.
//   - Tech filter: applicable_technologies honored when non-empty.
//   - Multi-policy stacking: capex/opex sum, revenue haircuts compound.
//   - policy_climate score: bps → 0-100 mapping with ±50 clamp.

import { describe, it, expect } from 'vitest'
import {
  filterApplicablePolicies,
  convertPolicyToInputDeltas,
  aggregatePolicyDeltas,
  applyDeltasToInputs,
  computePolicyAdjustments,
  computePolicyClimateScore,
} from '../../src/lib/policyAdjustments.js'

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
    capex_impact_per_mw_usd:           null,
    irr_impact_bps:                    null,
    ongoing_fee_per_mw_yr_usd:         null,
    revenue_haircut_pct:               null,
    source_url:                        'https://example.gov/test',
    verified_at:                       '2026-05-11T00:00:00Z',
    impact_methodology:                'Test methodology',
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

    // 2 MW project gets the 1-3 MW tier only
    const r1 = filterApplicablePolicies(policies, { mw: 2, stage: 'Prospecting' })
    expect(r1.map(p => p.id)).toEqual(['t1'])

    // 4 MW project gets the 3-5 MW tier only
    const r2 = filterApplicablePolicies(policies, { mw: 4, stage: 'Prospecting' })
    expect(r2.map(p => p.id)).toEqual(['t2'])

    // 3 MW project: upper of t1 is exclusive (mw < 3 false), lower of t2 is
    // inclusive (mw >= 3 true) — gets t2
    const r3 = filterApplicablePolicies(policies, { mw: 3, stage: 'Prospecting' })
    expect(r3.map(p => p.id)).toEqual(['t2'])

    // 7 MW project: outside both bands
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
    // But Prospecting wouldn't catch it
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

describe('convertPolicyToInputDeltas — unit conversions', () => {
  it('$/MW capex → $/W (divide by 1M)', () => {
    const p = makePolicy({ capex_impact_per_mw_usd: 200_000 })
    expect(convertPolicyToInputDeltas(p).capexPerWatt).toBe(0.20)
  })

  it('$/MW/yr ongoing fee → $/kW/yr (divide by 1000)', () => {
    const p = makePolicy({ ongoing_fee_per_mw_yr_usd: 33_600 })
    expect(convertPolicyToInputDeltas(p).opexPerKwYear).toBe(33.6)
  })

  it('revenue haircut % passes through', () => {
    const p = makePolicy({ revenue_haircut_pct: 15 })
    expect(convertPolicyToInputDeltas(p).revenueHaircutPct).toBe(15)
  })

  it('zero output when policy is null', () => {
    expect(convertPolicyToInputDeltas(null)).toEqual({ capexPerWatt: 0, opexPerKwYear: 0, revenueHaircutPct: 0 })
  })
})

describe('aggregatePolicyDeltas — multi-policy stacking', () => {
  it('sums capex and opex across policies', () => {
    const p1 = makePolicy({ id: 'p1', capex_impact_per_mw_usd: 100_000, ongoing_fee_per_mw_yr_usd: 10_000 })
    const p2 = makePolicy({ id: 'p2', capex_impact_per_mw_usd: 200_000, ongoing_fee_per_mw_yr_usd: 5_000 })
    const { totals } = aggregatePolicyDeltas([p1, p2])
    expect(totals.capexPerWatt).toBeCloseTo(0.30, 6)   // 100K + 200K = 300K/MW → $0.30/W
    expect(totals.opexPerKwYear).toBeCloseTo(15, 6)    // 10K + 5K = 15K/MW/yr → $15/kW/yr
  })

  it('revenue haircuts compound multiplicatively, not additively', () => {
    const p1 = makePolicy({ id: 'p1', revenue_haircut_pct: 10 })
    const p2 = makePolicy({ id: 'p2', revenue_haircut_pct: 20 })
    const { totals } = aggregatePolicyDeltas([p1, p2])
    // 90% × 80% = 72% revenue survives → haircut = 28%, not 30%
    expect(totals.revenueSurvivalFactor).toBeCloseTo(0.72, 4)
    expect(totals.revenueHaircutPct).toBeCloseTo(28, 4)
  })

  it('breakdown carries provenance per policy', () => {
    const p1 = makePolicy({ id: 'a', event_name: 'A', source_url: 'https://x/a', capex_impact_per_mw_usd: 50_000 })
    const { breakdown } = aggregatePolicyDeltas([p1])
    expect(breakdown[0].id).toBe('a')
    expect(breakdown[0].event_name).toBe('A')
    expect(breakdown[0].source_url).toBe('https://x/a')
    expect(breakdown[0].capex_delta).toBe(0.05)
  })
})

describe('applyDeltasToInputs — scenario input adjustment', () => {
  it('adds capex/opex deltas to baseline inputs', () => {
    const inputs = { capexPerWatt: 2.70, opexPerKwYear: 20, recPricePerMwh: 60, programAllocation: 1.0 }
    const totals = { capexPerWatt: 0.30, opexPerKwYear: 5, revenueSurvivalFactor: 1.0 }
    const adj = applyDeltasToInputs(inputs, totals)
    expect(adj.capexPerWatt).toBeCloseTo(3.00, 2)
    expect(adj.opexPerKwYear).toBeCloseTo(25, 2)
    expect(adj.recPricePerMwh).toBe(60)         // no haircut → unchanged
    expect(adj.programAllocation).toBe(1.0)
  })

  it('scales revenue inputs by revenueSurvivalFactor', () => {
    const inputs = { recPricePerMwh: 80, ppaRateCentsKwh: 9, programAllocation: 1.0, capexPerWatt: 2.70, opexPerKwYear: 20 }
    const totals = { capexPerWatt: 0, opexPerKwYear: 0, revenueSurvivalFactor: 0.80 }  // 20% revenue cut
    const adj = applyDeltasToInputs(inputs, totals)
    expect(adj.recPricePerMwh).toBeCloseTo(64, 2)         // 80 × 0.8
    expect(adj.ppaRateCentsKwh).toBeCloseTo(7.2, 2)       // 9 × 0.8
    expect(adj.programAllocation).toBeCloseTo(0.80, 4)
  })

  it('returns NEW object — does not mutate input', () => {
    const inputs = { capexPerWatt: 2.70, opexPerKwYear: 20 }
    const orig = { ...inputs }
    applyDeltasToInputs(inputs, { capexPerWatt: 0.5, opexPerKwYear: 10, revenueSurvivalFactor: 1.0 })
    expect(inputs).toEqual(orig)  // unmutated
  })
})

describe('computePolicyClimateScore — bps → 0-100 mapping', () => {
  it('returns 50 (neutral) when no policies', () => {
    expect(computePolicyClimateScore([], null)).toBe(50)
    expect(computePolicyClimateScore(null, null)).toBe(50)
  })

  it('subtracts 1 score point per 50 bps negative impact', () => {
    const p = makePolicy({ irr_impact_bps: -500 })
    const r = computePolicyClimateScore([p], { mw: 5, stage: 'Prospecting' })
    expect(r).toBe(40)  // 50 - 500/50 = 40
  })

  it('adds 1 score point per 50 bps positive impact (tailwind)', () => {
    const p = makePolicy({ irr_impact_bps: +1000 })
    const r = computePolicyClimateScore([p], { mw: 5, stage: 'Prospecting' })
    expect(r).toBe(70)  // 50 + 1000/50 = 70
  })

  it('clamps to ±50 from baseline', () => {
    const headwind = makePolicy({ irr_impact_bps: -5000 })
    expect(computePolicyClimateScore([headwind], { mw: 5, stage: 'Prospecting' })).toBe(0)  // clamped to 0

    const tailwind = makePolicy({ irr_impact_bps: +5000 })
    expect(computePolicyClimateScore([tailwind], { mw: 5, stage: 'Prospecting' })).toBe(100)  // clamped to 100
  })

  it('stacks multiple policies', () => {
    const p1 = makePolicy({ id: 'a', irr_impact_bps: -300 })
    const p2 = makePolicy({ id: 'b', irr_impact_bps: -200 })
    const r = computePolicyClimateScore([p1, p2], { mw: 5, stage: 'Prospecting' })
    expect(r).toBe(40)  // 50 - 500/50 = 40
  })

  it('ignores low/medium confidence policies (gating preserved)', () => {
    const high = makePolicy({ id: 'h', irr_impact_bps: -200, impact_confidence: 'high' })
    const med  = makePolicy({ id: 'm', irr_impact_bps: -800, impact_confidence: 'medium' })
    const r = computePolicyClimateScore([high, med], { mw: 5, stage: 'Prospecting' })
    expect(r).toBe(46)  // only high's -200 bps counts: 50 - 200/50 = 46
  })
})

describe('computePolicyAdjustments — orchestrator integration', () => {
  it('produces empty breakdown when no policies apply', () => {
    const r = computePolicyAdjustments({
      policies: [makePolicy({ impact_confidence: 'low' })],
      inputs: { capexPerWatt: 2.70, opexPerKwYear: 20 },
      mw: 5, stage: 'Prospecting', technology: 'Community Solar',
    })
    expect(r.applicableCount).toBe(0)
    expect(r.breakdown).toEqual([])
    expect(r.adjustedInputs.capexPerWatt).toBe(2.70)
  })

  it('produces breakdown with applied capex/opex deltas', () => {
    const policy = makePolicy({
      capex_impact_per_mw_usd: 100_000,
      ongoing_fee_per_mw_yr_usd: 10_000,
    })
    const r = computePolicyAdjustments({
      policies: [policy],
      inputs: { capexPerWatt: 2.70, opexPerKwYear: 20 },
      mw: 5, stage: 'Prospecting', technology: 'Community Solar',
    })
    expect(r.applicableCount).toBe(1)
    expect(r.adjustedInputs.capexPerWatt).toBeCloseTo(2.80, 2)
    expect(r.adjustedInputs.opexPerKwYear).toBeCloseTo(30, 2)
    expect(r.breakdown).toHaveLength(1)
    expect(r.breakdown[0].capex_delta).toBe(0.10)
  })
})

// ── Scalability discipline: hypothetical fake-state row flows the same.
// This is the regression guard against future hardcoding drift — if any
// engine code starts state-name-gating, this test will fail because a
// "ZZ" policy will stop affecting the math.
describe('SCALABILITY DISCIPLINE — no state-name hardcoding', () => {
  it('a fake "ZZ" state policy flows through every layer the same as a real state', () => {
    // Synthesized policy for a fake jurisdiction. If engine code path-
    // matches on state name anywhere, this test will fail.
    const fakeAkPolicy = makePolicy({
      state: 'AK',                                  // not in our 19 CS states
      event_name: 'AK Hypothetical Reform',
      pillar: 'offtake',
      impact_confidence: 'high',
      irr_impact_bps: -300,
      capex_impact_per_mw_usd: 150_000,
      ongoing_fee_per_mw_yr_usd: 20_000,
      applies_to_new_applications: true,
    })

    // filter accepts it
    const filtered = filterApplicablePolicies([fakeAkPolicy], { mw: 5, stage: 'Prospecting', technology: 'Community Solar' })
    expect(filtered).toHaveLength(1)

    // adjustments compute against the same per-MW math regardless of state
    const adj = computePolicyAdjustments({
      policies: [fakeAkPolicy],
      inputs: { capexPerWatt: 2.50, opexPerKwYear: 18, recPricePerMwh: 70, programAllocation: 1.0 },
      mw: 5, stage: 'Prospecting', technology: 'Community Solar',
    })
    expect(adj.applicableCount).toBe(1)
    expect(adj.adjustedInputs.capexPerWatt).toBeCloseTo(2.65, 2)  // 2.50 + 150K/1M = 2.65
    expect(adj.adjustedInputs.opexPerKwYear).toBeCloseTo(38, 2)    // 18 + 20K/1000 = 38

    // climate score uses the same bps-to-points mapping
    const climate = computePolicyClimateScore([fakeAkPolicy], { mw: 5, stage: 'Prospecting' })
    expect(climate).toBe(44)  // 50 - 300/50 = 44
  })
})
