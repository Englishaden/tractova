import { describe, it, expect } from 'vitest'
import { extractTractGeoid } from '../../api/handlers/_tractGeoid.js'

// Pure parser for the US Census Geocoder response behind the optional
// address→census-tract LIC lookup (Phase 2). The network/DB path verifies on
// prod; this pins the response-shape extraction + the not-a-match cases.

const fullResp = {
  result: {
    addressMatches: [{
      matchedAddress: '4600 SILVER HILL RD, WASHINGTON, DC, 20233',
      geographies: {
        'Census Tracts': [{ GEOID: '24033802405' }],
        'Counties':      [{ GEOID: '24033' }],
      },
    }],
  },
}

describe('extractTractGeoid — Census Geocoder response → tract + county', () => {
  it('extracts tract, county, and matchedAddress from a full match', () => {
    expect(extractTractGeoid(fullResp)).toEqual({
      tractGeoid: '24033802405',
      countyGeoid: '24033',
      matchedAddress: '4600 SILVER HILL RD, WASHINGTON, DC, 20233',
    })
  })
  it('derives county from the tract prefix when Counties is absent', () => {
    const r = { result: { addressMatches: [{ geographies: { 'Census Tracts': [{ GEOID: '06037206050' }] } }] } }
    expect(extractTractGeoid(r)).toMatchObject({ tractGeoid: '06037206050', countyGeoid: '06037', matchedAddress: null })
  })
  it('returns null when nothing matched / empty / null', () => {
    expect(extractTractGeoid({ result: { addressMatches: [] } })).toBeNull()
    expect(extractTractGeoid({})).toBeNull()
    expect(extractTractGeoid(null)).toBeNull()
  })
  it('returns null on a malformed (non-11-digit) tract GEOID', () => {
    expect(extractTractGeoid({ result: { addressMatches: [{ geographies: { 'Census Tracts': [{ GEOID: 'abc' }] } }] } })).toBeNull()
    expect(extractTractGeoid({ result: { addressMatches: [{ geographies: {} }] } })).toBeNull()
    expect(extractTractGeoid({ result: { addressMatches: [{ geographies: { 'Census Tracts': [{ GEOID: '2403380240' }] } }] } })).toBeNull()
  })
})
