/**
 * NY community-DG scraper — distribution-level CS interconnection signal.
 *
 * Source: NYSERDA "Solar Electric Programs Reported by NYSERDA" on the Open-NY
 * Socrata portal (dataset 3x8r-34rs). Open-NY license permits commercial use +
 * redistribution of derived data.
 *
 * Why this source (not the ISO queue): we verified (scripts/probe-iso-counts.mjs)
 * that ISO transmission queues (NYISO/MISO/CAISO) contain almost no
 * community-scale solar — CS interconnects at the DISTRIBUTION level. NYSERDA's
 * feed carries a `community_distributed_generation` flag and per-project county,
 * utility, capacity (kWdc), and status, so it gives the real CS picture.
 *
 * Signal semantics (honest): this is a DEPLOYMENT-PIPELINE signal, not ISO
 * study-queue depth.
 *   - projects_in_queue / mw_pending  ← project_status = 'Pipeline' (applied, not yet energized)
 *   - completed_projects / completed_mw ← project_status = 'Complete' (energized)
 *   - avg_study_months / withdrawal_pct / avg_upgrade_cost_mw → NULL (not observed; never fabricated)
 * The IX SCORE stays on the curated ixDifficulty baseline; this data is live CONTEXT.
 */

const SODA = 'https://data.ny.gov/resource/3x8r-34rs.json'
export const NYSERDA_DATASET_URL =
  'https://data.ny.gov/Energy-Environment/Solar-Electric-Programs-Reported-by-NYSERDA-Beginn/3x8r-34rs'

// NYSERDA electric_utility strings → canonical display name. All NY utilities.
const UTILITY_CANON = {
  'Consolidated Edison':            'Con Edison',
  'National Grid':                  'National Grid',
  'NYS Electric and Gas':           'NYSEG',
  'Central Hudson Gas and Electric': 'Central Hudson',
  'Orange and Rockland Utilities':  'Orange & Rockland',
  'Rochester Gas and Electric':     'RG&E',
  'Long Island Power Authority':    'LIPA',
}

const num = (v) => Number(v) || 0
const mw1 = (kw) => Math.round((num(kw) / 1000) * 10) / 10   // kWdc → MWdc, 1 dp

async function soda(params, signal) {
  const url = `${SODA}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)', Accept: 'application/json' },
    signal: signal || AbortSignal.timeout(40000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NYSERDA SODA ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * Aggregate CDG=Yes projects by electric utility × status.
 * Returns canonical ix_queue_data rows for state_id='NY'.
 * @param {AbortSignal} [signal]
 */
export async function scrapeNyDg(signal) {
  const raw = await soda({
    $select: 'electric_utility, project_status, count(1) as n, sum(totalnameplatekwdc) as kw',
    $where: "community_distributed_generation='Yes'",
    $group: 'electric_utility, project_status',
    $limit: '1000',
  }, signal)

  const byUtil = new Map()
  for (const r of raw) {
    const canon = UTILITY_CANON[r.electric_utility] || (r.electric_utility || '').trim()
    if (!canon) continue
    if (!byUtil.has(canon)) byUtil.set(canon, { pipeline_n: 0, pipeline_mw: 0, complete_n: 0, complete_mw: 0 })
    const a = byUtil.get(canon)
    if (r.project_status === 'Pipeline') { a.pipeline_n += num(r.n); a.pipeline_mw += mw1(r.kw) }
    else if (r.project_status === 'Complete') { a.complete_n += num(r.n); a.complete_mw += mw1(r.kw) }
  }

  const fetchedAt = new Date().toISOString()
  const rows = []
  for (const [utility, a] of byUtil) {
    // Keep any utility with observed CS activity (pipeline OR completed).
    if (a.pipeline_n === 0 && a.complete_n === 0) continue
    rows.push({
      state_id:            'NY',
      iso:                 'NYISO',
      utility_name:        utility,
      projects_in_queue:   a.pipeline_n,
      mw_pending:          Math.round(a.pipeline_mw),
      completed_projects:  a.complete_n,
      completed_mw:        Math.round(a.complete_mw),
      avg_study_months:    null,   // not observed in NYSERDA — never fabricated
      withdrawal_pct:      null,
      avg_upgrade_cost_mw: null,
      queue_trend:         'stable',
      data_source:         'nyserda_cdg',
      data_source_url:     NYSERDA_DATASET_URL,
      fetched_at:          fetchedAt,
    })
  }
  // Stable ordering: most active pipeline first.
  rows.sort((x, y) => y.projects_in_queue - x.projects_in_queue)
  return rows
}

/**
 * County-level rollup (CDG=Yes), for future county-resolved IX context.
 * Returns [{ county, pipeline_n, pipeline_mw, complete_n, complete_mw }].
 * Not yet written to a table — exposed for the dry-run + a later county layer.
 * @param {AbortSignal} [signal]
 */
export async function scrapeNyDgByCounty(signal) {
  const raw = await soda({
    $select: 'county, project_status, count(1) as n, sum(totalnameplatekwdc) as kw',
    $where: "community_distributed_generation='Yes'",
    $group: 'county, project_status',
    $limit: '1000',
  }, signal)
  const byCounty = new Map()
  for (const r of raw) {
    const c = (r.county || '').trim()
    if (!c) continue
    if (!byCounty.has(c)) byCounty.set(c, { county: c, pipeline_n: 0, pipeline_mw: 0, complete_n: 0, complete_mw: 0 })
    const a = byCounty.get(c)
    if (r.project_status === 'Pipeline') { a.pipeline_n += num(r.n); a.pipeline_mw += mw1(r.kw) }
    else if (r.project_status === 'Complete') { a.complete_n += num(r.n); a.complete_mw += mw1(r.kw) }
  }
  return [...byCounty.values()].sort((x, y) => y.pipeline_n - x.pipeline_n)
}
