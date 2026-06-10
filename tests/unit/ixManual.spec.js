import { describe, it, expect } from 'vitest'
import { parseIxManualCsv, splitCsvLine } from '../../api/scrapers/_ixManual.js'

// Pure manual-IX CSV parser (Phase 4a). The DB upsert verifies via the admin
// flow; these pin the parse/validate that turns an admin CSV into ix_queue_data
// rows — required-column + state + metering-type + numeric validation, and the
// drop-bad-rows discipline (a bad line never writes garbage).

const HEADER = 'state_id,iso,utility_name,metering_type,projects_in_queue,mw_pending,avg_study_months,withdrawal_pct,data_source_url'

describe('splitCsvLine — RFC-4180-ish', () => {
  it('handles quoted fields with commas + escaped quotes', () => {
    expect(splitCsvLine('NJ,PJM,"Atlantic City Electric, Inc.",net_metering')).toEqual(
      ['NJ', 'PJM', 'Atlantic City Electric, Inc.', 'net_metering'])
    expect(splitCsvLine('a,"b ""x"" c",d')).toEqual(['a', 'b "x" c', 'd'])
  })
})

describe('parseIxManualCsv — happy path', () => {
  it('parses a valid row into an ix_queue_data shape (data_source: manual)', () => {
    const csv = `${HEADER}\nNJ,PJM,Atlantic City Electric,community_solar,42,125.5,18,7.5,https://nj.gov/queue`
    const { rows, errors } = parseIxManualCsv(csv)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      state_id: 'NJ', iso: 'PJM', utility_name: 'Atlantic City Electric',
      metering_type: 'community_solar', projects_in_queue: 42, mw_pending: 125.5,
      avg_study_months: 18, withdrawal_pct: 7.5, data_source: 'manual',
      data_source_url: 'https://nj.gov/queue',
    })
  })
  it('uppercases state, normalizes a raw metering label, blanks → null numerics', () => {
    const csv = `${HEADER}\nme,ISO-NE,Central Maine Power,"Net Metering",,,,,`
    const { rows, errors } = parseIxManualCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0].state_id).toBe('ME')
    expect(rows[0].metering_type).toBe('net_metering')   // normalized from "Net Metering"
    expect(rows[0].projects_in_queue).toBeNull()
    expect(rows[0].mw_pending).toBeNull()
    expect(rows[0].data_source_url).toBeNull()
  })
  it('is column-order independent + ignores extra columns', () => {
    const csv = 'utility_name,state_id,iso,extra\nHECO,HI,HICEP,ignored'
    const { rows, errors } = parseIxManualCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ state_id: 'HI', iso: 'HICEP', utility_name: 'HECO', metering_type: 'unknown' })
  })
})

describe('parseIxManualCsv — validation drops bad rows, keeps good ones', () => {
  it('errors on a missing required column', () => {
    const { rows, errors } = parseIxManualCsv('state_id,iso\nNJ,PJM')
    expect(rows).toHaveLength(0)
    expect(errors[0]).toMatch(/missing required column/)
  })
  it('drops rows with unknown state / bad numbers but keeps valid ones', () => {
    const csv = [HEADER,
      'XX,PJM,Bad State Co,net_metering,1,,,,',          // unknown state → dropped
      'OR,WECC,PacifiCorp,net_metering,-5,,,,',           // negative number → dropped
      'MN,MISO,Xcel Energy,community_solar,300,800,24,12,',// valid → kept
    ].join('\n')
    const { rows, errors } = parseIxManualCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].state_id).toBe('MN')
    expect(errors.some(e => /unknown state_id "XX"/.test(e))).toBe(true)
    expect(errors.some(e => /projects_in_queue .* non-negative/.test(e))).toBe(true)
  })
  it('rejects withdrawal_pct over 100', () => {
    const { rows, errors } = parseIxManualCsv(`${HEADER}\nNJ,PJM,ACE,net_metering,1,,,150,`)
    expect(rows).toHaveLength(0)
    expect(errors.some(e => /withdrawal_pct 150 exceeds 100/.test(e))).toBe(true)
  })
  it('flags an intra-upload duplicate key (state+utility+metering_type)', () => {
    const csv = [HEADER,
      'NJ,PJM,ACE,net_metering,1,,,,',
      'NJ,PJM,ACE,net_metering,2,,,,',   // same key → collision warning
    ].join('\n')
    const { rows, errors } = parseIxManualCsv(csv)
    expect(rows).toHaveLength(2)         // both parsed
    expect(errors.some(e => /duplicate row for NJ:ACE:net_metering/.test(e))).toBe(true)
  })
  it('handles an empty file', () => {
    expect(parseIxManualCsv('').errors).toEqual(['empty file'])
    expect(parseIxManualCsv('   \n  ').errors).toEqual(['empty file'])
  })
})
