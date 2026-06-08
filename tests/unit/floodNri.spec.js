import { describe, it, expect } from 'vitest'
import { normalizeNriRating, isFloodConstrained, worstFlood } from '../../api/scrapers/_floodNri.js'

// Pure FEMA NRI flood helpers behind the county flood ingest (Wave 3). The
// network/upsert path verifies on prod; these pin the rating normalization +
// worst-of-two that turn NRI's inland/coastal fields into the site signal.

describe('normalizeNriRating — NRI strings → canonical tokens', () => {
  it('maps the five rated levels (case/space-insensitive)', () => {
    expect(normalizeNriRating('Very High')).toBe('very_high')
    expect(normalizeNriRating('relatively high')).toBe('relatively_high')
    expect(normalizeNriRating('Relatively Moderate')).toBe('relatively_moderate')
    expect(normalizeNriRating('Relatively Low')).toBe('relatively_low')
    expect(normalizeNriRating('VERY LOW')).toBe('very_low')
  })
  it('collapses unrated / insufficient / blank / null to none', () => {
    expect(normalizeNriRating('No Rating')).toBe('none')
    expect(normalizeNriRating('Insufficient Data')).toBe('none')
    expect(normalizeNriRating('Not Applicable')).toBe('none')
    expect(normalizeNriRating('')).toBe('none')
    expect(normalizeNriRating(null)).toBe('none')
  })
})

describe('isFloodConstrained — only the top two ratings warn', () => {
  it('flags relatively_high + very_high, nothing lower', () => {
    expect(isFloodConstrained('very_high')).toBe(true)
    expect(isFloodConstrained('relatively_high')).toBe(true)
    expect(isFloodConstrained('relatively_moderate')).toBe(false)
    expect(isFloodConstrained('relatively_low')).toBe(false)
    expect(isFloodConstrained('very_low')).toBe(false)
    expect(isFloodConstrained('none')).toBe(false)
  })
})

describe('worstFlood — combine inland + coastal into the county signal', () => {
  it('takes the worse rating and the higher score', () => {
    const r = worstFlood('Relatively Low', 22.5, 'Very High', 81.2)
    expect(r.rating).toBe('very_high')
    expect(r.score).toBe(81.2)
  })
  it('inland worse than coastal → inland wins', () => {
    const r = worstFlood('Relatively High', 60, 'Very Low', 5)
    expect(r.rating).toBe('relatively_high')
    expect(r.score).toBe(60)
  })
  it('neither rated → none + null score (no data, no penalty downstream)', () => {
    const r = worstFlood('No Rating', null, 'Not Applicable', undefined)
    expect(r.rating).toBe('none')
    expect(r.score).toBeNull()
  })
  it('one side unrated → uses the rated side', () => {
    const r = worstFlood('Insufficient Data', null, 'Relatively Moderate', 40)
    expect(r.rating).toBe('relatively_moderate')
    expect(r.score).toBe(40)
  })
})
