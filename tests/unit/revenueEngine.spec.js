import { describe, it, expect } from 'vitest'
import {
  hasRevenueData,
  getRevenueData,
  getSupportedStates,
  computeRevenueProjection,
  hasCIRevenueData,
  computeCIRevenueProjection,
  hasBESSRevenueData,
  computeBESSProjection,
  computeHybridProjection,
  SOLAR_RATES_AS_OF,
  CI_RATES_AS_OF,
  BESS_RATES_AS_OF,
} from '../../src/lib/revenueEngine.js'

describe('revenue rate vintage stamps', () => {
  it('exposes non-empty as-of strings for each tech', () => {
    expect(SOLAR_RATES_AS_OF).toBeTypeOf('string')
    expect(SOLAR_RATES_AS_OF.length).toBeGreaterThan(0)
    expect(CI_RATES_AS_OF).toBeTypeOf('string')
    expect(BESS_RATES_AS_OF).toBeTypeOf('string')
  })
})

describe('CS revenue projection', () => {
  it('returns non-null for a covered state with valid MW', () => {
    const supported = getSupportedStates()
    expect(supported.length).toBeGreaterThan(0)
    const stateId = supported[0].id
    const r = computeRevenueProjection(stateId, 5)
    expect(r).not.toBeNull()
    expect(r.stateId).toBe(stateId)
  })

  it('returns null for null/zero/negative mwAC', () => {
    const stateId = getSupportedStates()[0].id
    expect(computeRevenueProjection(stateId, 0)).toBeNull()
    expect(computeRevenueProjection(stateId, -1)).toBeNull()
    expect(computeRevenueProjection(stateId, null)).toBeNull()
    expect(computeRevenueProjection(stateId, undefined)).toBeNull()
  })

  it('returns null for an unsupported state', () => {
    expect(computeRevenueProjection('ZZ_NOT_A_STATE', 5)).toBeNull()
  })

  it('NPV scales positively with MW (5 MW NPV > 1 MW NPV for same state)', () => {
    const supported = getSupportedStates()
    const stateId = supported[0].id
    const small = computeRevenueProjection(stateId, 1)
    const big   = computeRevenueProjection(stateId, 5)
    expect(big.npv25).toBeGreaterThan(small.npv25)
    expect(big.annualMWh).toBeGreaterThan(small.annualMWh)
  })

  it('honors a Supabase rates override when provided', () => {
    const supported = getSupportedStates()
    const stateId = supported[0].id
    const override = {
      bill_credit_cents_kwh: 99,  // absurdly high to be detectable
      rec_per_mwh: 0,
      itc_pct: 30,
      itc_adder_pct: 0,
      capacity_factor_pct: 20,
      degradation_pct: 0.5,
      installed_cost_per_watt: 1.50,
      label: 'Override',
      notes: '',
    }
    const overridden = computeRevenueProjection(stateId, 5, override)
    const baseline = computeRevenueProjection(stateId, 5)
    expect(overridden.billCreditCentsKwh).toBe(99)
    expect(overridden.billCreditRevenue).toBeGreaterThan(baseline.billCreditRevenue)
  })
})

describe('hasRevenueData / getRevenueData accessors', () => {
  it('agree on coverage', () => {
    const supported = getSupportedStates()
    for (const { id } of supported.slice(0, 5)) {
      expect(hasRevenueData(id)).toBe(true)
      expect(getRevenueData(id)).not.toBeNull()
    }
  })

  it('return false / null for an unsupported state', () => {
    expect(hasRevenueData('ZZ_NOT_A_STATE')).toBe(false)
    expect(getRevenueData('ZZ_NOT_A_STATE')).toBeNull()
  })
})

describe('C&I revenue projection guards', () => {
  it('returns null for null/zero MW even when state is supported', () => {
    // pick any state where we know C&I data exists; if none, skip.
    // CA / TX are very likely covered per CI_OFFTAKE_SCORES.
    const candidates = ['CA', 'TX', 'NY', 'MA']
    const state = candidates.find(s => hasCIRevenueData(s))
    if (!state) return
    expect(computeCIRevenueProjection(state, 0)).toBeNull()
    expect(computeCIRevenueProjection(state, null)).toBeNull()
  })
})

describe('BESS projection guards', () => {
  it('returns null for unsupported state', () => {
    expect(computeBESSProjection('ZZ_NOT_A_STATE', 10, 4)).toBeNull()
  })

  it('returns null for null/zero MW', () => {
    const candidates = ['CA', 'TX', 'NY', 'MA']
    const state = candidates.find(s => hasBESSRevenueData(s))
    if (!state) return
    expect(computeBESSProjection(state, 0, 4)).toBeNull()
    expect(computeBESSProjection(state, null, 4)).toBeNull()
  })
})

describe('Hybrid projection composition', () => {
  it('does not crash when both legs are valid', () => {
    const candidates = ['CA', 'TX', 'NY', 'MA']
    const state = candidates.find(s => hasRevenueData(s) && hasBESSRevenueData(s))
    if (!state) return
    const r = computeHybridProjection(state, 5, 2, 4)
    // Either returns a composed projection or null — both are non-throwing
    expect(r === null || typeof r === 'object').toBe(true)
  })
})
