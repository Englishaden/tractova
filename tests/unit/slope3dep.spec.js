import { describe, it, expect } from 'vitest'
import {
  gradePctToDegrees,
  DEVELOPABLE_SLOPE_DEG,
  pctBelowDegrees,
  summarizeSlope,
  slopeConstraint,
} from '../../api/scrapers/_slope3dep.js'

// Pure 3DEP slope helpers behind the county terrain ingest (Phase 3a). The
// network/upsert path verifies via the seed probe; these pin the histogram →
// developable-share math + the categorical thresholds.

describe('gradePctToDegrees — grade % → slope degrees', () => {
  it('converts known grades', () => {
    expect(gradePctToDegrees(0)).toBe(0)
    expect(gradePctToDegrees(100)).toBeCloseTo(45, 5)        // 100% grade = 45°
    expect(gradePctToDegrees(10)).toBeCloseTo(5.7106, 3)     // developable line
    expect(gradePctToDegrees(5)).toBeCloseTo(2.8624, 3)
  })
  it('exports the developable threshold at ~5.71°', () => {
    expect(DEVELOPABLE_SLOPE_DEG).toBeCloseTo(5.7106, 3)
  })
})

describe('pctBelowDegrees — share of a slope histogram below a threshold', () => {
  it('sums whole bins below the threshold', () => {
    // bins: [0,2),[2,4),[4,6),[6,8) deg — 100 px each; threshold 4° → 200/400
    const hist = { size: 4, min: 0, max: 8, counts: [100, 100, 100, 100] }
    expect(pctBelowDegrees(hist, 4)).toBeCloseTo(50, 5)
  })
  it('interpolates across the straddling bin', () => {
    // threshold 3° falls halfway through bin [2,4): 100 + 0.5*100 = 150 / 400
    const hist = { size: 4, min: 0, max: 8, counts: [100, 100, 100, 100] }
    expect(pctBelowDegrees(hist, 3)).toBeCloseTo(37.5, 5)
  })
  it('returns 100 when every bin is below the threshold', () => {
    const hist = { size: 2, min: 0, max: 4, counts: [50, 50] }
    expect(pctBelowDegrees(hist, 99)).toBeCloseTo(100, 5)
  })
  it('returns null on empty / malformed histograms', () => {
    expect(pctBelowDegrees(null, 5)).toBeNull()
    expect(pctBelowDegrees({ size: 0, min: 0, max: 0, counts: [] }, 5)).toBeNull()
    expect(pctBelowDegrees({ size: 4, min: 5, max: 5, counts: [1, 1, 1, 1] }, 5)).toBeNull()
  })
})

describe('summarizeSlope — 3DEP response → stored signal', () => {
  it('pulls mean/max + developable share', () => {
    const resp = {
      statistics: [{ mean: 0.69, max: 39, min: 0 }],
      histograms: [{ size: 4, min: 0, max: 8, counts: [400, 0, 0, 0] }], // all ≤2°
    }
    const s = summarizeSlope(resp)
    expect(s.meanDeg).toBe(0.69)
    expect(s.maxDeg).toBe(39)
    expect(s.developablePct).toBeCloseTo(100, 5)
  })
  it('returns null when stats or histogram are missing', () => {
    expect(summarizeSlope({ statistics: [], histograms: [] })).toBeNull()
    expect(summarizeSlope({ statistics: [{ mean: 1 }] })).toBeNull()
    expect(summarizeSlope(null)).toBeNull()
  })
})

describe('slopeConstraint — developable share → categorical', () => {
  it('buckets ample / moderate / constrained', () => {
    expect(slopeConstraint(95)).toBe('ample')        // Grundy IL-like
    expect(slopeConstraint(70)).toBe('ample')        // boundary inclusive
    expect(slopeConstraint(55)).toBe('moderate')
    expect(slopeConstraint(40)).toBe('moderate')     // boundary inclusive
    expect(slopeConstraint(37)).toBe('constrained')  // Mineral WV-like
  })
  it('returns null on no data', () => {
    expect(slopeConstraint(null)).toBeNull()
    expect(slopeConstraint(NaN)).toBeNull()
  })
})
