/**
 * VA distribution-DG scraper — Dominion Energy Virginia "Queue Status Report".
 *
 * Source: Dominion VA's public interconnection Queue Status Report (.xlsx),
 * updated quarterly. Verified CS-scale (not the utility/transmission trap):
 * 813 solar projects, median 3 MW, max 40 MW, all sub-50 MW — distribution-level.
 *
 * Found 2026-05-23 on the gap-closing re-check (the hosting-capacity-only sweep
 * had missed it). Government/utility public compliance file — no redistribution
 * clause found.
 *
 * Signal (cs_pipeline): solar projects in the queue, Status 'A' = Active
 * (pipeline) vs 'I' = In Service (energized). Capacity (MW). No study-months in
 * the file → those stay null; IX score stays on the curated baseline.
 */

import { MT } from './_meteringType.js'

const URL = 'https://cdn-dominionenergy-prd-001.azureedge.net/-/media/content/large-business-services/files/dominion-energy-virginia-queue-status-report.xlsx'

export async function scrapeVaDg(signal) {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) throw new Error(`Dominion VA xlsx fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets['VA Queue Status']
  if (!sheet) throw new Error(`Dominion VA: 'VA Queue Status' sheet missing — got [${wb.SheetNames.join(', ')}]`)

  // Header is on row index 2 (rows 0-1 are title + "Data as of"). Parse as AoA.
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  const hdr = aoa[2] || []
  const fi = hdr.indexOf('Fuel Type')
  const ci = hdr.indexOf('Capacity (MW)')
  const si = hdr.indexOf('Status')
  if (fi < 0 || ci < 0 || si < 0) throw new Error(`Dominion VA: column layout shifted (fuel=${fi} cap=${ci} status=${si})`)

  const solar = aoa.slice(3).filter(r => /solar|photovolt/i.test(String(r[fi] || '')))
  // Status: 'A' = Active (in pipeline), 'I' = In Service (energized). Anything
  // else (cancelled/withdrawn) is excluded — cancelled rows have Fuel='Cancelled'.
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
  const pipeline = solar.filter(r => String(r[si] || '').trim().toUpperCase() === 'A')
  const energized = solar.filter(r => String(r[si] || '').trim().toUpperCase() === 'I')

  return [{
    state_id:            'VA',
    iso:                 'PJM',
    utility_name:        'Dominion',
    metering_type:       MT.UNKNOWN,  // fuel-type-only queue — no structure indicator
    projects_in_queue:   pipeline.length,
    mw_pending:          Math.round(pipeline.reduce((a, r) => a + num(r[ci]), 0)),
    completed_projects:  energized.length,
    completed_mw:        Math.round(energized.reduce((a, r) => a + num(r[ci]), 0)),
    avg_study_months:    null,
    withdrawal_pct:      null,
    avg_upgrade_cost_mw: null,
    queue_trend:         'stable',
    data_source:         'va_dominion_queue',
    data_source_url:     URL,
    fetched_at:          new Date().toISOString(),
  }]
}
