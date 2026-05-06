import { describe, it, expect } from 'vitest'
import { getSliderConfig } from '../../src/lib/scenarioEngine.js'

const baseSolar = (overrides = {}) => ({
  technology: 'community-solar',
  inputs: {
    systemSizeMW: 5,
    capexPerWatt: 1.40,
    ixCostPerWatt: 0.12,
    capacityFactor: 0.20,
    recPricePerMwh: 60,
    programAllocation: 0.95,
    opexPerKwYear: 18,
    discountRate: 0.08,
    contractYears: 25,
    ...overrides,
  },
})

const baseBESS = (overrides = {}) => ({
  technology: 'bess',
  inputs: {
    systemSizeMW: 5,
    capexPerWatt: 1.40,
    ixCostPerWatt: 0.12,
    opexPerKwYear: 18,
    discountRate: 0.08,
    contractYears: 15,
    ...overrides,
  },
})

const findSlider = (sliders, key) => sliders.find(s => s.key === key)

describe('getSliderConfig — null guard', () => {
  it('returns empty array for null baseline', () => {
    expect(getSliderConfig(null)).toEqual([])
    expect(getSliderConfig(undefined)).toEqual([])
  })
})

describe('getSliderConfig — capex range scales with baseline (A.1 fix)', () => {
  it('Cumberland-Maine case: $2.70/W baseline → range ~$1.35 to $4.00 (clamped at ceiling)', () => {
    const cfg = getSliderConfig(baseSolar({ capexPerWatt: 2.70 }))
    const capex = findSlider(cfg, 'capexPerWatt')
    expect(capex.min).toBeCloseTo(1.35, 2)
    // 2.70 * 2.00 = 5.40, clamped to 4.00
    expect(capex.max).toBe(4.00)
    // baseline lives within the range — that was the bug pre-fix
    expect(capex.baseline).toBeGreaterThan(capex.min)
    expect(capex.baseline).toBeLessThan(capex.max)
  })

  it('low-capex case: $1.10/W baseline → range respects $0.60 floor', () => {
    const cfg = getSliderConfig(baseSolar({ capexPerWatt: 1.10 }))
    const capex = findSlider(cfg, 'capexPerWatt')
    // 1.10 * 0.50 = 0.55, clamped to 0.60
    expect(capex.min).toBe(0.60)
    // 1.10 * 2.00 = 2.20
    expect(capex.max).toBeCloseTo(2.20, 2)
  })

  it('disables capex slider when baseline is null', () => {
    const cfg = getSliderConfig(baseSolar({ capexPerWatt: null }))
    const capex = findSlider(cfg, 'capexPerWatt')
    expect(capex.disabled).toBe(true)
    expect(capex.min).toBe(0.80)
    expect(capex.max).toBe(3.00)
  })
})

describe('getSliderConfig — IX cost slider', () => {
  it('floor is exactly $0 (acquired-project case, A.1 fix)', () => {
    const cfg = getSliderConfig(baseSolar({ ixCostPerWatt: 0.20 }))
    const ix = findSlider(cfg, 'ixCostPerWatt')
    expect(ix.min).toBe(0)
  })

  it('max scales with baseline: high-IX state ($0.30 baseline → max ~$0.90)', () => {
    const cfg = getSliderConfig(baseSolar({ ixCostPerWatt: 0.30 }))
    const ix = findSlider(cfg, 'ixCostPerWatt')
    // 0.30 * 3.00 = 0.90; floor max at 0.50
    expect(ix.max).toBeCloseTo(0.90, 2)
  })

  it('max is at least $0.50 even for tiny baselines', () => {
    const cfg = getSliderConfig(baseSolar({ ixCostPerWatt: 0.05 }))
    const ix = findSlider(cfg, 'ixCostPerWatt')
    // 0.05 * 3.00 = 0.15, floor at 0.50
    expect(ix.max).toBe(0.50)
  })
})

describe('getSliderConfig — BESS contract tenor cap (battery-degradation envelope)', () => {
  it('community-solar tenor maxes at 30 years', () => {
    const cfg = getSliderConfig(baseSolar())
    const tenor = findSlider(cfg, 'contractYears')
    expect(tenor.max).toBe(30)
  })

  it('BESS tenor maxes at 20 years', () => {
    const cfg = getSliderConfig(baseBESS())
    const tenor = findSlider(cfg, 'contractYears')
    expect(tenor.max).toBe(20)
  })
})

describe('getSliderConfig — slider direction labels', () => {
  it('lower-better for capex / IX cost / opex / discount rate', () => {
    const cfg = getSliderConfig(baseSolar())
    expect(findSlider(cfg, 'capexPerWatt').direction).toBe('lower-better')
    expect(findSlider(cfg, 'ixCostPerWatt').direction).toBe('lower-better')
    expect(findSlider(cfg, 'opexPerKwYear').direction).toBe('lower-better')
    expect(findSlider(cfg, 'discountRate').direction).toBe('lower-better')
  })

  it('higher-better for capacity factor / REC price / contract tenor', () => {
    const cfg = getSliderConfig(baseSolar())
    expect(findSlider(cfg, 'capacityFactor').direction).toBe('higher-better')
    expect(findSlider(cfg, 'recPricePerMwh').direction).toBe('higher-better')
    expect(findSlider(cfg, 'contractYears').direction).toBe('higher-better')
  })

  it('neutral for system size (revenue + capex offset each other on payback)', () => {
    const cfg = getSliderConfig(baseSolar())
    expect(findSlider(cfg, 'systemSizeMW').direction).toBe('neutral')
  })
})

describe('getSliderConfig — tech-specific shape', () => {
  it('community-solar exposes program allocation slider', () => {
    expect(findSlider(getSliderConfig(baseSolar()), 'programAllocation')).toBeTruthy()
  })

  it('BESS does not expose program allocation slider', () => {
    expect(findSlider(getSliderConfig(baseBESS()), 'programAllocation')).toBeFalsy()
  })

  it('BESS does not expose REC price slider', () => {
    expect(findSlider(getSliderConfig(baseBESS()), 'recPricePerMwh')).toBeFalsy()
  })
})
