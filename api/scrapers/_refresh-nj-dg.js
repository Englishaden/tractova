/**
 * NJ community-DG scraper — distribution-level CS interconnection signal.
 *
 * Source: JCP&L (FirstEnergy) monthly NJ Interconnection Queue Report (.xlsx),
 * published per NJ BPU Order (docket QO21010085). Government-mandated public
 * compliance filing — no redistribution restriction.
 *
 * Coverage caveat: this is ONE of NJ's four EDCs (JCP&L). PSE&G, Atlantic City
 * Electric, and Rockland file via the BPU docket as PDFs (not yet wired). So NJ
 * coverage here = JCP&L service territory only.
 *
 * Signal: the file has an explicit "Metering or Interconnection Type" column
 * with a "Community Solar" value — the clean CS filter (like NY's CDG flag).
 * Capacity is in kW AC. The file lists ACTIVE-queue projects only (no energized
 * history), so completed_* is null. Same honest model as NY: deployment-pipeline
 * CONTEXT, score stays on the curated ixDifficulty baseline.
 */

const JCPL_URL =
  'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx'

const num = (v) => Number(v) || 0

// Match a column by a regex against the header text (headers contain \r\n).
function findCol(cols, re) {
  return cols.find((c) => re.test(String(c).replace(/\s+/g, ' ')))
}

export async function scrapeNjDg(signal) {
  const res = await fetch(JCPL_URL, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) throw new Error(`JCP&L xlsx fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets['JCPL Monthly Queue']
  if (!sheet) throw new Error(`JCP&L: 'JCPL Monthly Queue' sheet missing — got [${wb.SheetNames.join(', ')}]`)
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: '' })  // header = row index 1
  if (!rows.length) throw new Error('JCP&L: no rows parsed')

  const cols = Object.keys(rows[0])
  const meterCol = findCol(cols, /metering.*interconnection type/i)
  const capCol = findCol(cols, /system capacity/i)
  const statusCol = findCol(cols, /status of project/i)
  if (!meterCol || !capCol) {
    throw new Error(`JCP&L: column layout shifted (meter=${!!meterCol} cap=${!!capCol})`)
  }

  // Community Solar only (the clean CS filter), exclude withdrawn/denied.
  const cs = rows.filter((r) => {
    const meter = String(r[meterCol] || '').trim().toLowerCase()
    const status = String(r[statusCol] || '').trim().toLowerCase()
    return meter === 'community solar' && !/withdraw|denied|cancel/.test(status)
  })

  const pipelineMw = cs.reduce((a, r) => a + num(r[capCol]) / 1000, 0)  // kW → MW

  return [{
    state_id:            'NJ',
    iso:                 'PJM',
    utility_name:        'JCP&L',
    projects_in_queue:   cs.length,
    mw_pending:          Math.round(pipelineMw),
    completed_projects:  null,   // file is active-queue only — no energized history
    completed_mw:        null,
    avg_study_months:    null,   // not observed — never fabricated
    withdrawal_pct:      null,
    avg_upgrade_cost_mw: null,
    queue_trend:         'stable',
    data_source:         'nj_ic_queue',
    data_source_url:     JCPL_URL,
    fetched_at:          new Date().toISOString(),
  }]
}
