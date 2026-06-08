/**
 * FEMA National Risk Index (NRI) county flood ingest — Wave 3, third site
 * constraint. Aden picked NRI over an NFHL per-county area-clip: clean
 * county-keyed data, NO geometry math, fully verifiable (a few paginated
 * fetches of a ~3,142-row table — unlike the throttle-prone per-county NWI/SSURGO
 * ArcGIS clips). NRI updates ~annually, so this is light + safe to run in the
 * weekly `all` bundle (no new cron — keeps the cron count where it is).
 *
 * Writes flood_risk_score + flood_risk_rating onto county_geospatial_data via a
 * merge-upsert on county_fips (wetland/farmland columns untouched). Gated to the
 * canonical county FIPS set so NRI's territory rows (PR/VI/GU…) don't leak in.
 */
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'
import { NRI_FEATURESERVER, NRI_FLOOD_FIELDS, worstFlood } from './_floodNri.js'
import { uspsFromStateFips } from './_nwiWetland.js'

const PAGE = 1000  // ArcGIS resultRecordCount per page

// Load the canonical 5-digit county FIPS set from county_acs_data, paginated
// (PostgREST caps a response at 1000 — the same trap that silently broke the
// SSURGO refresh). Used to drop NRI territory/non-county rows.
async function loadCanonicalFips() {
  const set = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('county_acs_data')
      .select('county_fips')
      .range(from, from + 999)
    if (error) throw new Error(`canonical FIPS load: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) set.add(r.county_fips)
    if (data.length < 1000) break
  }
  return set
}

export default async function refreshFloodNri() {
  const start = Date.now()
  let validFips
  try {
    validFips = await loadCanonicalFips()
  } catch (e) {
    return { ok: false, error: e.message }
  }
  if (validFips.size < 3000) {
    return { ok: false, error: `Canonical FIPS set too small (${validFips.size}); aborting to avoid mis-gating NRI rows.` }
  }

  // Paginate the NRI county FeatureServer.
  const upsertRows = []
  let fetched = 0
  let skippedNonCounty = 0
  for (let offset = 0; ; offset += PAGE) {
    const u = new URL(NRI_FEATURESERVER)
    u.searchParams.set('where', '1=1')
    u.searchParams.set('outFields', NRI_FLOOD_FIELDS.join(','))
    u.searchParams.set('returnGeometry', 'false')
    u.searchParams.set('resultOffset', String(offset))
    u.searchParams.set('resultRecordCount', String(PAGE))
    u.searchParams.set('f', 'json')
    let json
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Tractova/1.0 (community-solar intel; aden.walker67@gmail.com)' } })
      json = await r.json()
    } catch (e) {
      return { ok: false, error: `NRI fetch (offset ${offset}): ${e.message}`, fetched }
    }
    if (json.error) return { ok: false, error: `NRI ArcGIS: ${json.error.message}`, fetched }
    const feats = json.features || []
    if (feats.length === 0) break
    for (const f of feats) {
      const a = f.attributes || {}
      fetched += 1
      const fips = String(a.STCOFIPS || '').trim()
      if (!validFips.has(fips)) { skippedNonCounty += 1; continue }
      // `state` is NOT NULL on county_geospatial_data — and this is a merge-upsert
      // that INSERTs a fresh row for any county not already present (e.g. one with
      // no wetland/farmland row yet), so every row must carry it. Derive it
      // deterministically from the FIPS prefix (FIPS→USPS is canonical) rather
      // than trust NRI's STATEABBRV string. (Bug fix: the first cut omitted state
      // and the batch insert failed the not-null constraint.)
      const state = uspsFromStateFips(fips.slice(0, 2))
      if (!state) { skippedNonCounty += 1; continue }
      const { rating, score } = worstFlood(a.IFLD_RISKR, a.IFLD_RISKS, a.CFLD_RISKR, a.CFLD_RISKS)
      // Only write counties NRI actually rates — an unrated county stays null
      // (no flood penalty), not a fabricated "none" row.
      if (rating === 'none' && score == null) continue
      upsertRows.push({
        county_fips:        fips,
        state,
        flood_risk_rating:  rating,
        flood_risk_score:   score,
        flood_last_updated: new Date().toISOString(),
      })
    }
    if (feats.length < PAGE) break
  }

  if (upsertRows.length < 2000) {
    return { ok: false, error: `Only ${upsertRows.length} counties rated by NRI (fetched ${fetched}); expected ~3,000. Aborting to avoid committing a degraded set.`, fetched, skippedNonCounty }
  }

  // Merge-upsert in batches — touches only the flood columns, leaving
  // wetland/farmland intact (same discipline as the wetland + farmland refreshers).
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const slice = upsertRows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('county_geospatial_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) return { ok: false, error: `upsert batch ${i / BATCH}: ${error.message}`, partial_upserted: upserted }
    upserted += slice.length
  }

  const highRisk = upsertRows.filter(r => r.flood_risk_rating === 'relatively_high' || r.flood_risk_rating === 'very_high').length
  return {
    ok: true,
    counties_upserted: upserted,
    high_risk_counties: highRisk,
    fetched,
    skipped_non_county: skippedNonCounty,
    elapsed_ms: Date.now() - start,
  }
}
