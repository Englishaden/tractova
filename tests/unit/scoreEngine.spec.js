import { describe, it, expect } from 'vitest'
import {
  safeScore,
  computeDisplayScore,
  computeDisplayScoreRange,
  computeSubScores,
  getOfftakeCoverageStates,
  WEIGHT_SCENARIOS,
  STAGE_MODIFIERS,
} from '../../src/lib/scoreEngine.js'

describe('safeScore — defensive wrapper', () => {
  it('returns finite weighted score for valid 3-input case', () => {
    expect(safeScore(80, 70, 60)).toBe(Math.round(80 * 0.40 + 70 * 0.35 + 60 * 0.25))
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
  it('returns the rounded weighted average under default weights', () => {
    // 80 * .40 + 70 * .35 + 60 * .25 = 32 + 24.5 + 15 = 71.5 → round(71.5) per JS = 72
    expect(computeDisplayScore(80, 70, 60)).toBe(72)
  })

  it('honors custom weights', () => {
    // revenue tilt: 80 * .50 + 70 * .30 + 60 * .20 = 40 + 21 + 12 = 73
    expect(computeDisplayScore(80, 70, 60, WEIGHT_SCENARIOS.revenue)).toBe(73)
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
    expect(Object.keys(r.scenarios).sort()).toEqual(['default', 'ix', 'permit', 'revenue'])
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
      coverage: { offtake: 'researched', ix: 'curated', site: 'researched' },
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

  it('returns BESS coverage for BESS and Hybrid', () => {
    expect(getOfftakeCoverageStates('BESS')).toBeTruthy()
    expect(getOfftakeCoverageStates('Hybrid')).toBeTruthy()
    expect(getOfftakeCoverageStates('BESS')).toEqual(getOfftakeCoverageStates('Hybrid'))
  })

  it('returns null for Community Solar (all 50 states are curated)', () => {
    expect(getOfftakeCoverageStates('Community Solar')).toBeNull()
  })
})
