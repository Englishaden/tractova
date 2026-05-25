import { describe, it, expect } from 'vitest'
import { rankStructureRows } from '../../src/lib/structureCompare'

const row = (structure, year1, offtake, modeled = year1 != null) => ({ structure, year1, offtake, payback: null, modeled })

describe('rankStructureRows — "which structure pays best"', () => {
  it('ranks modeled rows by Year-1 revenue desc, gated rows last', () => {
    const { ranked, bestKey, bestBy } = rankStructureRows([
      row('Community Solar', 800_000, 80),
      row('Net Metering', 1_200_000, 82),
      row('C&I Solar', 950_000, 82),
      row('Net Billing', null, 45, false),
    ])
    expect(ranked.map((r) => r.structure)).toEqual(['Net Metering', 'C&I Solar', 'Community Solar', 'Net Billing'])
    expect(bestKey).toBe('Net Metering')
    expect(bestBy).toBe('revenue')
    expect(ranked[ranked.length - 1].structure).toBe('Net Billing') // gated always last
  })

  it('keeps every gated row at the bottom regardless of offtake', () => {
    const { ranked } = rankStructureRows([
      row('Net Billing', null, 99, false), // high offtake but no revenue → still gated
      row('Community Solar', 500_000, 60),
    ])
    expect(ranked[0].structure).toBe('Community Solar')
    expect(ranked[1].structure).toBe('Net Billing')
  })

  it('falls back to ranking by offtake when NO structure has revenue data', () => {
    const { ranked, bestKey, bestBy } = rankStructureRows([
      row('Community Solar', null, 70, false),
      row('Net Metering', null, 82, false),
      row('C&I Solar', null, 65, false),
    ])
    expect(bestBy).toBe('offtake')
    expect(bestKey).toBe('Net Metering')
    expect(ranked[0].structure).toBe('Net Metering')
  })

  it('is null-safe on empty / non-array input', () => {
    expect(rankStructureRows([]).ranked).toEqual([])
    expect(rankStructureRows([]).bestKey).toBeNull()
    expect(rankStructureRows(undefined).ranked).toEqual([])
  })
})
