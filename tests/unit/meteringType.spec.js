import { describe, it, expect } from 'vitest'
import { MT, METERING_TYPE_VALUES, normalizeMeteringType } from '../../api/scrapers/_meteringType.js'

describe('normalizeMeteringType — source string → canonical tag', () => {
  // Values verified against real NJ EDC files (scripts/spike-nj-structures.mjs).
  it('maps the real NJ metering-type values', () => {
    expect(normalizeMeteringType('Community Solar')).toBe(MT.COMMUNITY_SOLAR)
    expect(normalizeMeteringType('Net Metering')).toBe(MT.NET_METERING)
    expect(normalizeMeteringType('Remote Net Metering')).toBe(MT.NET_METERING)
    expect(normalizeMeteringType('Offset Load')).toBe(MT.OTHER)
    expect(normalizeMeteringType('PURPA')).toBe(MT.OTHER)
    expect(normalizeMeteringType('Cogen - Non-Export')).toBe(MT.OTHER)
    expect(normalizeMeteringType('Back-up')).toBe(MT.OTHER)
    expect(normalizeMeteringType('PEP')).toBe(MT.OTHER)
  })

  it('checks "net billing" before "net metering" (both contain "net")', () => {
    expect(normalizeMeteringType('Net Billing')).toBe(MT.NET_BILLING)
    expect(normalizeMeteringType('NEM successor net billing tariff')).toBe(MT.NET_BILLING)
  })

  it('recognizes on-bill variants', () => {
    expect(normalizeMeteringType('On-Bill')).toBe(MT.ON_BILL)
    expect(normalizeMeteringType('on bill tariff')).toBe(MT.ON_BILL)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeMeteringType('  COMMUNITY SOLAR  ')).toBe(MT.COMMUNITY_SOLAR)
    expect(normalizeMeteringType('net metering')).toBe(MT.NET_METERING)
  })

  it('returns unknown for source-silent input (never fabricates a structure)', () => {
    expect(normalizeMeteringType('')).toBe(MT.UNKNOWN)
    expect(normalizeMeteringType('   ')).toBe(MT.UNKNOWN)
    expect(normalizeMeteringType(null)).toBe(MT.UNKNOWN)
    expect(normalizeMeteringType(undefined)).toBe(MT.UNKNOWN)
  })

  it('returns other for a named-but-unmapped value (distinct from unknown)', () => {
    expect(normalizeMeteringType('Microgrid Island Mode')).toBe(MT.OTHER)
  })

  it('every output is a member of the canonical vocabulary', () => {
    const samples = ['Community Solar', 'Net Metering', 'Net Billing', 'On-Bill', 'PURPA', '', 'weird']
    for (const s of samples) expect(METERING_TYPE_VALUES).toContain(normalizeMeteringType(s))
  })

  it('exposes exactly the seven canonical tags', () => {
    expect([...METERING_TYPE_VALUES].sort()).toEqual(
      ['ci_btm', 'community_solar', 'net_billing', 'net_metering', 'on_bill', 'other', 'unknown'],
    )
  })
})
