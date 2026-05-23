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

const CS_THRESHOLD_MW = 5  // legacy single threshold (kept for the cells_with_capacity column)
// Capture EVERY size, smallest → sub-50MW. 0.15 = 150kW, 0.5 = 500kW. Don't drop
// small projects — the Lens picks the bucket nearest the developer's project MW.
const CS_THRESHOLDS_MW = [0.15, 0.5, 1, 2, 3, 5, 10, 20, 50]

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
    capField: 'NET_AVAILABLE_CAPACITY', unit: 'MW',  // verified: avg 4.6, max 19.9
    grid_resolution: 'major_quad',
  },
  {
    state: 'MA',
    utility_name: 'National Grid',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/MASDP/MASDP_HostingCapacity/MapServer/0',
    capField: 'HC_Available_MW', unit: 'MW',  // verified: 967 feeders, 303 ≥5MW, max 19.4
    grid_resolution: 'feeder',
  },
  {
    state: 'NY',
    utility_name: 'National Grid',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/NYSDP/Hosting_Capacity_Data/MapServer/0',
    capField: 'feeder_max_hc', unit: 'MW',  // verified: 1912 feeders, 487 ≥5MW, max 10
    grid_resolution: 'feeder',
  },
  {
    state: 'NY',
    utility_name: 'Con Edison',
    url: 'https://services.arcgis.com/ciPnsNFi1JLWVjva/arcgis/rest/services/CECONY_NodalHCV_Prod/FeatureServer/0',
    capField: 'LOCAL_MAX', unit: 'MW',  // verified: 82,810 segments, 17,705 ≥5MW, max 19.3
    grid_resolution: 'nodal_segment',
  },
  {
    state: 'NY',
    utility_name: 'Orange & Rockland',
    url: 'https://services.arcgis.com/ciPnsNFi1JLWVjva/arcgis/rest/services/ORU_NodalHCV_Prod/FeatureServer/0',
    capField: 'LOCAL_MAX', unit: 'MW',  // verified: 88,930 segments, 27,528 ≥5MW, max 10
    grid_resolution: 'nodal_segment',
  },
  {
    state: 'NY',
    utility_name: 'Central Hudson',
    url: 'https://services1.arcgis.com/CEN9MBRF2dIzEmKF/arcgis/rest/services/Hosting_Capacity_Stage3/FeatureServer/0',
    capField: 'HCMin', unit: 'MW',  // verified: HCMin (conservative); MaxHostingCapacity is null. 306k segments, max 6
    grid_resolution: 'segment',
  },
  {
    state: 'NY',
    utility_name: 'NYSEG / RG&E',
    url: 'https://services.arcgis.com/c0HK6TaWF3mGiNhc/arcgis/rest/services/HostingCapacity_DCirc_NYSEG_RGE/FeatureServer/0',
    capField: 'MAX_HC_MVA_2', unit: 'MW',  // verified: 23,344 conductors, 1,112 ≥5MW, max 20
    grid_resolution: 'conductor',
  },
  {
    state: 'CA',
    utility_name: 'SCE',
    url: 'https://drpep.sce.com/arcgis_server/rest/services/hosted/ica_layer/FeatureServer/2',
    capField: 'ica_overall_pv', unit: 'MW',  // verified: 667,140 circuit segments, 121,167 ≥5MW, max 103
    grid_resolution: 'circuit_segment',
  },
  {
    state: 'CA',
    utility_name: 'PG&E',
    url: 'https://services2.arcgis.com/mJaJSax0KPHoCNB6/ArcGIS/rest/services/DRPComplianceRelProd/FeatureServer/3',
    capField: 'GenericPVCapacity_kW', unit: 'kW',  // verified: 1.3M line segments, server-side aggregates in ~6s, max 14.8MW
    grid_resolution: 'line_segment',
  },
  {
    state: 'CT',
    utility_name: 'Eversource',
    url: 'https://epochprodgasdist.eversource.com/wamgasgis/rest/services/EV_Hosting/EV_HC_Capacity_CT/MapServer/0',
    capField: 'FEEDER_CAPACITY_TO_MAP_MW', unit: 'MW',  // verified: 663,775 segments, 105k ≥5MW. MapServer: max via orderBy (no outStatistics).
    grid_resolution: 'feeder_segment',
  },
  {
    state: 'ME',
    utility_name: 'Central Maine Power',
    url: 'https://services.arcgis.com/c0HK6TaWF3mGiNhc/arcgis/rest/services/CMP_Hosting_Capacity/FeatureServer/0',
    capField: 'HostingCapNumTemp', unit: 'kW',  // verified (Avangrid): 204,541 segments, 60,546 ≥5MW, max 30MW
    grid_resolution: 'segment',
  },
  {
    state: 'RI',
    utility_name: 'Rhode Island Energy',
    url: 'https://systemdataportal.nationalgrid.com/arcgis/rest/services/RISDP/Hosting_Capacity_All/MapServer/0',
    capField: 'Max_HC', unit: 'MW',  // verified: 24,284 feeders, 10,189 ≥5MW, max 27MW (data Apr 2024)
    grid_resolution: 'feeder',
  },
  {
    state: 'CO',
    utility_name: 'Xcel Energy',
    url: 'https://services1.arcgis.com/eM84fwjsSggLQk61/arcgis/rest/services/PSCO22Final/FeatureServer/0',
    capField: 'MaxMW', unit: 'MW', parse: true,  // STRING field → pull+parse. 97,699 segments.
    grid_resolution: 'segment',
  },
  {
    state: 'MN',
    utility_name: 'Xcel Energy',
    url: 'https://services1.arcgis.com/eM84fwjsSggLQk61/arcgis/rest/services/NSPM_may2025_popUps/FeatureServer/3',
    capField: 'Maximum_Available_Hosting_Capac', unit: 'MW', parse: true,  // STRING field → pull+parse. 167,482 segments (May 2025).
    grid_resolution: 'segment',
  },
  // Verified NOT usable (kept here so we don't re-investigate):
  //  - Avista (WA): GEN_MAX_KW caps at 100kW — not feeder HC (wrong scale, would mislead).
  //  - PHI (Pepco/Delmarva/ACE): Feeder_Large_Gen_HC kW capped at 3MW (murky).
  //  - DTE (MI): Hosting__1 caps at 1MW. Dominion (VA): LIMIT_VAL bucketed integer codes.
  //  - UI (CT): only SYMBOLCOLOR, no MW. Versant (ME): SaaS. PSE (WA): gated. HECO (HI): address tool.
  //  - Ameren IL: text/multi-value 1.67M. ComEd IL / PacifiCorp / PGE-OR / FPL / Duke / APS / NV / GA / PNM / WE / Alliant / Consumers / Appalachian / Seattle CL: gated or no open feed.
]

async function arcgis(layerUrl, params, signal) {
  const url = `${layerUrl}/query?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
    signal: signal || AbortSignal.timeout(60000),  // some self-hosted MapServers (Eversource) are slow
  })
  if (!res.ok) throw new Error(`ArcGIS ${res.status} on ${layerUrl}`)
  const j = await res.json()
  if (j.error) throw new Error(`ArcGIS error: ${j.error.message || JSON.stringify(j.error).slice(0, 120)}`)
  return j
}

function buildRow(feed, { totalCells, sitesByThreshold, maxMw }) {
  if (totalCells === 0) throw new Error(`${feed.utility_name}: 0 cells returned`)
  const cellsWithCapacity = sitesByThreshold[String(CS_THRESHOLD_MW)] ?? 0
  return {
    state:                 feed.state,
    utility_name:          feed.utility_name,
    county_fips:           null,
    grid_resolution:       feed.grid_resolution,
    metric_field:          feed.capField,
    total_cells:           totalCells,
    cells_with_capacity:   cellsWithCapacity,
    capacity_threshold_mw: CS_THRESHOLD_MW,
    sites_by_threshold:    sitesByThreshold,
    pct_with_capacity:     Math.round((cellsWithCapacity / totalCells) * 1000) / 10,
    avg_avail_mw:          null,  // not displayed; avoids an outStatistics dependency some MapServers lack
    max_avail_mw:          maxMw != null ? Math.round(maxMw * 10) / 10 : null,
    data_source:           'arcgis_hc',
    data_source_url:       feed.url,
    fetched_at:            new Date().toISOString(),
  }
}

// Server-side path (numeric fields): count + per-threshold counts via the API,
// max via orderBy (robust — works on MapServers that lack outStatistics).
async function aggregateServerSide(feed, signal) {
  const toMw = feed.unit === 'kW' ? 0.001 : 1
  const total = await arcgis(feed.url, { where: '1=1', returnCountOnly: 'true', f: 'json' }, signal)
  const bucketCounts = await Promise.all(
    CS_THRESHOLDS_MW.map(mw =>
      arcgis(feed.url, { where: `${feed.capField} >= ${mw / toMw}`, returnCountOnly: 'true', f: 'json' }, signal)
        .then(r => [String(mw), r.count || 0])
    )
  )
  // max: outStatistics first (works on most FeatureServers), fall back to
  // orderBy DESC (works on MapServers that lack outStatistics, e.g. Eversource).
  let maxMw = null
  try {
    const s = await arcgis(feed.url, { where: '1=1', outStatistics: JSON.stringify([{ statisticType: 'max', onStatisticField: feed.capField, outStatisticFieldName: 'mx' }]), f: 'json' }, signal)
    const v = s.features?.[0]?.attributes?.mx
    if (v != null && Number.isFinite(Number(v))) maxMw = Number(v) * toMw
  } catch { /* fall through */ }
  if (maxMw == null) {
    try {
      const m = await arcgis(feed.url, { where: '1=1', outFields: feed.capField, orderByFields: `${feed.capField} DESC`, resultRecordCount: '1', returnGeometry: 'false', f: 'json' }, signal)
      const v = m.features?.[0]?.attributes?.[feed.capField]
      if (v != null && Number.isFinite(Number(v))) maxMw = Number(v) * toMw
    } catch { /* max is best-effort */ }
  }
  return buildRow(feed, { totalCells: total.count || 0, sitesByThreshold: Object.fromEntries(bucketCounts), maxMw })
}

// Pull+parse path (STRING capacity fields, e.g. Xcel): page through the field
// only, parseFloat each, count buckets + max locally. For string fields the API
// can't filter/aggregate numerically, so we must read every value.
async function aggregatePull(feed, signal) {
  const toMw = feed.unit === 'kW' ? 0.001 : 1
  const PAGE = 2000
  let offset = 0, total = 0, maxV = 0
  const counts = Object.fromEntries(CS_THRESHOLDS_MW.map(m => [String(m), 0]))
  for (;;) {
    const r = await arcgis(feed.url, { where: '1=1', outFields: feed.capField, returnGeometry: 'false', resultOffset: String(offset), resultRecordCount: String(PAGE), f: 'json' }, signal)
    const feats = r.features || []
    for (const f of feats) {
      const v = parseFloat(f.attributes[feed.capField])
      if (!Number.isFinite(v)) continue
      total++
      if (v > maxV) maxV = v
      const vMw = v * toMw
      for (const m of CS_THRESHOLDS_MW) if (vMw >= m) counts[String(m)]++
    }
    const more = r.exceededTransferLimit === true || (r.exceededTransferLimit === undefined && feats.length === PAGE)
    offset += feats.length
    if (!more || feats.length === 0 || offset > 600000) break
  }
  return buildRow(feed, { totalCells: total, sitesByThreshold: counts, maxMw: maxV * toMw })
}

async function aggregateFeed(feed, signal) {
  return feed.parse ? aggregatePull(feed, signal) : aggregateServerSide(feed, signal)
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
