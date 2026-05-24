/**
 * CA distribution-DG scraper — PG&E Wholesale Distribution interconnection queue.
 *
 * Source: PG&E's public "Wholesale Distribution Queue" (.xlsx), the active +
 * historical list of generation projects interconnecting at PG&E's DISTRIBUTION
 * substations (sub-transmission/distribution, not the CAISO transmission queue).
 * Found by the 2026-05-23 independent source sweep. No posted license → covered
 * by the aggregate-only posture (docs/data-license-rationale.md): we store per-
 * utility counts + MW, never the per-project rows.
 *
 * HONEST framing: California has no formal community-solar program (cs_status=
 * 'limited'), so this is a DISTRIBUTION-LEVEL SOLAR queue, not a CS pipeline —
 * same honesty bar as WI Alliant. We filter to Solar PV, sub-50 MW (drops a
 * handful of transmission-scale outliers, keeps every distribution-scale size).
 *
 * Signal (cs_pipeline): Status 'Active' = pipeline, 'In Service' = energized,
 * 'Withdrawn' excluded. "Summer Max Capacity (MW)" is already MW. No study-months
 * → null; IX score stays on the curated baseline.
 */

import { MT } from './_meteringType.js'

const URL = 'https://www.pge.com/assets/pge/docs/about/doing-business-with-pge/PublicQueueInterconnection.xlsx'
const MAX_MW = 50  // distribution-scale ceiling — excludes transmission-scale outliers

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

export async function scrapeCaDg(signal) {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`PG&E wholesale queue fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets['Public Queue'] || wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error(`PG&E: no sheet — got [${wb.SheetNames.join(', ')}]`)

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
  // Header row is the one carrying "Generation Type" + "Summer Max Capacity".
  let hdrRow = -1
  for (let i = 0; i < Math.min(8, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c).toLowerCase())
    if (cells.some((c) => /generation type/.test(c)) && cells.some((c) => /summer max capacity/.test(c))) { hdrRow = i; break }
  }
  if (hdrRow < 0) throw new Error('PG&E: header row (Generation Type / Summer Max Capacity) not found')
  const hdr = aoa[hdrRow]
  const gi = hdr.findIndex((h) => /generation type/i.test(String(h)))
  const ci = hdr.findIndex((h) => /summer max capacity/i.test(String(h)))
  const si = hdr.findIndex((h) => /current interconnection request status/i.test(String(h)))
  if (gi < 0 || ci < 0 || si < 0) throw new Error(`PG&E: column layout shifted (gen=${gi} cap=${ci} status=${si})`)

  const rows = aoa.slice(hdrRow + 1).filter((r) => r && r.length)
  // Solar (any combo containing Solar PV), distribution-scale only.
  const solar = rows.filter((r) => /solar|photovolt/i.test(String(r[gi] || '')) && num(r[ci]) > 0 && num(r[ci]) <= MAX_MW)
  const st = (r) => String(r[si] || '').trim().toLowerCase()
  const pipeline = solar.filter((r) => st(r) === 'active')
  const energized = solar.filter((r) => st(r) === 'in service')

  return [{
    state_id:            'CA',
    iso:                 'CAISO',
    utility_name:        'PG&E',
    metering_type:       MT.UNKNOWN,  // wholesale-distribution queue — no structure indicator
    projects_in_queue:   pipeline.length,
    mw_pending:          Math.round(pipeline.reduce((a, r) => a + num(r[ci]), 0)),
    completed_projects:  energized.length,
    completed_mw:        Math.round(energized.reduce((a, r) => a + num(r[ci]), 0)),
    avg_study_months:    null,
    withdrawal_pct:      null,
    avg_upgrade_cost_mw: null,
    queue_trend:         'stable',
    data_source:         'ca_pge_queue',
    data_source_url:     URL,
    fetched_at:          new Date().toISOString(),
  }]
}
