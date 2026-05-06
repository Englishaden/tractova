/**
 * County-level ACS handler — per-county LMI density + population
 *
 * Pulls all ~3,142 US counties in a single Census API call, computes LMI
 * using each STATE's median income as the AMI baseline (HUD methodology
 * uses MSA-level AMI but state-level is a reasonable v1 proxy that
 * matches our existing state-level lmi_data table). Customer payoff:
 * when a Lens analysis specifies a county, we serve verified per-county
 * LMI density instead of the state aggregate -- meaningful for projects
 * in counties that diverge significantly from state median (e.g. wealthy
 * suburbs vs urban LMI cores).
 *
 * Methodology mirrors the state-level handler (refreshLmi above):
 *   1. For each county: pull median income, total households, total
 *      population, and the 16 income-bracket buckets (B19001 series).
 *   2. Compute 80% AMI threshold per state (lookup from lmi_data, or
 *      derive from county data if state lookup unavailable).
 *   3. Sum households whose income bracket UPPER BOUND <= 80% AMI;
 *      linearly interpolate the bracket containing the threshold.
 *   4. lmi_pct = lmi_households / total_households * 100.
 *
 * Source: US Census ACS 2018-2022 5-year, same DOI as state-level pull.
 * API call returns ~3,142 county rows × 19 fields = ~3MB response.
 * Manageable; no pagination needed.
 */
import {
  supabaseAdmin,
  censusFetch,
  BRACKET_UPPER,
  BRACKET_LOWER,
  FIPS_TO_USPS,
} from './_scraperBase.js'

export default async function refreshCountyAcs() {
  // Same vars as state-level: median income, total households, population,
  // and 16 income brackets.
  const vars = [
    'NAME',
    'B19013_001E',     // Median household income
    'B11001_001E',     // Total households
    'B01003_001E',     // Total population
  ]
  for (let i = 2; i <= 17; i++) {
    vars.push(`B19001_${String(i).padStart(3, '0')}E`)
  }

  const apiKey = process.env.CENSUS_API_KEY
  const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(',')}&for=county:*`
  const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl
  const keyed = !!apiKey

  let raw
  try {
    const response = await censusFetch(url)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, keyed, error: `Census county API ${response.status} (keyed=${keyed}): ${body.slice(0, 200)}` }
    }
    raw = await response.json()
  } catch (err) {
    return { ok: false, keyed, error: `Census county fetch failed (keyed=${keyed}): ${err.message}` }
  }

  if (!Array.isArray(raw) || raw.length < 100) {
    return { ok: false, error: `Census API returned ${Array.isArray(raw) ? raw.length : 0} rows; expected ~3,142 counties. Aborting.` }
  }

  const headers     = raw[0]
  const rows        = raw.slice(1)
  const stateFipsIdx  = headers.indexOf('state')
  const countyFipsIdx = headers.indexOf('county')
  const nameIdx       = headers.indexOf('NAME')
  const medianIdx     = headers.indexOf('B19013_001E')
  const totalIdx      = headers.indexOf('B11001_001E')
  const popIdx        = headers.indexOf('B01003_001E')
  const bracketIdx = []
  for (let i = 2; i <= 17; i++) {
    bracketIdx.push(headers.indexOf(`B19001_${String(i).padStart(3, '0')}E`))
  }

  // Pre-load state median incomes from existing lmi_data table -- we use
  // STATE median as the AMI baseline for the county's HUD-style 80% AMI
  // threshold. Falls back to the county's own median if the state lookup
  // is missing.
  const { data: stateLmi } = await supabaseAdmin
    .from('lmi_data')
    .select('state, median_household_income')
  const stateMedianMap = new Map((stateLmi || []).map(r => [r.state, r.median_household_income]))

  const countyRows = []
  for (const row of rows) {
    const fipsState  = row[stateFipsIdx]
    const fipsCounty = row[countyFipsIdx]
    const usps       = FIPS_TO_USPS[fipsState]
    if (!usps) continue   // Skip Puerto Rico, etc.

    const countyFips = `${fipsState}${fipsCounty}`
    const name       = row[nameIdx]
    const median     = parseInt(row[medianIdx], 10)
    const total      = parseInt(row[totalIdx], 10)
    const population = parseInt(row[popIdx], 10)
    const buckets    = bracketIdx.map(i => parseInt(row[i], 10))

    if (!Number.isFinite(median) || !Number.isFinite(total) || total <= 0) continue
    if (median <= 0) continue

    // 80% AMI baseline: prefer state median (HUD-style), fall back to county.
    const stateMedian = stateMedianMap.get(usps) || median
    const ami80 = Math.round(stateMedian * 0.80)

    // Same LMI calculation as state-level: sum brackets <= ami80 with
    // linear interpolation for the threshold-crossing bracket.
    let lmi = 0
    for (let i = 0; i < buckets.length; i++) {
      const bucketCount = buckets[i]
      if (!Number.isFinite(bucketCount) || bucketCount < 0) continue
      const upper = BRACKET_UPPER[i]
      const lower = BRACKET_LOWER[i]
      if (upper <= ami80) {
        lmi += bucketCount
      } else if (lower < ami80 && ami80 < upper) {
        const span = upper - lower
        const frac = (ami80 - lower) / span
        lmi += bucketCount * frac
        break
      } else {
        break
      }
    }
    lmi = Math.round(lmi)
    const lmiPct = total > 0 ? Math.round((lmi / total) * 1000) / 10 : 0

    countyRows.push({
      county_fips:               countyFips,
      state:                     usps,
      county_name:               name,
      total_households:          total,
      lmi_households:            lmi,
      lmi_pct:                   lmiPct,
      median_household_income:   median,
      ami_80pct:                 ami80,
      total_population:          Number.isFinite(population) ? population : null,
      last_updated:              new Date().toISOString(),
      source:                    'US Census ACS 2018-2022 5-year (live pull)',
    })
  }

  // Validation: expect roughly 3,142 counties (50 states + DC). If we got
  // <2,500, something is seriously wrong and we shouldn't wipe existing data.
  if (countyRows.length < 2500) {
    return { ok: false, error: `Census API returned only ${countyRows.length} usable counties; expected ~3,142. Aborting upsert.` }
  }

  // Upsert in batches -- Supabase has a payload size limit; 500 rows per
  // batch keeps each request under a few hundred KB.
  const BATCH = 500
  let totalUpserted = 0
  for (let i = 0; i < countyRows.length; i += BATCH) {
    const slice = countyRows.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('county_acs_data')
      .upsert(slice, { onConflict: 'county_fips' })
    if (error) {
      return {
        ok: false,
        error: `Supabase upsert failed at batch ${i / BATCH}: ${error.message}`,
        partial_upserted: totalUpserted,
      }
    }
    totalUpserted += slice.length
  }

  return {
    ok: true,
    counties_refreshed: totalUpserted,
    sample_county: countyRows.find(r => r.county_name?.startsWith('Will County')) || countyRows[0],
  }
}
