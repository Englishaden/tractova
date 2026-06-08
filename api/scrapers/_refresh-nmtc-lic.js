/**
 * NMTC LIC handler — IRA §48(e) Category 1 Low-Income Communities Bonus Credit.
 *
 * Syncs nmtc_lic_data from the AUTHORITATIVE published determination, not a
 * re-derivation. The committed artifact src/data/nmtcLicCounties.js carries the
 * CDFI CIMS NMTC LIC determination (ACS 2016-2020 — the legally-operative
 * §48(e) Cat 1 vintage) rolled up per county, generated offline by
 * scripts/seed-nmtc-lic.mjs from the DOE "IRA Low-Income Community Bonus Credit
 * Program Layers" Excel (https://data.nlr.gov/submissions/222).
 *
 * Why a static artifact instead of a live pull:
 *   - The determination is a published file updated ~yearly, not a REST API —
 *     a weekly cron can't fetch a new vintage anyway (re-sourcing is the manual
 *     seed step, gated by docs/cdfi-lic/lic-source.json's review_due).
 *   - Reading a committed JS module avoids both Census round-trips AND parsing
 *     an untrusted workbook in the serving path (the xlsx parse is offline).
 * This source is therefore STATIC (BUNDLE_EXCLUDED in refresh-data.js); this
 * handler runs on the admin "Refresh nmtc_lic" button + restore-from-snapshot,
 * re-syncing the DB from the artifact.
 *
 * Earlier limitation REMOVED by this upgrade: the prior derive used ACS
 * 2018-2022 + a state-MFI-only approximation of the CDFI rule, which used the
 * wrong (non-operative) vintage and under-counted metro LIC tracts. The
 * published file applies the greater-of-state/MSA-MFI rule + special provisions.
 *
 * Per-site note: eligibility is rolled up to the county; a project must sit in
 * a qualifying tract — verified at the parcel level (see the UI disclaimer).
 */
import { supabaseAdmin } from './_scraperBase.js'
import { NMTC_LIC_COUNTIES, NMTC_LIC_META } from '../../src/data/nmtcLicCounties.js'

export default async function refreshNmtcLic() {
  if (!Array.isArray(NMTC_LIC_COUNTIES) || NMTC_LIC_COUNTIES.length < 3000) {
    return { ok: false, error: `nmtcLicCounties artifact missing/short (${NMTC_LIC_COUNTIES?.length}); re-run scripts/seed-nmtc-lic.mjs` }
  }

  const nowIso = new Date().toISOString()
  const rows = NMTC_LIC_COUNTIES.map(c => ({
    county_fips:                 c.county_fips,
    state:                       c.state,
    county_name:                 c.county_name,
    total_tracts_in_county:      c.total_tracts_in_county,
    qualifying_tracts_count:     c.qualifying_tracts_count,
    qualifying_via_poverty:      0,     // legacy column — the published source isn't split by reason
    qualifying_via_low_mfi:      0,     // legacy column — the published source isn't split by reason
    qualifying_tract_geoids:     [],    // cleared (tract drill-down is a future tract-level track)
    state_median_family_income:  null,  // legacy column — N/A for the published determination
    dataset_version:             NMTC_LIC_META.datasetVersion,
    last_updated:                nowIso,
    source:                      NMTC_LIC_META.source,
  }))

  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('nmtc_lic_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return { ok: false, error: `Upsert failed at batch ${i / BATCH}: ${error.message}`, partial_upserted: upserted }
    }
    upserted += slice.length
  }

  const countiesWithLic = rows.filter(r => r.qualifying_tracts_count > 0).length
  const totalQualifyingTracts = rows.reduce((s, r) => s + r.qualifying_tracts_count, 0)
  const sample = rows.find(r => r.qualifying_tracts_count >= 5) || rows.find(r => r.qualifying_tracts_count >= 1) || rows[0]

  return {
    ok:                       true,
    counties_evaluated:       upserted,
    counties_with_lic:        countiesWithLic,
    total_qualifying_tracts:  totalQualifyingTracts,
    dataset_version:          NMTC_LIC_META.datasetVersion,
    source:                   'committed artifact (DOE §48e / CDFI CIMS, ACS 2016-2020)',
    sample_county:            sample,
  }
}
