import { describe, it, expect } from 'vitest'
import { classifyVerdict, verdictRationale } from '../../src/components/scenario/DevFeasibilityView'

describe('classifyVerdict — band classification', () => {
  it('null composite returns null (data not loaded)', () => {
    expect(classifyVerdict(null)).toBe(null)
    expect(classifyVerdict(undefined)).toBe(null)
  })

  it('composite >= 70 → go', () => {
    expect(classifyVerdict(70)).toBe('go')
    expect(classifyVerdict(85)).toBe('go')
    expect(classifyVerdict(100)).toBe('go')
  })

  it('50 ≤ composite < 70 → caution', () => {
    expect(classifyVerdict(50)).toBe('caution')
    expect(classifyVerdict(60)).toBe('caution')
    expect(classifyVerdict(69)).toBe('caution')
  })

  it('composite < 50 → nogo', () => {
    expect(classifyVerdict(49)).toBe('nogo')
    expect(classifyVerdict(25)).toBe('nogo')
    expect(classifyVerdict(0)).toBe('nogo')
  })
})

describe('verdictRationale — pillar-specific actionable friction', () => {
  const subScoresWith = (weakest) => {
    // Build a sub-score shape where the named pillar is lowest.
    const base = { offtake: 75, ix: 75, site: 75, policyClimate: 75 }
    base[weakest] = 30
    return base
  }

  it('Offtake-weakest + CS active + tight capacity surfaces capacity warning', () => {
    const r = verdictRationale('caution', subScoresWith('offtake'), {
      stateProgram: { csStatus: 'active', capacityMW: 100, lmiRequired: false },
      technology: 'Community Solar',
      stateName: 'New York',
    })
    expect(r).toMatch(/100 MW capacity remaining/)
    expect(r).toMatch(/Offtake 30/)
  })

  it('Offtake-weakest + CS none surfaces "no active CS program"', () => {
    const r = verdictRationale('nogo', subScoresWith('offtake'), {
      stateProgram: { csStatus: 'none' },
      technology: 'Community Solar',
      stateName: 'Texas',
    })
    expect(r).toMatch(/no active CS program/)
    expect(r).toMatch(/Texas/)
  })

  it('Offtake-weakest + CS active + LMI ≥40% surfaces LMI subscriber warning', () => {
    const r = verdictRationale('caution', subScoresWith('offtake'), {
      stateProgram: { csStatus: 'active', capacityMW: 1000, lmiRequired: true, lmiPercent: 50 },
      technology: 'Community Solar',
      stateName: 'Illinois',
    })
    expect(r).toMatch(/50% LMI carve-out/)
    expect(r).toMatch(/subscriber pipeline/)
  })

  it('IX-weakest + live queue ≥18mo surfaces queue verification step', () => {
    const r = verdictRationale('caution', subScoresWith('ix'), {
      ixQueueSummary: { avgStudyMonths: 24, totalProjects: 100, totalMW: 800 },
      stateProgram: { ixDifficulty: 'moderate' },
      stateName: 'Pennsylvania',
    })
    expect(r).toMatch(/24-mo avg study window/)
    expect(r).toMatch(/queue position/)
  })

  it('IX-weakest + very_hard curated tier surfaces cluster-study warning', () => {
    const r = verdictRationale('caution', subScoresWith('ix'), {
      ixQueueSummary: null,
      stateProgram: { ixDifficulty: 'very_hard' },
      stateName: 'California',
    })
    expect(r).toMatch(/very hard/)
    expect(r).toMatch(/cluster-study/)
  })

  it('Site-weakest + high wetland surfaces parcel-screening action', () => {
    const r = verdictRationale('caution', subScoresWith('site'), {
      countyData: { geospatial: { wetlandCoveragePct: 38, primeFarmlandPct: 10 } },
      countyName: 'Norfolk',
    })
    expect(r).toMatch(/Norfolk County/)
    expect(r).toMatch(/wetland coverage 38%/)
    expect(r).toMatch(/Section 404/)
  })

  it('Site-weakest + high prime farmland surfaces ag-protection diligence', () => {
    const r = verdictRationale('caution', subScoresWith('site'), {
      countyData: { geospatial: { wetlandCoveragePct: 5, primeFarmlandPct: 55 } },
      countyName: 'Champaign',
    })
    expect(r).toMatch(/prime farmland 55%/)
    expect(r).toMatch(/ag-land protections/)
  })

  it('Policy weakest pillar surfaces top headwind event over structural pillar', () => {
    const subScores = { offtake: 80, ix: 75, site: 70, policyClimate: 30 }
    const r = verdictRationale('caution', subScores, {
      stateName: 'Maine',
      headwindPolicies: [{ event_name: 'LD 1234 — distribution-tied cap cut' }],
    })
    expect(r).toMatch(/active headwind/)
    expect(r).toMatch(/LD 1234/)
  })

  it('go verdict frames rationale as "watch X" instead of "X is the friction"', () => {
    const r = verdictRationale('go', subScoresWith('site'), {
      countyData: { geospatial: { wetlandCoveragePct: 30, primeFarmlandPct: 10 } },
      countyName: 'Cumberland',
    })
    expect(r).toMatch(/All pillars clear/)
    expect(r).toMatch(/Watch Site/)
    expect(r).toMatch(/wetland coverage/)
  })

  it('falls back gracefully when pillar metadata is missing', () => {
    const r = verdictRationale('caution', subScoresWith('site'), {
      // countyData omitted entirely
      countyName: 'Somewhere',
    })
    expect(r).toMatch(/Site 30/)
    // Generic fallback should still produce a non-empty actionable line
    expect(r.length).toBeGreaterThan(20)
  })
})
