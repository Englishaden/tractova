/**
 * PAD-US protected-land handler (Phase 3b) — syncs county_geospatial_data's
 * protected_area_pct from the committed artifact src/data/padusProtected.js.
 *
 * Mirrors _refresh-nmtc-lic.js: PAD-US is a STATIC source (protected-area
 * boundaries update on multi-year cadences), so the per-county GAP-1+2 share is
 * derived offline by scripts/seed-padus-protected.mjs (USGS PAD-US 4.1
 * Uni_Counties CSV ÷ Census Gazetteer land area) and committed; this handler
 * just re-syncs the DB from that artifact. STATIC → BUNDLE_EXCLUDED in
 * refresh-data.js; runs on the admin "Refresh protected_land" button +
 * restore-from-snapshot.
 *
 * Merge-upserts ONLY the protected columns (county_fips + state required;
 * wetland/farmland/flood/slope columns untouched), same discipline as the
 * wetland/flood refreshers.
 */
import { supabaseAdmin } from './_scraperBase.js'
import { PADUS_PROTECTED_COUNTIES, PADUS_PROTECTED_META } from '../../src/data/padusProtected.js'

export default async function refreshPadusProtected() {
  if (!Array.isArray(PADUS_PROTECTED_COUNTIES) || PADUS_PROTECTED_COUNTIES.length < 3000) {
    return { ok: false, error: `padusProtected artifact missing/short (${PADUS_PROTECTED_COUNTIES?.length}); re-run scripts/seed-padus-protected.mjs` }
  }

  const nowIso = new Date().toISOString()
  const rows = PADUS_PROTECTED_COUNTIES.map(c => ({
    county_fips:           c.county_fips,
    state:                 c.state,
    protected_area_pct:    c.protected_area_pct,
    protected_gap123_pct:  c.protected_gap123_pct,
    protected_last_updated: nowIso,
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

  const constrained = rows.filter(r => r.protected_area_pct >= 40).length
  return {
    ok:                  true,
    counties_upserted:   upserted,
    counties_constrained: constrained,   // >=40% GAP 1+2 (land-supply flag)
    dataset_version:     PADUS_PROTECTED_META.datasetVersion,
    source:              'committed artifact (USGS PAD-US 4.1 GAP 1+2 ÷ Census Gazetteer)',
  }
}
