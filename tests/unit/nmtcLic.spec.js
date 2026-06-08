import { describe, it, expect } from 'vitest'
import { normalizeFips, parseTractRow, tractQualifies, rollupByCounty } from '../../api/scrapers/_nmtcLic.js'

// Pure NMTC LIC helpers behind the §48(e) Cat 1 ingest. The network/upsert path
// reads a committed artifact + verifies on prod; these pin the FIPS
// normalization (Excel drops leading zeros on numeric cells) + the tract→county
// rollup + gating that turn the DOE tract file into the per-county LIC signal.

const FIPS_TO_USPS = { '01': 'AL', '06': 'CA', '28': 'MS', '36': 'NY' }  // 72 (PR) deliberately absent

describe('normalizeFips — zero-pad FIPS regardless of string/number input', () => {
  it('pads numeric cells that lost leading zeros', () => {
    expect(normalizeFips(1001, 5)).toBe('01001')          // AL Autauga as a number
    expect(normalizeFips(1, 2)).toBe('01')                // state 01 stored as 1
    expect(normalizeFips(1001020100, 11)).toBe('01001020100')  // 10-digit AL tract GEOID
  })
  it('passes through already-correct strings', () => {
    expect(normalizeFips('28059', 5)).toBe('28059')
    expect(normalizeFips('01001020100', 11)).toBe('01001020100')
  })
  it('strips stray non-digits; empty/null → null', () => {
    expect(normalizeFips('01001 ', 5)).toBe('01001')
    expect(normalizeFips('', 5)).toBeNull()
    expect(normalizeFips(null, 5)).toBeNull()
  })
})

describe('parseTractRow — sheet row → normalized tract', () => {
  it('derives county FIPS from StateCountyFIPS (numeric → padded)', () => {
    const t = parseTractRow({ GEOID_2023: 1001020100, StateCountyFIPS: 1001, CountyName: 'Autauga', NMTC_2020_pct: 100 })
    expect(t.countyFips).toBe('01001')
    expect(t.geoid).toBe('01001020100')
    expect(t.countyName).toBe('Autauga')
    expect(t.nmtcPct).toBe(100)
  })
  it('falls back to StateFIPS + CountyFIPS when StateCountyFIPS is missing', () => {
    const t = parseTractRow({ GEOID_2023: '28059040802', StateFIPS: '28', CountyFIPS: '059', NMTC_2020_pct: 0 })
    expect(t.countyFips).toBe('28059')
    expect(t.nmtcPct).toBe(0)
  })
  it('unparseable pct → null', () => {
    const t = parseTractRow({ StateCountyFIPS: '06037', NMTC_2020_pct: '' })
    expect(t.nmtcPct).toBeNull()
  })
})

describe('tractQualifies — > threshold, default any eligible land', () => {
  it('default (>0): any positive % qualifies, 0/null do not', () => {
    expect(tractQualifies(0.1)).toBe(true)
    expect(tractQualifies(100)).toBe(true)
    expect(tractQualifies(0)).toBe(false)
    expect(tractQualifies(null)).toBe(false)
    expect(tractQualifies(undefined)).toBe(false)
  })
  it('predominantly-LIC alternative (minPct=50): strict majority', () => {
    expect(tractQualifies(49, 50)).toBe(false)
    expect(tractQualifies(50, 50)).toBe(false)
    expect(tractQualifies(51, 50)).toBe(true)
  })
})

describe('rollupByCounty — tracts → per-county counts, gated to tracked FIPS', () => {
  const tracts = [
    { geoid: '01001020100', countyFips: '01001', countyName: 'Autauga', nmtcPct: 100 },
    { geoid: '01001020200', countyFips: '01001', countyName: 'Autauga', nmtcPct: 0 },
    { geoid: '06037000100', countyFips: '06037', countyName: 'Los Angeles', nmtcPct: 0.5 },
    { geoid: '72001956700', countyFips: '72001', countyName: 'Adjuntas', nmtcPct: 100 }, // PR — must be gated out
    { geoid: null,          countyFips: '0103',  countyName: 'bad',     nmtcPct: 100 }, // malformed 4-digit FIPS — skip
  ]
  it('counts total + qualifying per county and maps USPS', () => {
    const rows = rollupByCounty(tracts, FIPS_TO_USPS)
    const al = rows.find(r => r.county_fips === '01001')
    expect(al).toMatchObject({ state: 'AL', county_name: 'Autauga', total_tracts_in_county: 2, qualifying_tracts_count: 1 })
    expect(al.sample_geoids).toEqual(['01001020100'])
    const la = rows.find(r => r.county_fips === '06037')
    expect(la).toMatchObject({ state: 'CA', total_tracts_in_county: 1, qualifying_tracts_count: 1 })
  })
  it('drops untracked-state (PR) and malformed FIPS', () => {
    const rows = rollupByCounty(tracts, FIPS_TO_USPS)
    expect(rows.find(r => r.county_fips === '72001')).toBeUndefined()
    expect(rows.find(r => r.county_fips === '0103')).toBeUndefined()
    expect(rows.every(r => r.county_fips.length === 5)).toBe(true)
  })
  it('caps the sample_geoids list', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      geoid: `01003${String(i).padStart(6, '0')}`, countyFips: '01003', countyName: 'Baldwin', nmtcPct: 100,
    }))
    const rows = rollupByCounty(many, FIPS_TO_USPS, { sampleCap: 12 })
    expect(rows[0].qualifying_tracts_count).toBe(30)
    expect(rows[0].sample_geoids).toHaveLength(12)
  })
})
