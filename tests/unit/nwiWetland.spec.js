import { describe, it, expect } from 'vitest'
import { categorizeWetland, pctFromAcres, simplifyRing, uspsFromStateFips } from '../../api/scrapers/_nwiWetland.js'

// Pure NWI-ingest helpers behind the incremental wetland cron (Wave 3). The
// network paths (TIGER / NWI fetch) are verified on prod; these pin the math +
// bucketing that turn raw acres into the site signal.

describe('categorizeWetland — buckets match the 15% site-warning line', () => {
  it('buckets on the documented thresholds (<5 / <15 / <40 / >=40)', () => {
    expect(categorizeWetland(0)).toBe('minimal')
    expect(categorizeWetland(4.99)).toBe('minimal')
    expect(categorizeWetland(5)).toBe('moderate')
    expect(categorizeWetland(14.99)).toBe('moderate')
    expect(categorizeWetland(15)).toBe('significant')   // the engine's wetland-warning line
    expect(categorizeWetland(39.99)).toBe('significant')
    expect(categorizeWetland(40)).toBe('severe')
    expect(categorizeWetland(150)).toBe('severe')        // raw % can exceed 100 (polygon overlap)
  })
})

describe('pctFromAcres — wetland % with a guarded denominator', () => {
  it('computes wet/total × 100 rounded to 2 dp', () => {
    expect(pctFromAcres(250, 1000)).toBe(25)
    expect(pctFromAcres(123.456, 1000)).toBe(12.35)
  })
  it('returns 0 (not NaN/Infinity) when the county area is missing or zero', () => {
    expect(pctFromAcres(100, 0)).toBe(0)
    expect(pctFromAcres(100, null)).toBe(0)
    expect(pctFromAcres(100, undefined)).toBe(0)
  })
  it('treats missing wetland acres as zero coverage', () => {
    expect(pctFromAcres(null, 1000)).toBe(0)
  })
})

describe('simplifyRing — downsample to NWI-safe vertex counts', () => {
  it('leaves small rings untouched', () => {
    const ring = [[0, 0], [1, 1], [2, 2]]
    expect(simplifyRing(ring, 200)).toBe(ring)
  })
  it('downsamples a large ring toward the target and keeps the closing vertex', () => {
    const ring = Array.from({ length: 1000 }, (_, i) => [i, i])
    const out = simplifyRing(ring, 200)
    expect(out.length).toBeLessThanOrEqual(210)
    expect(out[out.length - 1]).toEqual(ring[ring.length - 1])  // ring stays closed
  })
})

describe('uspsFromStateFips — FIPS → USPS', () => {
  it('maps known state FIPS (zero-pads single inputs) and nulls the unknown', () => {
    expect(uspsFromStateFips('17')).toBe('IL')
    expect(uspsFromStateFips('6')).toBe('CA')   // zero-pad
    expect(uspsFromStateFips('72')).toBeNull()  // PR / territory — out of scope
  })
})
