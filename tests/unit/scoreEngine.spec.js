import { describe, it, expect } from 'vitest'
import {
  safeScore,
  computeDisplayScore,
  computeDisplayScoreRange,
  computeSubScores,
  computeIncentiveScore,
  getOfftakeCoverageStates,
  WEIGHT_SCENARIOS,
  STAGE_MODIFIERS,
} from '../../src/lib/scoreEngine.js'

describe('safeScore — defensive wrapper', () => {
  it('returns finite rebalanced weighted score for the 3 core pillars', () => {
    // Default weights (offtake .25 / ix .25 / site .20) rebalanced over the
    // three present pillars: (80*.25 + 70*.25 + 60*.20) / .70 = 49.5/.70 ≈ 70.7 → 71
    expect(safeScore(80, 70, 60)).toBe(71)
  })

  it('returns null when any sub-score is null', () => {
    expect(safeScore(null, 70, 60)).toBeNull()
    expect(safeScore(80, null, 60)).toBeNull()
    expect(safeScore(80, 70, null)).toBeNull()
  })

  it('returns null when any sub-score is undefined', () => {
    expect(safeScore(undefined, 70, 60)).toBeNull()
  })

  it('returns null when any sub-score is NaN', () => {
    expect(safeScore(NaN, 70, 60)).toBeNull()
    expect(safeScore(80, NaN, 60)).toBeNull()
    expect(safeScore(80, 70, NaN)).toBeNull()
  })

  it('returns null when weights object is malformed', () => {
    expect(safeScore(80, 70, 60, null)).toBeNull()
    expect(safeScore(80, 70, 60, {})).toBeNull()
    expect(safeScore(80, 70, 60, { offtake: 0.5, ix: 0.3, site: NaN })).toBeNull()
  })

  it('refuses object-shaped sub-scores (the bug class that motivated the wrapper)', () => {
    // A regression of the C4 incident: a coverage object getting spread as a
    // sub-score. `Object.values(coverage).reduce` produces NaN; the wrapper
    // must catch this and return null, not propagate poison.
    expect(safeScore({ offtake: 'researched' }, 70, 60)).toBeNull()
  })

  it('accepts the explicit revenue / ix / permit weight scenarios', () => {
    expect(safeScore(80, 70, 60, WEIGHT_SCENARIOS.revenue)).toBeTypeOf('number')
    expect(safeScore(80, 70, 60, WEIGHT_SCENARIOS.ix)).toBeTypeOf('number')
    expect(safeScore(80, 70, 60, WEIGHT_SCENARIOS.permit)).toBeTypeOf('number')
  })
})

describe('computeDisplayScore — basic weighted sum', () => {
  it('returns the rounded rebalanced weighted average under default weights', () => {
    // offtake/ix/site rebalanced: (80*.25 + 70*.25 + 60*.20) / .70 ≈ 70.7 → 71
    expect(computeDisplayScore(80, 70, 60)).toBe(71)
  })

  it('honors custom weights, rebalanced over the present pillars', () => {
    // revenue tilt over offtake/ix/site only (incentives+policyTiming absent):
    // (80*.35 + 70*.20 + 60*.10) / (.35+.20+.10) = 48 / .65 ≈ 73.8 → 74
    expect(computeDisplayScore(80, 70, 60, WEIGHT_SCENARIOS.revenue)).toBe(74)
  })

  it('includes incentives + policyTiming when passed a 5-pillar subs object', () => {
    const three = computeDisplayScore({ offtake: 80, ix: 70, site: 60 })
    const five = computeDisplayScore({ offtake: 80, ix: 70, site: 60, incentives: 100, policyTiming: 100 })
    // Adding two high pillars lifts the composite vs the 3-pillar rebalance.
    expect(five).toBeGreaterThan(three)
  })
})

describe('computeDisplayScoreRange — methodology sensitivity', () => {
  it('returns default + min + max + spread + scenarios', () => {
    const r = computeDisplayScoreRange(80, 70, 60)
    expect(r).toHaveProperty('default')
    expect(r).toHaveProperty('min')
    expect(r).toHaveProperty('max')
    expect(r).toHaveProperty('spread')
    expect(r.spread).toBe(r.max - r.min)
    expect(Object.keys(r.scenarios).sort()).toEqual(['default', 'incentive', 'ix', 'permit', 'revenue'])
  })

  it('spread is zero when all sub-scores are equal (any weights yield same)', () => {
    const r = computeDisplayScoreRange(75, 75, 75)
    expect(r.spread).toBe(0)
  })
})

describe('computeSubScores — main entry', () => {
  it('returns zero-shape when stateProgram is missing', () => {
    const r = computeSubScores(null, null)
    expect(r).toEqual({
      offtake: 0,
      ix: 0,
      site: 0,
      incentives: null,
      policyTiming: null,
      coverage: { offtake: 'researched', ix: 'curated', site: 'researched', incentives: 'none', policyTiming: 'none' },
    })
  })

  it('clamps every sub-score to [0, 100]', () => {
    // pick a state in CI_OFFTAKE_SCORES with high baseline + Operational
    // stage (+10/+10/+25) to push toward the ceiling. RI=90 + 10 = 100
    // (clamped exactly at ceiling).
    const r = computeSubScores(
      { id: 'RI', csStatus: 'active', capacityMW: 600, ixDifficulty: 'easy' },
      null,
      'Operational',
      'C&I Solar',
    )
    expect(r.offtake).toBeGreaterThanOrEqual(0)
    expect(r.offtake).toBeLessThanOrEqual(100)
    expect(r.ix).toBeGreaterThanOrEqual(0)
    expect(r.ix).toBeLessThanOrEqual(100)
    expect(r.site).toBeGreaterThanOrEqual(0)
    expect(r.site).toBeLessThanOrEqual(100)
  })

  it('marks offtake coverage = fallback when state is outside C&I curated list', () => {
    // 'KS' is intentionally not in CI_OFFTAKE_SCORES at the top of
    // scoreEngine.js (verified 2026-05-06). If KS gets added, swap to
    // any other un-covered state.
    const r = computeSubScores(
      { id: 'KS', csStatus: 'none', ixDifficulty: 'moderate' },
      null,
      '',
      'C&I Solar',
    )
    expect(r.coverage.offtake).toBe('fallback')
  })

  it('marks ix coverage = live when ixQueueSummary has projects', () => {
    const r = computeSubScores(
      { id: 'NY', csStatus: 'active', ixDifficulty: 'hard' },
      null,
      '',
      'Community Solar',
      { totalProjects: 12, totalMW: 800, avgStudyMonths: 22 },
    )
    expect(r.coverage.ix).toBe('live')
  })

  it('marks ix coverage = curated when no ixQueueSummary provided', () => {
    const r = computeSubScores(
      { id: 'NY', csStatus: 'active', ixDifficulty: 'hard' },
      null,
      '',
      'Community Solar',
    )
    expect(r.coverage.ix).toBe('curated')
  })

  it('site = 60 baseline when neither geospatial nor curated site data exists', () => {
    const r = computeSubScores(
      { id: 'IA', csStatus: 'pending', ixDifficulty: 'moderate' },
      null,
      '',
      'Community Solar',
    )
    expect(r.site).toBe(60)
    expect(r.coverage.site).toBe('fallback')
  })

  it('site uses live geospatial when present', () => {
    // wetland 5% (<15 → false), prime farmland 35% (>=25 → true) → 82
    const r = computeSubScores(
      { id: 'IA', csStatus: 'pending', ixDifficulty: 'moderate' },
      { geospatial: { wetlandCoveragePct: 5, primeFarmlandPct: 35 } },
      '',
      'Community Solar',
    )
    expect(r.site).toBe(82)
    expect(r.coverage.site).toBe('live')
  })

  it('LMI penalty applies to the offtake baseline regardless of csStatus', () => {
    // Pinning current behavior: the LMI deduction applies whenever
    // lmiRequired && lmiPercent crosses the threshold, even on pending /
    // limited programs. The penalty is structural (the CS economics will
    // be tougher when the program opens) so this is intentional.
    // If we ever want to gate it to status='active', the test will fail
    // and force a deliberate decision.
    const active50 = computeSubScores(
      { id: 'XX', csStatus: 'active', capacityMW: 100, lmiRequired: true, lmiPercent: 50, ixDifficulty: 'moderate' },
      null, '', 'Community Solar',
    )
    const active30 = computeSubScores(
      { id: 'XX', csStatus: 'active', capacityMW: 100, lmiRequired: true, lmiPercent: 30, ixDifficulty: 'moderate' },
      null, '', 'Community Solar',
    )
    const pending50 = computeSubScores(
      { id: 'XX', csStatus: 'pending', lmiRequired: true, lmiPercent: 50, ixDifficulty: 'moderate' },
      null, '', 'Community Solar',
    )
    const activeNoLMI = computeSubScores(
      { id: 'XX', csStatus: 'active', capacityMW: 100, lmiRequired: false, ixDifficulty: 'moderate' },
      null, '', 'Community Solar',
    )
    expect(active50.offtake).toBe(80 - 10)         // -10 at lmiPercent>=40
    expect(active30.offtake).toBe(80 - 5)          // -5 at lmiPercent 25-39
    expect(pending50.offtake).toBe(25 - 10)        // penalty applies on pending too
    expect(activeNoLMI.offtake).toBe(80)           // no penalty without lmiRequired
  })

  it('IX live blend never moves the curated baseline by more than ±10', () => {
    // very crowded queue: months 30 + 2000MW pending → -8 + -6 = -14, clamped to -10
    const baseline = computeSubScores(
      { id: 'NY', csStatus: 'active', ixDifficulty: 'hard' },
      null,
      '',
      'Community Solar',
    )
    const blended = computeSubScores(
      { id: 'NY', csStatus: 'active', ixDifficulty: 'hard' },
      null,
      '',
      'Community Solar',
      { totalProjects: 50, totalMW: 2000, avgStudyMonths: 30 },
    )
    expect(baseline.ix - blended.ix).toBeLessThanOrEqual(10)
  })

  it('cs_pipeline (NYSERDA) signal flips coverage to live but does NOT blend the score', () => {
    // Aden's design call (2026-05-22): NYSERDA distribution data is a CS
    // deployment-pipeline signal, not ISO study-queue depth. It surfaces as
    // live CONTEXT (coverage='live') but the IX SCORE stays on the curated
    // ixDifficulty baseline — a large pipeline MW must NOT trigger the legacy
    // -6 MW-band blend.
    const base = { id: 'NY', csStatus: 'active', ixDifficulty: 'hard' }
    const curated = computeSubScores(base, null, '', 'Community Solar')
    const pipeline = computeSubScores(
      base, null, '', 'Community Solar',
      { totalProjects: 1021, totalMW: 2616, signalType: 'cs_pipeline', avgStudyMonths: null },
    )
    expect(pipeline.coverage.ix).toBe('live')
    expect(pipeline.ix).toBe(curated.ix)
  })

  it('stage modifier table is referenced and additive, not multiplicative', () => {
    expect(STAGE_MODIFIERS).toHaveProperty('Operational')
    expect(STAGE_MODIFIERS).toHaveProperty('Prospecting')
    expect(STAGE_MODIFIERS['Prospecting']).toEqual([0, 0, 0])
  })
})

describe('getOfftakeCoverageStates — published coverage', () => {
  it('returns a sorted state list for C&I Solar', () => {
    const list = getOfftakeCoverageStates('C&I Solar')
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(20)
    const sorted = [...list].sort()
    expect(list).toEqual(sorted)
  })

  it('returns BESS coverage for legacy BESS', () => {
    expect(getOfftakeCoverageStates('BESS')).toBeTruthy()
    expect(getOfftakeCoverageStates('BESS').length).toBeGreaterThan(10)
  })

  it('Hybrid is now CS-family (PV+Storage + CS) → null coverage, not BESS', () => {
    // Two-axis rename: Hybrid = PV+Storage architecture + CS structure. Offtake
    // is driven by structure (CS, all-50 curated), not the old CS/BESS blend.
    expect(getOfftakeCoverageStates('Hybrid')).toBeNull()
  })

  it('Net Metering uses the retail-rate (C&I) coverage; Net Billing is sourced only where we have export-credit data', () => {
    expect(getOfftakeCoverageStates('Net Metering')).toEqual(getOfftakeCoverageStates('C&I Solar'))
    // Sourced net-billing states (export-credit ratio verified); others gated.
    expect(getOfftakeCoverageStates('Net Billing')).toEqual(['AR', 'AZ', 'CA', 'ID', 'IN', 'LA', 'MI', 'NC', 'UT'])
  })

  it('returns null for Community Solar (all 50 states are curated)', () => {
    expect(getOfftakeCoverageStates('Community Solar')).toBeNull()
  })
})

describe('computeSubScores — two-axis model (architecture × structure)', () => {
  const NY = { id: 'NY', csStatus: 'active', capacityMW: 600, ixDifficulty: 'moderate' }

  it('accepts an {architecture, structure} object', () => {
    const r = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'Community Solar' })
    expect(r.offtake).toBeGreaterThan(0)
    expect(r.coverage.offtake).toBe('researched')
  })

  it('legacy technology strings still resolve to the right axes', () => {
    // 'C&I Solar' → C&I structure; 'Hybrid' → PV+Storage + CS.
    const ci = computeSubScores(NY, null, '', 'C&I Solar')
    const ciAxes = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'C&I Solar' })
    expect(ci.offtake).toBe(ciAxes.offtake)
  })

  it('legacy "C&I behind-the-meter" structure still scores as C&I (normalizeStructure)', () => {
    // Saved rows from before the 2026-05-24 rename carry the old structure label.
    // They must score identically to canonical 'C&I Solar', not fall through to CS.
    const legacy = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'C&I behind-the-meter' })
    const canonical = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'C&I Solar' })
    expect(legacy.offtake).toBe(canonical.offtake)
    expect(legacy.coverage.offtake).toBe(canonical.coverage.offtake)
  })

  it('PV+Storage applies the -5 IX modifier vs Standalone PV', () => {
    const pv = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'Community Solar' })
    const hyb = computeSubScores(NY, null, '', { architecture: 'PV + Storage', structure: 'Community Solar' })
    expect(pv.ix - hyb.ix).toBe(5)
    expect(pv.offtake).toBe(hyb.offtake) // same structure → same offtake
  })

  it('Net Metering tracks the retail-rate (C&I) anchor; unsourced Net Billing stays gated, NB < NM', () => {
    const nm = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'Net Metering' })
    const nb = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'Net Billing' })
    const ci = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'C&I Solar' })
    expect(nm.offtake).toBe(ci.offtake)             // same retail-rate anchor (NY curated)
    expect(nm.coverage.offtake).toBe('researched')  // NY is in the curated retail list
    expect(nb.coverage.offtake).toBe('fallback')    // NY net-billing export credit not sourced yet
    expect(nb.offtake).toBeLessThan(nm.offtake)
  })

  it('Net Billing is scored for real where the export-credit ratio is sourced (CA), gated elsewhere', () => {
    const CA = { id: 'CA', csStatus: 'active', capacityMW: 600, ixDifficulty: 'moderate' }
    const caNb = computeSubScores(CA, null, '', { architecture: 'Standalone PV', structure: 'Net Billing' })
    const caNm = computeSubScores(CA, null, '', { architecture: 'Standalone PV', structure: 'Net Metering' })
    // CA has a sourced export-credit ratio (NEM 3.0 ACC) → real signal, researched
    // coverage, and below net metering (exports credited well under retail).
    expect(caNb.coverage.offtake).toBe('researched')
    expect(caNb.offtake).toBeGreaterThan(0)
    expect(caNb.offtake).toBeLessThan(caNm.offtake)
    // A state without a sourced ratio stays gated on the directional baseline (45).
    const ks = computeSubScores({ id: 'KS', csStatus: 'none', ixDifficulty: 'moderate' }, null, '', { architecture: 'Standalone PV', structure: 'Net Billing' })
    expect(ks.coverage.offtake).toBe('fallback')
    expect(ks.offtake).toBe(45)
  })

  it('legacy standalone BESS still scores (offtake from capacity market, +5 IX)', () => {
    const bess = computeSubScores(NY, null, '', 'BESS')
    const pv = computeSubScores(NY, null, '', { architecture: 'Standalone PV', structure: 'Community Solar' })
    expect(bess.ix - pv.ix).toBe(5)
    expect(bess.offtake).toBeGreaterThan(0)
  })
})

describe('computeIncentiveScore — Pillar 4 (ITC step-up eligibility)', () => {
  it('returns null/none when no county incentive data is provided', () => {
    expect(computeIncentiveScore(undefined).score).toBeNull()
    expect(computeIncentiveScore({ energyCommunity: null, nmtcLic: null, hudQctDda: null }).coverage).toBe('none')
  })

  it('base §48E only (covered county, no adders) → 50', () => {
    const r = computeIncentiveScore({ energyCommunity: { isEnergyCommunity: false }, nmtcLic: { isEligible: false }, hudQctDda: { qctCount: 0, isNonMetroDda: false } })
    expect(r.coverage).toBe('live')
    expect(r.score).toBe(50)
  })

  it('full adder stack (Energy Community + Low-Income Community) → 100', () => {
    const r = computeIncentiveScore({ energyCommunity: { isEnergyCommunity: true }, nmtcLic: { isEligible: true }, hudQctDda: null })
    expect(r.score).toBe(100)
    expect(r.adders.energyCommunity).toBe(true)
    expect(r.adders.lowIncomeCommunity).toBe(true)
  })

  it('HUD QCT/DDA alone qualifies the Low-Income Community adder', () => {
    const r = computeIncentiveScore({ energyCommunity: null, nmtcLic: { isEligible: false }, hudQctDda: { qctCount: 3, isNonMetroDda: false } })
    expect(r.adders.lowIncomeCommunity).toBe(true)
    expect(r.score).toBe(75)
  })
})

describe('computeSubScores — Pillar 4/5 (incentives + policy & timing)', () => {
  const NY = { id: 'NY', csStatus: 'active', capacityMW: 600, ixDifficulty: 'moderate' }

  it('incentives pillar is null (excluded) when no stack passed; live when passed', () => {
    const noInc = computeSubScores(NY, null, 'Development', 'Community Solar')
    expect(noInc.incentives).toBeNull()
    expect(noInc.coverage.incentives).toBe('none')

    const withInc = computeSubScores(NY, null, 'Development', 'Community Solar', null, null, 5, {
      incentives: { energyCommunity: { isEnergyCommunity: true }, nmtcLic: { isEligible: true }, hudQctDda: null },
    })
    expect(withInc.incentives).toBe(100)
    expect(withInc.coverage.incentives).toBe('live')
  })

  it('policyTiming reflects federal timing from stage (early-stage at-risk < late-stage)', () => {
    const early = computeSubScores(NY, null, 'Prospecting', 'Community Solar', null, null, 5, { codYear: 2029 })
    const late = computeSubScores(NY, null, 'Operational', 'Community Solar', null, null, 5, { codYear: 2029 })
    expect(late.policyTiming).toBeGreaterThan(early.policyTiming)
    expect(late.coverage.policyTiming).toBe('live')
  })
})
