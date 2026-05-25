// rankStructureRows re-oriented in the 2026-05 signal pivot: ranks the
// monetization structures by their OFFTAKE signal (0-100), not by synthesized
// Year-1 revenue. Available rows rank by offtake desc; gated / un-modeled
// structures (no curated offtake coverage — e.g. Net Billing) sink to the
// bottom regardless of any baseline value.

import { describe, it, expect } from 'vitest'
import { rankStructureRows } from '../../src/lib/structureCompare'

const row = (structure, offtake, available = offtake != null) => ({ structure, offtake, available })

describe('rankStructureRows — "which structure monetizes best here"', () => {
  it('ranks available rows by offtake desc, gated rows last', () => {
    const { ranked, bestKey } = rankStructureRows([
      row('Community Solar', 80),
      row('Net Metering', 82),
      row('C&I Solar', 78),
      row('Net Billing', 45, false), // not modeled → gated
    ])
    expect(ranked.map((r) => r.structure)).toEqual(['Net Metering', 'Community Solar', 'C&I Solar', 'Net Billing'])
    expect(bestKey).toBe('Net Metering')
    expect(ranked[ranked.length - 1].structure).toBe('Net Billing')
  })

  it('keeps every gated row at the bottom regardless of offtake', () => {
    const { ranked } = rankStructureRows([
      row('Net Billing', 99, false), // high offtake but not modeled → still gated
      row('Community Solar', 60),
    ])
    expect(ranked[0].structure).toBe('Community Solar')
    expect(ranked[1].structure).toBe('Net Billing')
  })

  it('bestKey is null when no structure is available', () => {
    const { ranked, bestKey } = rankStructureRows([
      row('Net Billing', 45, false),
      row('C&I Solar', null, false),
    ])
    expect(bestKey).toBeNull()
    expect(ranked).toHaveLength(2)
  })

  it('handles empty / non-array input', () => {
    expect(rankStructureRows([]).ranked).toEqual([])
    expect(rankStructureRows(null).ranked).toEqual([])
    expect(rankStructureRows(undefined).bestKey).toBeNull()
  })
})
