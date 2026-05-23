/**
 * Hosting-capacity scraper — distribution grid HEADROOM per utility, for the
 * IX pillar's live CONTEXT (not the SITE pillar — that's NWI/SSURGO in
 * county_geospatial_data; zero overlap).
 *
 * Source: utility hosting-capacity / ICA ArcGIS feature services (EPRI-format
 * "available capacity" grids). We aggregate ENTIRELY server-side (count + count
 * over a CS-relevant threshold + avg/max via outStatistics) — no row pulling,
 * no client-side parsing — so it's fast + cron-safe. Writes hosting_capacity_data.
 *
 * Honesty: grid headroom is a DIFFERENT metric than a project queue. It is shown
 * as live context; the IX score stays on the curated ixDifficulty baseline.
 *
 * Adding a utility = add a verified entry to FEEDS (state, utility, layer URL,
 * numeric capacity field, threshold). Each utility's ArcGIS layout differs, so
 * VERIFY a feed (numeric field + manageable count + server-side stats work)
 * before adding it. See docs/hosting-capacity-sourcing.md.
 *
 * Verified clean (2026-05-23): BGE (MD). Candidates to verify + add: PHI
 * (Pepco/Delmarva/ACE → MD/DE/NJ/DC), PECO (PA), PG&E + SCE (CA). NOT viable:
 * Ameren IL (text/multi-value field, 1.67M cells) — needs a different approach.
 */

import { supabaseAdmin } from './_scraperBase.js'

const CS_THRESHOLD_MW = 5  // a CS-relevant amount of open feeder headroom

// Each feed: an ArcGIS FeatureServer LAYER url + the numeric capacity field.
const FEEDS = [
  {
    state: 'MD',
    utility_name: 'BGE',
    url: 'https://services3.arcgis.com/agWTKEK7X5K1Bx7o/arcgis/rest/services/BGE_HOSTING_CAPACITY_EPRI_AGOL/FeatureServer/1',
    capField: 'Sum_FEEDER_AVAIL_CAP_MW_MIN',  // MW
    grid_resolution: 'mile_square',
  },
  {
    state: 'PA',
    utility_name: 'PECO',
    url: 'https://services3.arcgis.com/agWTKEK7X5K1Bx7o/arcgis/rest/services/PECO_Available_Distribution_Capacity_Map/FeatureServer/0',
    capField: 'NET_AVAILABLE_CAPACITY',  // MW (verified: avg 4.6, max 19.9)
    grid_resolution: 'major_quad',
  },
  // Verified NOT usable (kept here so we don't re-investigate):
  //  - PHI (Pepco/Delmarva/ACE): Feeder_Large_Gen_HC is kW + capped at 3MW (murky semantics).
  //  - PG&E (CA): LineDetail GenericPVCapacity_kW = 1.3M segments (too granular for server-side agg).
  //  - Ameren IL: MAXGENMW_TXT is text/multi-value, 1.67M cells.
  //  - SCE (CA): data behind an Open-Data hub search page; FeatureServer not yet resolved.
]

async function arcgis(layerUrl, params, signal) {
  const url = `${layerUrl}/query?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`ArcGIS ${res.status} on ${layerUrl}`)
  const j = await res.json()
  if (j.error) throw new Error(`ArcGIS error: ${j.error.message || JSON.stringify(j.error).slice(0, 120)}`)
  return j
}

async function aggregateFeed(feed, signal) {
  const total = await arcgis(feed.url, { where: '1=1', returnCountOnly: 'true', f: 'json' }, signal)
  const withCap = await arcgis(feed.url, { where: `${feed.capField} >= ${CS_THRESHOLD_MW}`, returnCountOnly: 'true', f: 'json' }, signal)
  const stats = await arcgis(feed.url, {
    where: '1=1',
    outStatistics: JSON.stringify([
      { statisticType: 'avg', onStatisticField: feed.capField, outStatisticFieldName: 'avg_mw' },
      { statisticType: 'max', onStatisticField: feed.capField, outStatisticFieldName: 'max_mw' },
    ]),
    f: 'json',
  }, signal)

  const totalCells = total.count || 0
  const cellsWithCapacity = withCap.count || 0
  const a = stats.features?.[0]?.attributes || {}
  if (totalCells === 0) throw new Error(`${feed.utility_name}: 0 cells returned`)

  return {
    state:                 feed.state,
    utility_name:          feed.utility_name,
    county_fips:           null,
    grid_resolution:       feed.grid_resolution,
    metric_field:          feed.capField,
    total_cells:           totalCells,
    cells_with_capacity:   cellsWithCapacity,
    capacity_threshold_mw: CS_THRESHOLD_MW,
    pct_with_capacity:     Math.round((cellsWithCapacity / totalCells) * 1000) / 10,
    avg_avail_mw:          a.avg_mw != null ? Math.round(a.avg_mw * 10) / 10 : null,
    max_avail_mw:          a.max_mw != null ? Math.round(a.max_mw * 10) / 10 : null,
    data_source:           'arcgis_hc',
    data_source_url:       feed.url,
    fetched_at:            new Date().toISOString(),
  }
}

/** Returns ready-to-upsert hosting_capacity_data rows (one per FEED). */
export async function scrapeHostingCapacity(signal) {
  const rows = []
  const errors = []
  for (const feed of FEEDS) {
    try { rows.push(await aggregateFeed(feed, signal)) }
    catch (err) { errors.push(`${feed.utility_name}: ${err.message}`) }
  }
  return { rows, errors }
}

/**
 * refresh-data.js handler shape: fetch + aggregate all FEEDS, upsert to
 * hosting_capacity_data, return { ok, ... } for cron logging. Runs via the
 * admin Refresh button (?source=hosting_capacity) + the weekly cron.
 */
export default async function refreshHostingCapacity() {
  const { rows, errors } = await scrapeHostingCapacity()
  if (rows.length === 0) {
    return { ok: false, error: `hosting-capacity: 0 rows aggregated`, feed_errors: errors }
  }
  const { error } = await supabaseAdmin
    .from('hosting_capacity_data')
    .upsert(rows, { onConflict: 'state,utility_name' })
  if (error) {
    return { ok: false, error: error.message, attempted: rows.length, feed_errors: errors }
  }
  return {
    ok: true,
    utilities_updated: rows.length,
    feed_errors: errors.length ? errors : undefined,
    sample: rows[0],
  }
}
