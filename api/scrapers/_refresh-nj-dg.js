/**
 * NJ distribution-DG scraper — all NJ EDCs' BPU-mandated monthly interconnection
 * queue inventories (Docket QO21010085, monthly filings begun Nov 2025).
 *
 * EDCs: JCP&L (FirstEnergy), PSE&G, Rockland Electric (RECO, ConEd/O&R), and
 * Atlantic City Electric (ACE, Exelon). Each posts a monthly .xlsx.
 *
 * CAPTURE-ALL + TAG (scope decision 2026-05-23): we no longer filter to Community
 * Solar. We capture EVERY distribution-DG project and aggregate per
 * (EDC × monetization structure), tagging structure from the file's "Metering or
 * interconnection type" column (canonical vocab in _meteringType.js). This serves
 * net-metering developers too, not just CS, for ~no extra scraping. Verified
 * against the real files (scripts/spike-nj-structures.mjs): JCP&L/PSE&G carry a
 * value column; RECO carries separate Yes/No boolean columns.
 *
 * License: government-mandated public compliance filing — strong public-record
 * footing (docs/data-license-rationale.md). Aggregate-only: per-(EDC,structure)
 * counts + MW, never the per-project rows.
 *
 * Signal (cs_pipeline shape): status splits pipeline vs energized PER EDC. An EDC
 * whose file carries an In-Service / Permission-to-Operate status (PSE&G) gives
 * observed completed_*; an EDC whose file is active-only (JCP&L) leaves completed_*
 * NULL (unknown ≠ zero — never fabricated). Cancelled/withdrawn/suspended dropped.
 * No study-months → null; IX score stays on the curated baseline (live CONTEXT).
 *
 * ACE (Exelon): BPU-mandated monthly queue exists, but the download link is
 * JS-rendered on atlanticcityelectric.com — URL not yet isolated. Add it when found.
 */

import { MT, normalizeMeteringType } from './_meteringType.js'

const EDCS = [
  {
    utility_name: 'JCP&L',
    url: 'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx',
  },
  {
    utility_name: 'PSE&G',
    url: 'https://nj.pseg.com/-/media/pseg/public-site/documents/pseg-queue-inventory.ashx',
  },
  {
    utility_name: 'Rockland Electric (RECO)',
    url: 'https://cdnc-dcxprod2-sitecore.azureedge.net/-/media/files/oru/documents/saveenergyandmoney/using-private-generation-energy-sources/applying-for-private-generation-interconnection-in-new-jersey/interconnection-queue.xlsx?rev=5d8a63aa5321456f86bb8159eb75aead',
  },
]

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

const DEAD_RE = /withdraw|denied|cancel|suspension|rejected/i
const ENERGIZED_RE = /in.?service|permission to operate/i
const yes = (v) => /^\s*y(es)?\b/i.test(String(v ?? ''))

// Header row: within the first ~12 rows, the one carrying a capacity column AND a
// metering/interconnection-type or community-solar indicator (files put a title on row 0).
function detectHeaderRow(aoa) {
  for (let i = 0; i < Math.min(12, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c).toLowerCase())
    const hasCap = cells.some((c) => /capacity/.test(c))
    const hasType = cells.some((c) => /metering|interconnection type|community solar/.test(c))
    if (hasCap && hasType) return i
  }
  return -1
}

// Aggregate one EDC workbook into per-structure buckets.
// Returns { structures: Map<tag, {pipeline_n,pipeline_mw,completed_n,completed_mw}>,
//           tracksEnergized: boolean } or null if no recognizable layout.
function parseEdc(XLSX, wb) {
  for (const sheetName of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false })
    const hdrRow = detectHeaderRow(aoa)
    if (hdrRow < 0) continue
    const hdr = aoa[hdrRow]
    const find = (re) => hdr.findIndex((h) => re.test(String(h)))
    const capIdx = find(/system capacity|capacity \(kw/i)
    const meterIdx = find(/metering.*interconnection type|interconnection type|metering or/i)
    const nmIdx = find(/^\s*net metering\s*$/i)         // RECO boolean column
    const rnmIdx = find(/remote net metering/i)         // RECO boolean column
    const csFlagIdx = find(/community solar/i)           // RECO "Community Solar Project" Yes/No
    const statusIdx = find(/status/i)
    if (capIdx < 0) continue

    const rows = aoa.slice(hdrRow + 1).filter((r) => r && r.length)
    if (!rows.length) continue

    // Live rows = not dead. tracksEnergized: does THIS file expose energized status?
    const live = rows.filter((r) => !(statusIdx >= 0 && DEAD_RE.test(String(r[statusIdx] ?? ''))))
    const tracksEnergized = statusIdx >= 0 && live.some((r) => ENERGIZED_RE.test(String(r[statusIdx] ?? '')))

    const tagOf = (r) => {
      if (meterIdx >= 0) return normalizeMeteringType(r[meterIdx])
      // RECO boolean layout: precedence CS > net metering (incl. remote).
      if (csFlagIdx >= 0 && yes(r[csFlagIdx])) return MT.COMMUNITY_SOLAR
      if ((nmIdx >= 0 && yes(r[nmIdx])) || (rnmIdx >= 0 && yes(r[rnmIdx]))) return MT.NET_METERING
      return MT.UNKNOWN
    }

    const structures = new Map()
    for (const r of live) {
      const tag = tagOf(r)
      if (!structures.has(tag)) structures.set(tag, { pipeline_n: 0, pipeline_mw: 0, completed_n: 0, completed_mw: 0 })
      const a = structures.get(tag)
      const mw = num(r[capIdx]) / 1000 // kW-AC → MW
      if (tracksEnergized && ENERGIZED_RE.test(String(r[statusIdx] ?? ''))) { a.completed_n++; a.completed_mw += mw }
      else { a.pipeline_n++; a.pipeline_mw += mw }
    }
    return { structures, tracksEnergized }
  }
  return null
}

async function fetchEdc(edc, signal) {
  const res = await fetch(edc.url, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) throw new Error(`${edc.utility_name} xlsx fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const parsed = parseEdc(XLSX, wb)
  if (!parsed) throw new Error(`${edc.utility_name}: no recognizable layout — got sheets [${wb.SheetNames.join(', ')}]`)
  return parsed
}

export async function scrapeNjDg(signal) {
  const fetchedAt = new Date().toISOString()
  const rows = []
  const errors = []
  for (const edc of EDCS) {
    try {
      const { structures, tracksEnergized } = await fetchEdc(edc, signal)
      for (const [metering_type, a] of structures) {
        if (a.pipeline_n === 0 && a.completed_n === 0) continue // empty cell — skip
        rows.push({
          state_id:            'NJ',
          iso:                 'PJM',
          utility_name:        edc.utility_name,
          metering_type,
          projects_in_queue:   a.pipeline_n,
          mw_pending:          Math.round(a.pipeline_mw),
          // completed_* observed only when the file exposes energized status;
          // active-only files (JCP&L) leave it null (unknown ≠ zero).
          completed_projects:  tracksEnergized ? a.completed_n : null,
          completed_mw:        tracksEnergized ? Math.round(a.completed_mw) : null,
          avg_study_months:    null, // not observed — never fabricated
          withdrawal_pct:      null,
          avg_upgrade_cost_mw: null,
          queue_trend:         'stable',
          data_source:         'nj_ic_queue',
          data_source_url:     edc.url,
          fetched_at:          fetchedAt,
        })
      }
    } catch (err) {
      errors.push(`${edc.utility_name}: ${err.message}`)
    }
  }
  // If every EDC failed (network/layout), surface it so the cron logs a failure
  // rather than silently wiping NJ. A partial success (some EDCs) is fine.
  if (rows.length === 0 && errors.length) throw new Error(`NJ: all EDCs failed — ${errors.join(' | ')}`)
  return rows
}
