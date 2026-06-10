import { describe, it, expect } from 'vitest'
import {
  normalizeCountyName,
  countyKey,
  rollupProtectedByCounty,
  protectedPct,
  protectedConstraint,
  sqMetersToAcres,
} from '../../api/scrapers/_padusProtected.js'

// Pure PAD-US protected-land helpers (Phase 3b). The name-join + GAP rollup are
// the load-bearing logic (the CSV carries county NAME, not FIPS); these pin the
// normalization that lets the PAD-US CSV join the Census Gazetteer crosswalk.

describe('normalizeCountyName — PAD-US BndryName / Gazetteer NAME → join key', () => {
  it('strips the unit suffix + optional state tail, lowercases', () => {
    expect(normalizeCountyName('Autauga County, AL')).toBe('autauga')
    expect(normalizeCountyName('Autauga County')).toBe('autauga')        // Gazetteer form
    expect(normalizeCountyName('Acadia Parish, LA')).toBe('acadia')
    expect(normalizeCountyName('North Slope Borough, AK')).toBe('north slope')
    expect(normalizeCountyName('Doña Ana County, NM')).toBe('dona ana')
  })
  it('folds St./Ste. to saint/sainte', () => {
    expect(normalizeCountyName('St. Louis County, MO')).toBe('saint louis')
    expect(normalizeCountyName('Ste. Genevieve County, MO')).toBe('sainte genevieve')
  })
  it('keeps an independent city distinct from the like-named county', () => {
    // VA's classic collision: "Richmond County" vs "Richmond city" share a name
    // but different FIPS — the #city tag stops them rolling into one key.
    expect(normalizeCountyName('Richmond County, VA')).toBe('richmond')
    expect(normalizeCountyName('Richmond city, VA')).toBe('richmond #city')
    expect(normalizeCountyName('Baltimore city, MD')).toBe('baltimore #city')
  })
  it('does not mis-tag "City and Borough" (AK) as an independent city', () => {
    expect(normalizeCountyName('Juneau City and Borough, AK')).toBe('juneau')
  })
  it('is empty-safe', () => {
    expect(normalizeCountyName('')).toBe('')
    expect(normalizeCountyName(null)).toBe('')
  })
})

describe('countyKey — STATE::name', () => {
  it('builds a stable cross-source key', () => {
    expect(countyKey('al', 'Autauga County, AL')).toBe('AL::autauga')
    expect(countyKey('MO', 'St. Louis city, MO')).toBe('MO::saint louis #city')
  })
})

describe('rollupProtectedByCounty — sum acres by GAP tier', () => {
  it('counts GAP 1+2 as protected and 1+2+3 separately, ignoring GAP 4', () => {
    const rows = [
      { state: 'VA', boundaryName: 'Roanoke County, VA', gapStatus: '1', acres: 100 },
      { state: 'VA', boundaryName: 'Roanoke County, VA', gapStatus: '2', acres: 50 },
      { state: 'VA', boundaryName: 'Roanoke County, VA', gapStatus: '3', acres: 200 },
      { state: 'VA', boundaryName: 'Roanoke County, VA', gapStatus: '4', acres: 999 },
    ]
    const m = rollupProtectedByCounty(rows)
    const agg = m.get('VA::roanoke')
    expect(agg.gap12Acres).toBe(150)
    expect(agg.gap123Acres).toBe(350)   // GAP 4 excluded
  })
  it('skips rows with null acreage', () => {
    const m = rollupProtectedByCounty([{ state: 'CA', boundaryName: 'Inyo County, CA', gapStatus: '1', acres: null }])
    expect(m.size).toBe(0)
  })
})

describe('protectedPct — GAP 1+2 share of county land', () => {
  it('computes a percentage and caps at 100', () => {
    expect(protectedPct(250, 1000)).toBe(25)
    expect(protectedPct(1200, 1000)).toBe(100)   // vintage overhang → capped
  })
  it('returns null without a land-area denominator', () => {
    expect(protectedPct(100, 0)).toBeNull()
    expect(protectedPct(100, null)).toBeNull()
  })
})

describe('protectedConstraint — protected share → categorical', () => {
  it('buckets minimal / moderate / constrained', () => {
    expect(protectedConstraint(5)).toBe('minimal')
    expect(protectedConstraint(15)).toBe('moderate')   // boundary inclusive
    expect(protectedConstraint(30)).toBe('moderate')
    expect(protectedConstraint(40)).toBe('constrained') // boundary inclusive
    expect(protectedConstraint(72)).toBe('constrained') // many western counties
  })
  it('returns null on no data', () => {
    expect(protectedConstraint(null)).toBeNull()
  })
})

describe('sqMetersToAcres', () => {
  it('converts m² → acres', () => {
    expect(sqMetersToAcres(4046.8564224)).toBeCloseTo(1, 6)
    expect(sqMetersToAcres(0)).toBe(0)
  })
})
