import { describe, it, expect } from 'vitest'
import { assessFederalTiming, federalTimingScore, FEDERAL_TIMELINE } from '../../src/lib/federalTimeline'

describe('assessFederalTiming — OBBBA §48E/§45Y timing risk', () => {
  it('late-stage projects can safe-harbor SoC → clear', () => {
    for (const stage of ['NTP (Notice to Proceed)', 'Construction', 'Operational']) {
      const r = assessFederalTiming({ stage, codYear: 2029, mwAc: 5 })
      expect(r.tier).toBe('clear')
      expect(r.score).toBe(85)
      expect(r.reasons.join(' ')).toMatch(/Jul 4 2026/)
    }
  })

  it('Development stage is borderline → watch', () => {
    const r = assessFederalTiming({ stage: 'Development', codYear: 2028, mwAc: 5 })
    expect(r.tier).toBe('watch')
    expect(r.score).toBe(55)
  })

  it('early stage with COD <= 2027 → watch (must hit end-2027 PIS)', () => {
    const r = assessFederalTiming({ stage: 'Prospecting', codYear: 2027, mwAc: 5 })
    expect(r.tier).toBe('watch')
  })

  it('early stage with COD after 2027 → at_risk (misses both deadlines)', () => {
    const r = assessFederalTiming({ stage: 'Site Control', codYear: 2029, mwAc: 5 })
    expect(r.tier).toBe('at_risk')
    expect(r.score).toBe(25)
    expect(r.reasons.join(' ')).toMatch(/at risk/i)
  })

  it('always discloses FEOC uncertainty when a stage is given', () => {
    const r = assessFederalTiming({ stage: 'Development', codYear: 2027, mwAc: 5 })
    expect(r.reasons.join(' ')).toMatch(/FEOC/)
  })

  it('flags the >1.5 MWac safe-harbor / Physical Work Test only above threshold', () => {
    const big = assessFederalTiming({ stage: 'Operational', codYear: 2029, mwAc: 5 })
    const small = assessFederalTiming({ stage: 'Operational', codYear: 2029, mwAc: 1 })
    expect(big.reasons.join(' ')).toMatch(/Physical Work Test/)
    expect(small.reasons.join(' ')).not.toMatch(/Physical Work Test/)
  })

  it('degrades to neutral (no fabricated certainty) when stage is missing', () => {
    const r = assessFederalTiming({ codYear: 2027 })
    expect(r.score).toBe(60)
    expect(federalTimingScore({})).toBe(60)
  })

  it('exposes the dated constants for UI/glossary + re-verification', () => {
    expect(FEDERAL_TIMELINE.socCutoff).toBe('2026-07-04')
    expect(FEDERAL_TIMELINE.postCutoffPisDeadline).toBe('2027-12-31')
    expect(FEDERAL_TIMELINE.safeHarborMwThreshold).toBe(1.5)
  })
})
