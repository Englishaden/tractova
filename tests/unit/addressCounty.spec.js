import { describe, it, expect } from 'vitest'
import { countyForFips, normCountyName, classifyCountyMatch } from '../../src/lib/addressCounty.js'

// Address-wins county consistency: an entered address resolves to a census tract
// AND its county GEOID. These pin that we correctly name the address's county
// from the bundled crosswalk and detect when it disagrees with the picked county
// (Aden's prod-review case: county Grundy 17063 + address in Sangamon 17167).

describe('countyForFips', () => {
  it('names a known county from its 5-digit FIPS', () => {
    expect(countyForFips('17063')).toEqual({ state: 'IL', countyName: 'Grundy' })
    expect(countyForFips('17167')).toEqual({ state: 'IL', countyName: 'Sangamon' })
  })
  it('returns null for an unknown / malformed FIPS', () => {
    expect(countyForFips('99999')).toBeNull()
    expect(countyForFips(undefined)).toBeNull()
    expect(countyForFips('17')).toBeNull()
  })
})

describe('normCountyName', () => {
  it('strips type words, (city) marker, post-comma, and case', () => {
    expect(normCountyName('Sangamon County')).toBe('sangamon')
    expect(normCountyName('Baltimore (city)')).toBe('baltimore')
    expect(normCountyName('St. Louis city, MO')).toBe('st. louis')
    expect(normCountyName('Grundy')).toBe('grundy')
  })
})

describe('classifyCountyMatch', () => {
  const sangamon = { ok: true, countyGeoid: '17167', tractGeoid: '17167000501' }

  it('match — address county equals the picked county', () => {
    expect(classifyCountyMatch(sangamon, 'IL', 'Sangamon').verdict).toBe('match')
    expect(classifyCountyMatch(sangamon, 'IL', 'Sangamon County').verdict).toBe('match')
  })
  it('mismatch — address in a different county than picked (the prod-review bug)', () => {
    const r = classifyCountyMatch(sangamon, 'IL', 'Grundy')
    expect(r.verdict).toBe('mismatch')
    expect(r.addrCounty).toEqual({ state: 'IL', countyName: 'Sangamon' })
  })
  it('mismatch — address in a different STATE than picked', () => {
    // 29189 = St. Louis County, MO. Picked IL → cross-state mismatch.
    expect(classifyCountyMatch({ ok: true, countyGeoid: '29189' }, 'IL', 'Madison').verdict).toBe('mismatch')
  })
  it('unknown — fail open when county not picked yet, FIPS unknown, or no geoid', () => {
    expect(classifyCountyMatch(sangamon, 'IL', '').verdict).toBe('unknown')
    expect(classifyCountyMatch({ ok: true, countyGeoid: '99999' }, 'IL', 'Grundy').verdict).toBe('unknown')
    expect(classifyCountyMatch({ ok: true }, 'IL', 'Grundy').verdict).toBe('unknown')
  })
})
