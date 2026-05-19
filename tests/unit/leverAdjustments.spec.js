import { describe, it, expect } from 'vitest'
import { applyLeverAdjustments } from '../../src/lib/leverAdjustments.js'

const baseSubScores = (overrides = {}) => ({
  offtake: 60,
  ix: 50,
  site: 70,
  policyClimate: 50,
  coverage: { offtake: 'researched', ix: 'curated', site: 'live', policy: 'live' },
  ...overrides,
})

// Defaults chosen to produce a "neutral" baseline — codYear 2029 (36 mo out)
// with a light 12-mo IX queue clears the (months + 12 buffer) timeline check
// without tripping into the buffer-bonus tier (which needs ≥18 mo queue).
// So under defaults, all three deltas (subscription, COD, IX assumption)
// return 0 — easy to isolate a single lever per test.
const baseLevers = (overrides = {}) => ({
  subscriptionPct: 80,
  codYear: 2029,
  ixAssumption: 'queue',
  ...overrides,
})

const baseContext = (overrides = {}) => ({
  technology: 'Community Solar',
  ixQueueSummary: { avgStudyMonths: 12, totalProjects: 50, totalMW: 400 },
  ...overrides,
})

describe('applyLeverAdjustments — subscription delta', () => {
  it('80% subscription leaves offtake unchanged', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ subscriptionPct: 80 }), baseContext())
    expect(r.deltas.offtake).toBe(0)
    expect(r.adjusted.offtake).toBe(60)
  })

  it('45% subscription docks offtake by 5', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ subscriptionPct: 45 }), baseContext())
    expect(r.deltas.offtake).toBe(-5)
    expect(r.adjusted.offtake).toBe(55)
    expect(r.rationale.find(x => x.pillar === 'Offtake')).toBeDefined()
  })

  it('95% subscription bumps offtake by 3', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ subscriptionPct: 95 }), baseContext())
    expect(r.deltas.offtake).toBe(3)
    expect(r.adjusted.offtake).toBe(63)
  })

  it('subscription is no-op for BESS / C&I (CS-specific lever)', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ subscriptionPct: 45 }),
      baseContext({ technology: 'BESS' }),
    )
    expect(r.deltas.offtake).toBe(0)
  })
})

describe('applyLeverAdjustments — COD timeline delta', () => {
  it('COD 2026 with 18-mo IX queue is too tight (need 30 mo), docks IX', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ codYear: 2026, ixAssumption: 'queue' }),
      baseContext({ ixQueueSummary: { avgStudyMonths: 18, totalProjects: 100, totalMW: 800 } }),
    )
    expect(r.deltas.ix).toBe(-8)
    expect(r.adjusted.ix).toBe(42)
  })

  it('COD 2030 with 24-mo IX queue gives buffer bonus', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ codYear: 2030, ixAssumption: 'queue' }),
      baseContext({ ixQueueSummary: { avgStudyMonths: 24, totalProjects: 100, totalMW: 800 } }),
    )
    expect(r.deltas.ix).toBe(3)
    expect(r.adjusted.ix).toBe(53)
  })

  it('COD logic is no-op when ixQueueSummary missing (live IX data not wired)', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ codYear: 2026 }),
      baseContext({ ixQueueSummary: null }),
    )
    expect(r.deltas.ix).toBe(0)
  })
})

describe('applyLeverAdjustments — IX assumption delta', () => {
  it('stand in queue is the baseline (0 delta)', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ ixAssumption: 'queue' }), baseContext())
    expect(r.deltas.ix).toBe(0)
  })

  it('acquire position adds +6 to IX', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ ixAssumption: 'acquire' }), baseContext())
    expect(r.deltas.ix).toBe(6)
    expect(r.adjusted.ix).toBe(56)
  })

  it('distribution fast-track adds +10 to IX', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers({ ixAssumption: 'distribution' }), baseContext())
    expect(r.deltas.ix).toBe(10)
    expect(r.adjusted.ix).toBe(60)
  })
})

describe('applyLeverAdjustments — IX cap stacking', () => {
  it('COD bonus + distribution stacks but clamps at +10', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ codYear: 2030, ixAssumption: 'distribution' }),
      baseContext({ ixQueueSummary: { avgStudyMonths: 24, totalProjects: 100, totalMW: 800 } }),
    )
    // raw: +3 (COD) + 10 (distribution) = +13 → clamped to +10
    expect(r.deltas.ix).toBe(10)
    expect(r.adjusted.ix).toBe(60)
    // both rationale rows still recorded so user sees what fired
    const ixRationale = r.rationale.filter(x => x.pillar === 'IX')
    expect(ixRationale.length).toBe(2)
  })

  it('COD penalty + acquire partially offset (negative + positive)', () => {
    const r = applyLeverAdjustments(
      baseSubScores(),
      baseLevers({ codYear: 2026, ixAssumption: 'acquire' }),
      baseContext({ ixQueueSummary: { avgStudyMonths: 18, totalProjects: 100, totalMW: 800 } }),
    )
    // raw: -8 (COD too tight) + 6 (acquire) = -2
    expect(r.deltas.ix).toBe(-2)
    expect(r.adjusted.ix).toBe(48)
  })
})

describe('applyLeverAdjustments — score clamping', () => {
  it('does not push offtake above 100', () => {
    const r = applyLeverAdjustments(baseSubScores({ offtake: 99 }), baseLevers({ subscriptionPct: 95 }), baseContext())
    // +3 from subscription → 99 + 3 = 102 → clamped 100
    expect(r.adjusted.offtake).toBe(100)
  })

  it('does not push ix below 0', () => {
    const r = applyLeverAdjustments(
      baseSubScores({ ix: 5 }),
      baseLevers({ codYear: 2026 }),
      baseContext({ ixQueueSummary: { avgStudyMonths: 24, totalProjects: 100, totalMW: 800 } }),
    )
    // -8 from COD on baseline 5 → -3 → clamped 0
    expect(r.adjusted.ix).toBe(0)
  })
})

describe('applyLeverAdjustments — defensive null handling', () => {
  it('returns 0 deltas when subScores is null', () => {
    const r = applyLeverAdjustments(null, baseLevers(), baseContext())
    expect(r.deltas).toEqual({ offtake: 0, ix: 0, site: 0 })
    expect(r.rationale).toEqual([])
  })

  it('handles missing levers gracefully', () => {
    const r = applyLeverAdjustments(baseSubScores(), {}, baseContext())
    expect(r.deltas).toEqual({ offtake: 0, ix: 0, site: 0 })
  })

  it('handles missing context gracefully', () => {
    const r = applyLeverAdjustments(baseSubScores(), baseLevers(), {})
    // subscription delta is non-CS-aware without technology, defaults to no-op
    expect(r.deltas.offtake).toBe(0)
  })
})
