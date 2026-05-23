/**
 * WI distribution-DG scraper — Alliant Energy DG interconnection queue (CSV).
 *
 * Source: Alliant's public DG interconnection queue (CSV, updated weekly).
 * Found 2026-05-23 on the gap-closing re-check. Government/utility public file —
 * no redistribution clause found.
 *
 * HONEST framing: this is a DISTRIBUTED-GENERATION solar queue, ~90% residential
 * rooftop (<100 kW) — NOT specifically community solar. We count all DG solar
 * (per "capture every size") and label it a "DG solar queue", not a CS pipeline.
 *
 * Signal (cs_pipeline shape): pipeline = active/in-progress, energized =
 * completed/in-service. Capacity in kW → MW. No study-months → null; IX score
 * stays curated. The CSV has quoted fields (Location = "city, county, state"),
 * so it needs a real CSV parser, not split(',').
 */

const URL = 'https://www.alliantenergy.com/-/media/alliant/documents/ourenergy/customerinterconnection/dg-interconnection-queue.csv?sc_lang=en'

// Minimal RFC-4180-ish parser: handles quoted fields containing commas + "" escapes.
function parseCsv(text) {
  const rows = []
  let row = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (ch !== '\r') cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

export async function scrapeWiDg(signal) {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) throw new Error(`Alliant WI CSV fetch failed: ${res.status}`)
  const rows = parseCsv(await res.text())
  if (rows.length < 2) throw new Error('Alliant WI: no rows parsed')

  const hdr = rows[0].map(h => h.trim())
  const idx = (re) => hdr.findIndex(h => re.test(h))
  const tIdx = idx(/technology/i)
  const kwIdx = idx(/nameplate capacity/i)
  const csIdx = idx(/current status/i)
  if (tIdx < 0 || kwIdx < 0) throw new Error(`Alliant WI: column layout shifted (tech=${tIdx} kw=${kwIdx})`)

  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
  const solar = rows.slice(1).filter(r => /solar/i.test(String(r[tIdx] || '')))
  // Active-application queue (no reliable in-service status), so all non-withdrawn
  // solar = active pipeline; energized is not tracked → completed_* null (like NJ).
  const pipeline = solar.filter(r => !/withdraw|denied|cancel/i.test(String(r[csIdx] || '')))

  return [{
    state_id:            'WI',
    iso:                 'MISO',
    utility_name:        'Alliant Energy',
    projects_in_queue:   pipeline.length,
    mw_pending:          Math.round(pipeline.reduce((a, r) => a + num(r[kwIdx]) / 1000, 0)),
    completed_projects:  null,
    completed_mw:        null,
    avg_study_months:    null,
    withdrawal_pct:      null,
    avg_upgrade_cost_mw: null,
    queue_trend:         'stable',
    data_source:         'wi_alliant_queue',
    data_source_url:     URL,
    fetched_at:          new Date().toISOString(),
  }]
}
