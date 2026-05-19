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
    capexPerWatt: null,           // BESS prices in $/kWh, not $/W
    capexPerKwh: 400,             // NREL ATB 2024 utility-scale 4-hr (NY-equivalent)
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
  it('Cumberland-Maine case: $2.70/W baseline → range $1.35 to $5.40 (proportional, no ceiling)', () => {
    const cfg = getSliderConfig(baseSolar({ capexPerWatt: 2.70 }))
    const capex = findSlider(cfg, 'capexPerWatt')
    expect(capex.min).toBeCloseTo(1.35, 2)
    // F.3 (2026-05-08): hardcoded $4.00 ceiling removed — was squeezing
    // high-cost states (HI 3.80, MA 3.31, CT 3.12) against the right
    // edge with no upside-sensitivity headroom. baseline×2 alone bounds.
    expect(capex.max).toBeCloseTo(5.40, 2)
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

describe('getSliderConfig — BESS $/kWh capex slider (F.8)', () => {
  it('BESS gets a $/kWh slider, not a $/W slider', () => {
    const cfg = getSliderConfig(baseBESS())
    expect(findSlider(cfg, 'capexPerKwh')).toBeDefined()
    expect(findSlider(cfg, 'capexPerWatt')).toBeUndefined()
  })

  it('range is baseline × 0.5 to baseline × 2 (NREL ATB 2024 P10/P90 envelope)', () => {
    const cfg = getSliderConfig(baseBESS({ capexPerKwh: 400 }))
    const capex = findSlider(cfg, 'capexPerKwh')
    expect(capex.min).toBe(200)   // 400 × 0.5
    expect(capex.max).toBe(800)   // 400 × 2.0
    expect(capex.unit).toBe('$/kWh')
    expect(capex.direction).toBe('lower-better')
  })

  it('floor clamps at $150/kWh (2030 NREL advanced + safety margin)', () => {
    // very low baseline shouldn't push the floor below $150/kWh
    const cfg = getSliderConfig(baseBESS({ capexPerKwh: 200 }))
    const capex = findSlider(cfg, 'capexPerKwh')
    expect(capex.min).toBe(150)
  })

  it('disables + falls back when baseline is null', () => {
    const cfg = getSliderConfig(baseBESS({ capexPerKwh: null }))
    const capex = findSlider(cfg, 'capexPerKwh')
    expect(capex.disabled).toBe(true)
    expect(capex.format(null)).toBe('—')
  })

  it('format uses $/kWh, no decimals', () => {
    const cfg = getSliderConfig(baseBESS())
    const capex = findSlider(cfg, 'capexPerKwh')
    expect(capex.format(380)).toBe('$380/kWh')
  })

  it('CS does NOT get a $/kWh slider (would confuse users)', () => {
    const cfg = getSliderConfig(baseSolar())
    expect(findSlider(cfg, 'capexPerKwh')).toBeUndefined()
    expect(findSlider(cfg, 'capexPerWatt')).toBeDefined()
  })
})

describe('getSliderConfig — Hybrid (G.2: dual capex sliders)', () => {
  const baseHybrid = (overrides = {}) => ({
    technology: 'hybrid',
    inputs: {
      systemSizeMW: 5,
      capexPerWatt: 1.40,           // solar arm
      capexPerKwh: 400,             // storage arm
      capacityFactor: 0.18,
      ixCostPerWatt: 0.12,
      opexPerKwYear: 18,
      discountRate: 0.08,
      contractYears: 25,
      ...overrides,
    },
  })

  it('Hybrid gets BOTH $/W (solar) and $/kWh (storage) sliders', () => {
    const cfg = getSliderConfig(baseHybrid())
    const solarCapex = findSlider(cfg, 'capexPerWatt')
    const storageCapex = findSlider(cfg, 'capexPerKwh')
    expect(solarCapex).toBeDefined()
    expect(storageCapex).toBeDefined()
    expect(solarCapex.label).toBe('Solar Capex')      // disambiguated label
    expect(storageCapex.label).toBe('Storage Capex')  // disambiguated label
  })

  it('Hybrid solar capex uses baseline×2 envelope (same as CS)', () => {
    const cfg = getSliderConfig(baseHybrid({ capexPerWatt: 2.50 }))
    const capex = findSlider(cfg, 'capexPerWatt')
    expect(capex.min).toBeCloseTo(1.25, 2)
    expect(capex.max).toBeCloseTo(5.00, 2)
  })

  it('Hybrid storage capex uses baseline×2 envelope (same as BESS)', () => {
    const cfg = getSliderConfig(baseHybrid({ capexPerKwh: 400 }))
    const capex = findSlider(cfg, 'capexPerKwh')
    expect(capex.min).toBe(200)
    expect(capex.max).toBe(800)
  })

  it('Hybrid includes a Solar Capacity Factor slider (storage has none)', () => {
    const cfg = getSliderConfig(baseHybrid())
    const cf = findSlider(cfg, 'capacityFactor')
    expect(cf).toBeDefined()
    expect(cf.label).toBe('Solar Capacity Factor')
  })

  it('Hybrid uses 25-year contract (solar dominant), not 20 (BESS)', () => {
    const cfg = getSliderConfig(baseHybrid())
    const tenor = findSlider(cfg, 'contractYears')
    expect(tenor.max).toBe(40)  // solar tier — matches long-tenor program states (IL)
  })
})

describe('getSliderConfig — BESS contract tenor cap (battery-degradation envelope)', () => {
  it('community-solar tenor maxes at 40 years', () => {
    const cfg = getSliderConfig(baseSolar())
    const tenor = findSlider(cfg, 'contractYears')
    expect(tenor.max).toBe(40)
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
