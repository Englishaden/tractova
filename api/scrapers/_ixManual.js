/**
 * Pure parser + validator for the manual IX-queue CSV upload (Phase 4a).
 *
 * The ~5 gated states (NJ ACE, ME CMP, MN Xcel, HI HECO, OR OASIS) publish
 * interconnection-queue data with no redistribution-safe machine feed, so an
 * admin maps each state's file to ONE canonical Tractova CSV and uploads it.
 * This module turns that CSV text into validated ix_queue_data rows; the DB
 * upsert lives in _refresh-ix-manual.js (same pure/handler split as _floodNri).
 *
 * SECURITY: input is parsed as TEXT only — never a workbook (the xlsx read path
 * is gov-source-only per CLAUDE.md §9). The admin converts to CSV first; we never
 * SheetJS-parse an admin upload.
 *
 * Canonical header (order-independent; extra columns ignored):
 *   state_id,iso,utility_name,metering_type,projects_in_queue,mw_pending,
 *   avg_study_months,withdrawal_pct,data_source_url
 *   - required: state_id (2-letter), iso, utility_name
 *   - metering_type: a canonical tag OR a raw label (normalized); blank → unknown
 *   - numerics optional; blank → null; must be a non-negative number when present
 *   - withdrawal_pct: 0-100
 */
import { normalizeMeteringType, METERING_TYPE_VALUES } from './_meteringType.js'

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
])

const REQUIRED = ['state_id', 'iso', 'utility_name']
const NUMERIC = ['projects_in_queue', 'mw_pending', 'avg_study_months', 'withdrawal_pct']

// Minimal RFC-4180 line splitter (quoted fields may contain commas / escaped "").
export function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

function parseNumber(raw, field, lineNo, errors) {
  const s = String(raw ?? '').trim().replace(/,/g, '')
  if (s === '') return null
  const n = Number(s)
  if (Number.isNaN(n) || n < 0) { errors.push(`line ${lineNo}: ${field} "${raw}" is not a non-negative number`); return undefined }
  if (field === 'withdrawal_pct' && n > 100) { errors.push(`line ${lineNo}: withdrawal_pct ${n} exceeds 100`); return undefined }
  return n
}

/**
 * Parse + validate manual IX CSV text.
 * @returns {{ rows: object[], errors: string[], headerCols: string[] }}
 *   rows = ready-to-upsert ix_queue_data shapes (data_source:'manual'); a row
 *   with any error is DROPPED (its error is recorded) so a bad line never
 *   silently writes a partial/garbage row.
 */
export function parseIxManualCsv(text) {
  const errors = []
  const rows = []
  const lines = String(text ?? '').split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { rows, errors: ['empty file'], headerCols: [] }

  const headerCols = splitCsvLine(lines[0].replace(/^﻿/, '')).map(h => h.trim().toLowerCase())
  const missingReq = REQUIRED.filter(c => !headerCols.includes(c))
  if (missingReq.length) {
    return { rows, errors: [`missing required column(s): ${missingReq.join(', ')}`], headerCols }
  }
  const idx = (name) => headerCols.indexOf(name)

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1
    const cells = splitCsvLine(lines[i])
    const get = (name) => { const j = idx(name); return j === -1 ? '' : (cells[j] ?? '').trim() }

    const state_id = get('state_id').toUpperCase()
    const iso = get('iso')
    const utility_name = get('utility_name')
    if (!state_id || !iso || !utility_name) { errors.push(`line ${lineNo}: missing state_id / iso / utility_name`); continue }
    if (!US_STATES.has(state_id)) { errors.push(`line ${lineNo}: unknown state_id "${state_id}"`); continue }

    // metering_type: accept a canonical tag verbatim, else normalize a raw label.
    const rawMt = get('metering_type')
    const metering_type = METERING_TYPE_VALUES.includes(rawMt.toLowerCase())
      ? rawMt.toLowerCase()
      : normalizeMeteringType(rawMt)

    const nums = {}
    let rowOk = true
    for (const f of NUMERIC) {
      const v = parseNumber(get(f), f, lineNo, errors)
      if (v === undefined) { rowOk = false; break }
      nums[f] = v
    }
    if (!rowOk) continue

    rows.push({
      state_id,
      iso,
      utility_name,
      metering_type,
      projects_in_queue: nums.projects_in_queue,
      mw_pending:        nums.mw_pending,
      avg_study_months:  nums.avg_study_months,
      withdrawal_pct:    nums.withdrawal_pct,
      data_source:       'manual',
      data_source_url:   get('data_source_url') || null,
    })
  }

  // Guard against duplicate (state,utility,metering_type) keys within one upload —
  // they'd collide on the unique constraint, last-write-wins silently.
  const seen = new Set()
  for (const r of rows) {
    const k = `${r.state_id}:${r.utility_name}:${r.metering_type}`
    if (seen.has(k)) errors.push(`duplicate row for ${k} — only the last will persist`)
    seen.add(k)
  }

  return { rows, errors, headerCols }
}
