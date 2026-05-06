/**
 * Energy Community handler — IRA §45 / §48 bonus credit per-county eligibility
 *
 * Pulls two FeatureServer layers from DOE NETL EDX (the Treasury-recognized
 * official designation source for IRA Energy Community bonus credit zones):
 *
 *   1. 2024_MSAs_NonMSAs_that_are_Energy_Communities — per-county. Filtered
 *      to ec_qual_status='Yes' OR fee_qual_status='Yes' so we only fetch
 *      the qualifying universe.
 *   2. 2024_Coal_Closure_Energy_Communities — per-tract. Filtered to any
 *      mine/generator/adjacent_to closure='Yes'. Aggregated to per-county
 *      tract counts.
 *
 * A county qualifies for the +10% ITC bonus credit if EITHER source flags
 * it. Brownfields are NOT covered (point data; per-site lat/lng required).
 *
 * API: free, no key, public. Each FeatureServer has maxRecordCount=2000;
 * we paginate via resultOffset.
 */
import {
  supabaseAdmin,
  FIPS_TO_USPS,
  normalizeCountyName,
  fetchArcgisPaged,
} from './_scraperBase.js'

const EC_MSA_URL  = 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/2024_MSAs_NonMSAs_that_are_Energy_Communities/FeatureServer/0/query'
const EC_COAL_URL = 'https://arcgis.netl.doe.gov/server/rest/services/Hosted/2024_Coal_Closure_Energy_Communities/FeatureServer/0/query'

export default async function refreshEnergyCommunity() {
  // 1. MSA / Non-MSA layer (per-county)
  let msaRows
  try {
    msaRows = await fetchArcgisPaged(
      EC_MSA_URL,
      "ec_qual_status='Yes' OR fee_qual_status='Yes'",
      'geoid_cty_2020,fipstate_2020,county_name_2020,state_name,msa_area_name,ec_qual_status,fee_qual_status,ffe_ind_qual,ec_ind_qual,dataset_version'
    )
  } catch (err) {
    return { ok: false, error: `MSA layer fetch failed: ${err.message}` }
  }

  // 2. Coal closure layer (per-tract; aggregated to per-county)
  let coalRows
  try {
    coalRows = await fetchArcgisPaged(
      EC_COAL_URL,
      "mine_closure='Yes' OR generator_closure='Yes' OR adjacent_to_closure='Yes'",
      'geoid_county_2020,fipstate_2020,fipcounty_2020,county_name,state_name,mine_closure,generator_closure,adjacent_to_closure,dataset_version'
    )
  } catch (err) {
    return { ok: false, error: `Coal closure layer fetch failed: ${err.message}` }
  }

  if (msaRows.length === 0 && coalRows.length === 0) {
    return { ok: false, error: 'Both NETL layers returned 0 rows (suspicious — endpoint may have moved)' }
  }

  // Aggregate to per-county
  const byCounty = new Map()
  let datasetVersion = null

  for (const a of msaRows) {
    const fips = a.geoid_cty_2020
    if (!fips || fips.length !== 5) continue
    const usps = FIPS_TO_USPS[a.fipstate_2020]
    if (!usps) continue
    if (!datasetVersion && a.dataset_version != null) datasetVersion = String(a.dataset_version)

    const countyName = a.county_name_2020 || a.county_name || ''
    byCounty.set(fips, {
      county_fips:                fips,
      state:                      usps,
      county_name:                countyName,
      county_name_normalized:     normalizeCountyName(countyName),
      qualifies_via_msa:          a.ec_qual_status === 'Yes',
      qualifies_via_coal_closure: false,
      msa_area_name:              a.msa_area_name || null,
      coal_closure_tract_count:   0,
      ffe_qualified:              a.fee_qual_status === 'Yes' || a.ffe_ind_qual === 1,
      ec_qualified:               a.ec_qual_status === 'Yes' || a.ec_ind_qual === 1,
      dataset_version:            datasetVersion,
      last_updated:               new Date().toISOString(),
      source:                     'DOE NETL EDX (Treasury IRA §45/§48 designations) 2024',
    })
  }

  for (const a of coalRows) {
    const fips = a.geoid_county_2020
    if (!fips || fips.length !== 5) continue
    const usps = FIPS_TO_USPS[a.fipstate_2020]
    if (!usps) continue

    const countyName = a.county_name || ''
    const existing = byCounty.get(fips) || {
      county_fips:                fips,
      state:                      usps,
      county_name:                countyName,
      county_name_normalized:     normalizeCountyName(countyName),
      qualifies_via_msa:          false,
      qualifies_via_coal_closure: false,
      msa_area_name:              null,
      coal_closure_tract_count:   0,
      ffe_qualified:              false,
      ec_qualified:               false,
      dataset_version:            datasetVersion,
      last_updated:               new Date().toISOString(),
      source:                     'DOE NETL EDX (Treasury IRA §45/§48 designations) 2024',
    }
    existing.qualifies_via_coal_closure = true
    existing.coal_closure_tract_count   = (existing.coal_closure_tract_count || 0) + 1
    byCounty.set(fips, existing)
  }

  const rows = Array.from(byCounty.values())
  if (rows.length < 50) {
    return { ok: false, error: `Only ${rows.length} qualifying counties; expected hundreds. Aborting upsert.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('energy_community_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: upserted,
      }
    }
    upserted += slice.length
  }

  // Sample preference: a county qualifying via BOTH paths is the most informative
  const sample = rows.find(r => r.qualifies_via_msa && r.qualifies_via_coal_closure) ||
                 rows.find(r => r.qualifies_via_coal_closure) ||
                 rows[0]

  return {
    ok:                  true,
    qualifying_counties: upserted,
    msa_layer_rows:      msaRows.length,
    coal_layer_rows:     coalRows.length,
    dataset_version:     datasetVersion,
    sample_county:       sample,
  }
}
