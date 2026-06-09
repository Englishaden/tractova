import { describe, it, expect } from 'vitest'
import { computeIncentiveScore } from '../../src/lib/scoreEngine.js'

// Phase 2: per-site address→tract resolution makes the §48(e) LIC adder a precise
// per-tract yes/no instead of the county-binary. These pin that licTractResolved
// (true/false) overrides the county signal, and that absent (null) falls back to
// today's county-binary behavior. No address / geocode failure → null → unchanged.

const eligibleCounty = { isEligible: true, qualifyingTractsCount: 6, totalTractsInCounty: 17 }
const ecOff = { isEnergyCommunity: false }

describe('computeIncentiveScore — per-site licTractResolved override', () => {
  it('no override (null/absent) → county-binary nmtc, unchanged behavior', () => {
    const r = computeIncentiveScore({ energyCommunity: ecOff, nmtcLic: eligibleCounty, hudQctDda: null }, 5)
    expect(r.adders.lowIncomeCommunity).toBe(true)   // county contains LIC tracts
    expect(r.adders.licTractResolved).toBeNull()
    expect(r.score).toBe(75)                          // 50 base + 25 LIC
  })
  it('resolved=true → grants the +25 adder, flagged site-specific', () => {
    const r = computeIncentiveScore({ energyCommunity: ecOff, nmtcLic: eligibleCounty, hudQctDda: null, licTractResolved: true }, 5)
    expect(r.adders.lowIncomeCommunity).toBe(true)
    expect(r.adders.licTractResolved).toBe(true)
    expect(r.score).toBe(75)
  })
  it('resolved=false in an LIC-containing county → WITHHOLDS the adder (the discrimination win)', () => {
    const r = computeIncentiveScore({ energyCommunity: ecOff, nmtcLic: eligibleCounty, hudQctDda: null, licTractResolved: false }, 5)
    expect(r.adders.lowIncomeCommunity).toBe(false)  // this exact tract is NOT LIC, despite the county having LIC tracts
    expect(r.adders.licTractResolved).toBe(false)
    expect(r.score).toBe(50)                          // the +25 is correctly withheld
  })
  it('resolved=true but >5 MW → the size cap still withholds the adder', () => {
    const r = computeIncentiveScore({ energyCommunity: ecOff, nmtcLic: eligibleCounty, hudQctDda: null, licTractResolved: true }, 12)
    expect(r.adders.lowIncomeCommunity).toBe(false)
    expect(r.adders.licSizeCapped).toBe(true)
    expect(r.score).toBe(50)
  })
})
