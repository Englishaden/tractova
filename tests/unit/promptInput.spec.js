import { describe, it, expect } from 'vitest'
import { MAX_PROJECTS, MAX_OVERRIDE_ENTRIES, clampStr } from '../../api/lib/_promptInput.js'

// Caps on client-supplied lens prompt inputs (audit F-03). These bound the
// Anthropic input-token spend a single request can drive; the handlers reject
// over-cap arrays with a 400 and truncate every string field through clampStr.

describe('clampStr', () => {
  it('coerces null/undefined to empty string', () => {
    expect(clampStr(null)).toBe('')
    expect(clampStr(undefined)).toBe('')
  })

  it('truncates to the requested length', () => {
    expect(clampStr('abcdefghij', 4)).toBe('abcd')
    expect(clampStr('x'.repeat(500), 120)).toHaveLength(120)
  })

  it('defaults to 120 chars', () => {
    expect(clampStr('y'.repeat(1000))).toHaveLength(120)
  })

  it('coerces numbers and objects without throwing', () => {
    expect(clampStr(42)).toBe('42')
    expect(clampStr(5.5, 12)).toBe('5.5')
  })

  it('leaves short strings unchanged', () => {
    expect(clampStr('NY', 24)).toBe('NY')
  })
})

describe('caps are sane', () => {
  it('MAX_PROJECTS is a small positive bound', () => {
    expect(MAX_PROJECTS).toBeGreaterThan(1)
    expect(MAX_PROJECTS).toBeLessThanOrEqual(100)
  })
  it('MAX_OVERRIDE_ENTRIES is a small positive bound', () => {
    expect(MAX_OVERRIDE_ENTRIES).toBeGreaterThan(1)
    expect(MAX_OVERRIDE_ENTRIES).toBeLessThanOrEqual(100)
  })
})
