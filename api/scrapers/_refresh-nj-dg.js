/**
 * NJ community-DG scraper — all NJ EDCs' BPU-mandated monthly interconnection
 * queue inventories (Docket QO21010085, monthly filings begun Nov 2025).
 *
 * EDCs: JCP&L (FirstEnergy), PSE&G, Rockland Electric (RECO, ConEd/O&R), and
 * Atlantic City Electric (ACE, Exelon). Each posts a monthly .xlsx; we filter to
 * Community Solar and report per-EDC pipeline counts + MW. ACE's file URL is
 * JS-rendered on atlanticcityelectric.com (not yet isolated without a headless
 * browser) — wire it here when found.
 *
 * License: government-mandated public compliance filing — strong public-record
 * footing (see docs/data-license-rationale.md). Aggregate-only: we store per-EDC
 * counts + MW, never the per-project rows.
 *
 * Signal (cs_pipeline): these are ACTIVE-queue inventories (no energized history)
 * → completed_* null. Same honest model as before: deployment-pipeline CONTEXT,
 * IX score stays on the curated ixDifficulty baseline.
 *
 * Two file layouts are handled (auto-detected):
 *   - a single "Metering or interconnection type" column = "Community Solar"
 *     (JCP&L, PSE&G)
 *   - separate Yes/No "Community Solar Project" column (RECO)
 * An EDC with 0 community-solar projects is SKIPPED (it auto-appears once it has
 * CS activity) — unknown ≠ zero, and a 0-row adds no signal.
 */

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
  // Atlantic City Electric (ACE, Exelon): BPU-mandated monthly queue exists, but
  // the download link is JS-rendered on atlanticcityelectric.com — URL not yet
  // isolated. Add { utility_name: 'Atlantic City Electric', url: ... } when found.
]

const num = (v) => Number(v) || 0

// Find the header row within the first ~10 rows: the one carrying both a
// capacity column and a CS/metering indicator (layouts put a title on row 0).
function detectHeaderRow(aoa) {
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c).toLowerCase())
    const hasCap = cells.some((c) => /capacity/.test(c))
    const hasCs = cells.some((c) => /metering|interconnection type|community solar/.test(c))
    if (hasCap && hasCs) return i
  }
  return -1
}

// Parse one EDC workbook → { count, mw } of Community Solar pipeline projects.
function parseEdc(XLSX, wb) {
  for (const sheetName of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false })
    const hdrRow = detectHeaderRow(aoa)
    if (hdrRow < 0) continue
    const hdr = aoa[hdrRow]
    const find = (re) => hdr.findIndex((h) => re.test(String(h)))
    const capIdx = find(/system capacity|capacity \(kw/i)
    const meterIdx = find(/metering.*interconnection type|interconnection type/i)
    const csFlagIdx = find(/community solar/i)   // separate Yes/No column layout
    const statusIdx = find(/status/i)
    if (capIdx < 0) continue

    let rows = aoa.slice(hdrRow + 1).filter((r) => r && r.length)
    let cs
    if (meterIdx >= 0) {
      // Single column whose VALUE names the metering type (JCP&L, PSE&G).
      cs = rows.filter((r) => /community solar/i.test(String(r[meterIdx] || '')))
    } else if (csFlagIdx >= 0) {
      // Separate boolean "Community Solar Project" = Yes (RECO).
      cs = rows.filter((r) => /^\s*yes\b/i.test(String(r[csFlagIdx] || '')))
    } else {
      continue
    }
    if (statusIdx >= 0) cs = cs.filter((r) => !/withdraw|denied|cancel/i.test(String(r[statusIdx] || '')))

    const mw = cs.reduce((a, r) => a + num(r[capIdx]) / 1000, 0)  // kW → MW
    return { count: cs.length, mw: Math.round(mw) }
  }
  return null  // no recognizable layout
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
  if (!parsed) throw new Error(`${edc.utility_name}: no recognizable CS column layout — got sheets [${wb.SheetNames.join(', ')}]`)
  return parsed
}

export async function scrapeNjDg(signal) {
  const fetchedAt = new Date().toISOString()
  const rows = []
  const errors = []
  for (const edc of EDCS) {
    try {
      const { count, mw } = await fetchEdc(edc, signal)
      if (count === 0) continue  // skip EDCs with no CS in queue (auto-appears later)
      rows.push({
        state_id:            'NJ',
        iso:                 'PJM',
        utility_name:        edc.utility_name,
        projects_in_queue:   count,
        mw_pending:          mw,
        completed_projects:  null,   // active-queue inventory — no energized history
        completed_mw:        null,
        avg_study_months:    null,   // not observed — never fabricated
        withdrawal_pct:      null,
        avg_upgrade_cost_mw: null,
        queue_trend:         'stable',
        data_source:         'nj_ic_queue',
        data_source_url:     edc.url,
        fetched_at:          fetchedAt,
      })
    } catch (err) {
      errors.push(`${edc.utility_name}: ${err.message}`)
    }
  }
  // If every EDC failed (network/layout), surface it so the cron logs a failure
  // rather than silently wiping NJ. A partial success (some EDCs) is fine.
  if (rows.length === 0 && errors.length) throw new Error(`NJ: all EDCs failed — ${errors.join(' | ')}`)
  return rows
}
