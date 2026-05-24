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

import { MT } from './_meteringType.js'

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
 * CAPTURE-ALL + TAG (scope decision 2026-05-23): aggregate EVERY NY-Sun
 * distributed-solar project by electric utility × status × monetization
 * structure, instead of filtering to community DG only. Structure tag from the
 * `community_distributed_generation` flag:
 *   - Yes → community_solar
 *   - No  → net_metering  (customer-sited NY-Sun is net-metered / VDER; the
 *           2026-05-24 spike showed CDG=No is 95% residential rooftop + small
 *           commercial — none community solar, none wholesale. `net_metering` is
 *           the honest family-level tag; the dataset carries no finer
 *           net-metering-vs-VDER mechanism column, so we don't invent one.)
 *
 * Aggregate-only (count + MW per group), never per-project rows. Same honest
 * model: deployment-pipeline signal (Pipeline=applied, Complete=energized), no
 * study-months → those stay null; the IX score uses the curated baseline.
 *
 * @param {AbortSignal} [signal]
 */
export async function scrapeNyDg(signal) {
  const raw = await soda({
    $select: 'electric_utility, project_status, community_distributed_generation, count(1) as n, sum(totalnameplatekwdc) as kw',
    $group: 'electric_utility, project_status, community_distributed_generation',
    $limit: '2000',
  }, signal)

  // Group by (utility, metering_type). Require a recognized NY EDC — drops
  // non-utility placeholders (e.g. "Statewide") that appear in the broader,
  // unfiltered dataset; the 7 NY IOUs + LIPA are all in UTILITY_CANON.
  const byKey = new Map()
  for (const r of raw) {
    const utility = UTILITY_CANON[r.electric_utility]
    if (!utility) continue
    const metering_type = r.community_distributed_generation === 'Yes' ? MT.COMMUNITY_SOLAR : MT.NET_METERING
    const key = `${utility}|${metering_type}`
    if (!byKey.has(key)) byKey.set(key, { utility, metering_type, pipeline_n: 0, pipeline_mw: 0, complete_n: 0, complete_mw: 0 })
    const a = byKey.get(key)
    if (r.project_status === 'Pipeline') { a.pipeline_n += num(r.n); a.pipeline_mw += mw1(r.kw) }
    else if (r.project_status === 'Complete') { a.complete_n += num(r.n); a.complete_mw += mw1(r.kw) }
  }

  const fetchedAt = new Date().toISOString()
  const rows = []
  for (const a of byKey.values()) {
    // Keep any (utility, structure) cell with observed activity (pipeline OR completed).
    if (a.pipeline_n === 0 && a.complete_n === 0) continue
    rows.push({
      state_id:            'NY',
      iso:                 'NYISO',
      utility_name:        a.utility,
      metering_type:       a.metering_type,
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
  // CS structure first, then by pipeline size — stable, CS-wedge-forward ordering.
  rows.sort((x, y) =>
    x.metering_type === y.metering_type
      ? y.projects_in_queue - x.projects_in_queue
      : (x.metering_type === MT.COMMUNITY_SOLAR ? -1 : 1))
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
