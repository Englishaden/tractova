import { describe, it, expect } from 'vitest'
import { scoreSavedProject, computeSubScores, safeScore } from '../../src/lib/scoreEngine.js'

// The 2026-06 data audit found that saved projects scored differently on the
// Library vs the Lens because each surface called computeSubScores with a
// different argument set (the Library never fed incentives/policy). scoreSavedProject
// is the canonical helper that ends that drift. These tests pin parity.

const NY = { id: 'NY', csStatus: 'active', capacityMW: 600, ixDifficulty: 'moderate' }
const FULL_INCENTIVES = {
  energyCommunity: { isEnergyCommunity: true },
  nmtcLic: { isEligible: true },
  hudQctDda: null,
}

describe('scoreSavedProject — Library == Lens parity', () => {
  it('matches the Lens computeSubScores call for the identical project + inputs', () => {
    const project = { mw: 5, stage: 'Development', technology: 'Community Solar', codTargetYear: 2029 }

    // Lens path (mirrors src/pages/Search.jsx:380-388 — the full 5-pillar feed).
    const lensSubs = computeSubScores(NY, null, 'Development', 'Community Solar', null, null, 5, {
      incentives: FULL_INCENTIVES,
      codYear: 2029,
    })
    const lensScore = safeScore(lensSubs)

    // Library path via the canonical helper.
    const { subs, score } = scoreSavedProject(project, NY, null, { incentives: FULL_INCENTIVES })

    expect(score).toBe(lensScore)
    expect(subs.offtake).toBe(lensSubs.offtake)
    expect(subs.ix).toBe(lensSubs.ix)
    expect(subs.site).toBe(lensSubs.site)
    expect(subs.incentives).toBe(lensSubs.incentives)
    expect(subs.policyTiming).toBe(lensSubs.policyTiming)
  })

  it('includes all 5 pillars when incentives are fed', () => {
    const project = { mw: 5, stage: 'Development', technology: 'Community Solar', codTargetYear: 2029 }
    const { subs } = scoreSavedProject(project, NY, null, { incentives: FULL_INCENTIVES })
    for (const k of ['offtake', 'ix', 'site', 'incentives', 'policyTiming']) {
      expect(Number.isFinite(subs[k]), `${k} should be finite`).toBe(true)
    }
  })

  it('rebalances (no fabricated baseline) when incentives are omitted — the old Library behavior', () => {
    const project = { mw: 5, stage: 'Development', technology: 'Community Solar', codTargetYear: 2029 }
    const { subs, score } = scoreSavedProject(project, NY, null, {})
    expect(subs.incentives).toBeNull()
    expect(Number.isFinite(score)).toBe(true)
  })

  it('a county qualifying for the ITC adder stack lifts the composite vs no-incentives (the divergence the audit found)', () => {
    const project = { mw: 5, stage: 'Development', technology: 'Community Solar', codTargetYear: 2029 }
    const withInc = scoreSavedProject(project, NY, null, { incentives: FULL_INCENTIVES }).score
    const withoutInc = scoreSavedProject(project, NY, null, {}).score
    expect(withInc).toBeGreaterThan(withoutInc)
  })

  it('returns a null shape when stateProgram is missing (state still hydrating)', () => {
    const project = { mw: 5, stage: 'Development', technology: 'Community Solar' }
    expect(scoreSavedProject(project, null)).toEqual({ subs: null, score: null })
  })
})
