import { describe, it, expect } from 'vitest'
import { sanitizeCell } from '../../src/lib/exportHelpers.js'

// Spreadsheet formula-injection guard for the Library xlsx/CSV export
// (audit F-44). Cells beginning with = + - @ tab or CR are executed as
// formulas on open; prefix-quoting neutralizes them while staying readable.

describe('sanitizeCell', () => {
  it('prefix-quotes formula-leading strings', () => {
    expect(sanitizeCell('=HYPERLINK("http://evil","x")')).toBe(`'=HYPERLINK("http://evil","x")`)
    expect(sanitizeCell('+1+1')).toBe(`'+1+1`)
    expect(sanitizeCell('-2+3')).toBe(`'-2+3`)
    expect(sanitizeCell('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(sanitizeCell('\tTAB')).toBe(`'\tTAB`)
    expect(sanitizeCell('\rCR')).toBe(`'\rCR`)
  })

  it('leaves ordinary values untouched', () => {
    expect(sanitizeCell('Albany')).toBe('Albany')
    expect(sanitizeCell('NY')).toBe('NY')
    expect(sanitizeCell('Community Solar')).toBe('Community Solar')
    expect(sanitizeCell('')).toBe('')
  })

  it('passes non-strings through unchanged (numbers stay numeric)', () => {
    expect(sanitizeCell(42)).toBe(42)
    expect(sanitizeCell(0)).toBe(0)
    expect(sanitizeCell(null)).toBe(null)
    expect(sanitizeCell(undefined)).toBe(undefined)
  })

  it('neutralizes a poisoned shared ixNotes value', () => {
    // ixNotes is admin/scraper-sourced and shared across users' exports.
    const poisoned = '=cmd|\'/c calc\'!A1'
    expect(sanitizeCell(poisoned).startsWith("'")).toBe(true)
  })
})
