/**
 * Terrain-slope handler (Phase 3a) — syncs county_geospatial_data's
 * slope_developable_pct + slope_mean_deg from the committed artifact
 * src/data/countySlope.js.
 *
 * Slope is STATIC (terrain doesn't change), and a full 3DEP backfill is ~3,142
 * ImageServer calls — far past what a 300s Vercel function (or the session
 * fetch budget) allows. So the expensive computation runs OFFLINE in
 * scripts/seed-county-slope.mjs and is committed; this handler just re-syncs the
 * DB from whatever coverage the artifact holds. STATIC → BUNDLE_EXCLUDED in
 * refresh-data.js; runs on the admin "Refresh slope" button + restore.
 *
 * Coverage note: unlike nmtc_lic/protected_land (full 3,142 in one offline
 * pass), the slope artifact may be PARTIAL — the full backfill is gated on a
 * fetch-budget OK. This handler upserts whatever is present and reports the
 * count honestly; it does NOT require a full set (an empty artifact is a no-op,
 * not an error). Merge-upserts only the slope columns.
 */
import { supabaseAdmin } from './_scraperBase.js'
import { COUNTY_SLOPE, COUNTY_SLOPE_META } from '../../src/data/countySlope.js'

export default async function refreshSlope() {
  if (!Array.isArray(COUNTY_SLOPE)) {
    return { ok: false, error: 'countySlope artifact malformed; re-run scripts/seed-county-slope.mjs' }
  }
  if (COUNTY_SLOPE.length === 0) {
    return { ok: true, counties_upserted: 0, note: 'slope artifact empty — run scripts/seed-county-slope.mjs --all (gated) to backfill' }
  }

  const nowIso = new Date().toISOString()
  const rows = COUNTY_SLOPE.map(c => ({
    county_fips:           c.county_fips,
    state:                 c.state,
    slope_developable_pct: c.slope_developable_pct,
    slope_mean_deg:        c.slope_mean_deg,
    slope_last_updated:    nowIso,
  }))

  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('county_geospatial_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return { ok: false, error: `Upsert failed at batch ${i / BATCH}: ${error.message}`, partial_upserted: upserted }
    }
    upserted += slice.length
  }

  const constrained = rows.filter(r => r.slope_developable_pct != null && r.slope_developable_pct < 40).length
  return {
    ok:                   true,
    counties_upserted:    upserted,
    counties_constrained: constrained,   // <40% developable (terrain flag)
    coverage_note:        `${upserted} counties in artifact (full set = 3,142; backfill gated on fetch-budget OK)`,
    dataset_version:      COUNTY_SLOPE_META.datasetVersion,
    source:               'committed artifact (USGS 3DEP Slope Degrees)',
  }
}
