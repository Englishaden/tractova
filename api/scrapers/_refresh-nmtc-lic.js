/**
 * NMTC LIC handler — IRA §48(e) Category 1 Low-Income Communities Bonus Credit
 *
 * Derives NMTC Low-Income Community tract designations from raw Census ACS
 * data per the CDFI Fund's published methodology. A tract qualifies as LIC
 * (and thus the project sited there qualifies for §48(e) Category 1's +10%
 * ITC bonus) if EITHER:
 *   (a) Tract poverty rate >= 20%
 *   (b) Tract median family income <= 80% of statewide median family income
 *
 * Why we DERIVE rather than fetch from a published list: CDFI Fund publishes
 * the LIC list as a downloadable Excel/shapefile, not a REST API. Computing
 * from primary Census ACS sources gives us:
 *   - Same data inputs CDFI uses (ACS 2018-2022 5-year)
 *   - Same rules CDFI applies (per their methodology)
 *   - Live-pulled (each weekly cron checks Census; if Census updates the
 *     ACS series, our LIC counts update automatically)
 *
 * Methodology notes / v1 limitations:
 *   - We use STATE median family income as the threshold benchmark for ALL
 *     tracts. CDFI uses the GREATER of state MFI or MSA MFI for metro tracts.
 *     A metro tract in a high-MFI MSA may be slightly under-counted in v1.
 *   - We don't capture special "high migration" rural tracts (a CDFI
 *     provision affecting <2% of tracts).
 *
 * Customer impact: §48(e) Category 1 stacks with Energy Community for up to
 * +20 percentage points on the ITC. Direct $-impact: ~$1-2M of bonus credit
 * on a 5MW project sited in an LIC tract.
 */
import {
  supabaseAdmin,
  censusFetch,
  FIPS_TO_USPS,
} from './_scraperBase.js'

export default async function refreshNmtcLic() {
  const apiKey = process.env.CENSUS_API_KEY
  const keyed = !!apiKey

  // 1. Pull state-level median family income for the threshold benchmark.
  //    State-level allows wildcard for `state` (only TRACT-level forbids it).
  const baseStateUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19113_001E&for=state:*`
  const stateUrl = apiKey ? `${baseStateUrl}&key=${apiKey}` : baseStateUrl

  let stateRaw
  try {
    const resp = await censusFetch(stateUrl)
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return { ok: false, keyed, error: `Census state MFI ${resp.status} (keyed=${keyed}): ${body.slice(0, 200)}` }
    }
    stateRaw = await resp.json()
  } catch (err) {
    return { ok: false, keyed, error: `Census state MFI fetch failed (keyed=${keyed}): ${err.message}` }
  }

  if (!Array.isArray(stateRaw) || stateRaw.length < 2) {
    return { ok: false, error: 'Census state MFI returned malformed payload' }
  }

  const stateHdr   = stateRaw[0]
  const stateRows  = stateRaw.slice(1)
  const sMfiIdx    = stateHdr.indexOf('B19113_001E')
  const sFipsIdx   = stateHdr.indexOf('state')
  const stateMfiByFips = new Map()
  for (const r of stateRows) {
    const mfi = parseInt(r[sMfiIdx], 10)
    if (Number.isFinite(mfi) && mfi > 0) {
      stateMfiByFips.set(r[sFipsIdx], mfi)
    }
  }

  // 2. Pull tract-level data state-by-state. Census API REJECTS `state:*`
  //    for the `in=state` parameter when querying tracts -- you must pin
  //    one state per call. We iterate the 51 FIPS we track in parallel
  //    batches of 8 to stay within the 60s function budget.
  async function fetchTractsForState(stateFips) {
    const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19113_001E,B17020_001E,B17020_002E&for=tract:*&in=state:${stateFips}`
    const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl
    try {
      const resp = await censusFetch(url)
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`)
      }
      const json = await resp.json()
      if (!Array.isArray(json) || json.length < 2) return []
      return json   // includes header row at [0]
    } catch (err) {
      throw err
    }
  }

  const stateFipsList = Object.keys(FIPS_TO_USPS)
  const PARALLEL = 2
  const stateFetchErrors = []
  const allTractRowsByState = []   // each entry: { stateFips, headers, rows }

  for (let i = 0; i < stateFipsList.length; i += PARALLEL) {
    const batch = stateFipsList.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(batch.map(fips => fetchTractsForState(fips)))
    for (let j = 0; j < batch.length; j++) {
      const fips = batch[j]
      const r = settled[j]
      if (r.status === 'fulfilled' && r.value.length >= 2) {
        allTractRowsByState.push({ stateFips: fips, headers: r.value[0], rows: r.value.slice(1) })
      } else if (r.status === 'rejected') {
        stateFetchErrors.push(`${FIPS_TO_USPS[fips] || fips}: ${r.reason?.message || 'failed'}`)
      }
    }
  }

  if (allTractRowsByState.length < 30) {
    return {
      ok: false,
      error: `Only ${allTractRowsByState.length}/${stateFipsList.length} state tract pulls succeeded. Aborting.`,
      first_state_errors: stateFetchErrors.slice(0, 5),
    }
  }

  // 3. Apply CDFI rules per tract; aggregate per county.
  const byCounty = new Map()
  let totalQualifyingTracts = 0
  let totalTractsScanned    = 0

  for (const stateBundle of allTractRowsByState) {
    const hdr        = stateBundle.headers
    const rows       = stateBundle.rows
    const mfiIdx     = hdr.indexOf('B19113_001E')
    const povTotalIdx= hdr.indexOf('B17020_001E')
    const povBelowIdx= hdr.indexOf('B17020_002E')
    const stIdx      = hdr.indexOf('state')
    const coIdx      = hdr.indexOf('county')
    const trIdx      = hdr.indexOf('tract')
    const nmIdx      = hdr.indexOf('NAME')

    for (const r of rows) {
      const stateFips  = r[stIdx]
      const countyFips = r[coIdx]
      const tractFips  = r[trIdx]
      if (!stateFips || !countyFips || !tractFips) continue
      const usps = FIPS_TO_USPS[stateFips]
      if (!usps) continue

      totalTractsScanned += 1
      const fips = `${stateFips}${countyFips}`
      const stateMfi = stateMfiByFips.get(stateFips) || 0
      const tractMfi = parseInt(r[mfiIdx], 10)
      const povTotal = parseInt(r[povTotalIdx], 10)
      const povBelow = parseInt(r[povBelowIdx], 10)

      let bucket = byCounty.get(fips)
      if (!bucket) {
        bucket = {
          county_fips:                fips,
          state:                      usps,
          county_name:                null,
          total_tracts_in_county:     0,
          qualifying_tracts_count:    0,
          qualifying_via_poverty:     0,
          qualifying_via_low_mfi:     0,
          qualifying_tract_geoids:    [],
          state_median_family_income: stateMfi || null,
          dataset_version:            'ACS 2018-2022 5-year',
          last_updated:               new Date().toISOString(),
          source:                     'US Census ACS 2018-2022 5-yr + CDFI Fund NMTC LIC methodology',
        }
        byCounty.set(fips, bucket)
      }
      bucket.total_tracts_in_county += 1

      if (!bucket.county_name) {
        const nm = r[nmIdx] || ''
        const parts = nm.split(',').map(s => s.trim())
        if (parts.length >= 2) bucket.county_name = parts[1]
      }

      const povertyRate = (Number.isFinite(povBelow) && Number.isFinite(povTotal) && povTotal > 0)
                          ? povBelow / povTotal
                          : null
      const qualifiesViaPoverty = povertyRate !== null && povertyRate >= 0.20
      const qualifiesViaLowMfi  = (Number.isFinite(tractMfi) && tractMfi > 0 && stateMfi > 0)
                                  ? tractMfi <= stateMfi * 0.80
                                  : false

      if (qualifiesViaPoverty || qualifiesViaLowMfi) {
        bucket.qualifying_tracts_count += 1
        if (qualifiesViaPoverty) bucket.qualifying_via_poverty += 1
        if (qualifiesViaLowMfi)  bucket.qualifying_via_low_mfi += 1
        if (bucket.qualifying_tract_geoids.length < 200) {
          bucket.qualifying_tract_geoids.push(`${stateFips}${countyFips}${tractFips}`)
        }
        totalQualifyingTracts += 1
      }
    }
  }

  const allRows = Array.from(byCounty.values())
  if (allRows.length < 100) {
    return { ok: false, error: `Only ${allRows.length} counties aggregated; expected ~3,143. Aborting.` }
  }

  // Upsert in batches.
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < allRows.length; i += BATCH) {
    const slice = allRows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('nmtc_lic_data')
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

  // Sample preference: county with high LIC density
  const sample = allRows.find(r => r.qualifying_tracts_count >= 5) ||
                 allRows.find(r => r.qualifying_tracts_count >= 1) ||
                 allRows[0]

  return {
    ok:                          true,
    counties_evaluated:          upserted,
    total_qualifying_tracts:     totalQualifyingTracts,
    total_tracts_scanned:        totalTractsScanned,
    counties_with_lic:           allRows.filter(r => r.qualifying_tracts_count > 0).length,
    states_pulled_successfully:  allTractRowsByState.length,
    state_fetch_errors:          stateFetchErrors.length > 0 ? stateFetchErrors.slice(0, 10) : undefined,
    states_covered_by_mfi:       stateMfiByFips.size,
    sample_county:               sample,
  }
}
