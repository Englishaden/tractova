/**
 * LMI handler — US Census ACS 2018-2022 5-year estimates via api.census.gov
 *
 * Methodology (documented for auditability):
 *   1. Pull median household income (B19013_001E) per state.
 *   2. Pull total households (B11001_001E) per state.
 *   3. Pull income-distribution buckets (B19001_002E through B19001_017E).
 *   4. Compute 80% AMI threshold = state median × 0.80.
 *   5. Sum households in income brackets whose UPPER BOUND ≤ 80% AMI threshold.
 *      For the bracket containing the threshold, linearly interpolate.
 *   6. lmi_pct = lmi_households / total_households × 100.
 *
 * API: free, no key required (low volume). Endpoint:
 *   https://api.census.gov/data/2022/acs/acs5?get={vars}&for=state:*
 *
 * Source attribution stored in lmi_data.source = "US Census ACS 2018-2022 5-yr".
 */
import {
  supabaseAdmin,
  censusFetch,
  BRACKET_UPPER,
  BRACKET_LOWER,
  FIPS_TO_USPS,
} from './_scraperBase.js'

export default async function refreshLmi() {
  // Build the variables query: median income, total households, + 16 income brackets.
  const vars = [
    'NAME',           // State name
    'B19013_001E',    // Median household income
    'B11001_001E',    // Total households
  ]
  for (let i = 2; i <= 17; i++) {
    vars.push(`B19001_${String(i).padStart(3, '0')}E`)  // B19001_002E ... B19001_017E
  }

  const apiKey = process.env.CENSUS_API_KEY
  const baseUrl = `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(',')}&for=state:*`
  const url = apiKey ? `${baseUrl}&key=${apiKey}` : baseUrl
  const keyed = !!apiKey

  let raw
  try {
    const response = await censusFetch(url)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, keyed, error: `Census API ${response.status} (keyed=${keyed}): ${body.slice(0, 200)}` }
    }
    raw = await response.json()
  } catch (err) {
    return { ok: false, keyed, error: `Census fetch failed (keyed=${keyed}): ${err.message}` }
  }

  if (!Array.isArray(raw) || raw.length < 2) {
    return { ok: false, error: 'Census API returned malformed payload' }
  }

  // Row 0 is headers, rest are data rows. Parse each state.
  const headers = raw[0]
  const rows    = raw.slice(1)
  const fipsIdx = headers.indexOf('state')
  const nameIdx = headers.indexOf('NAME')
  const medianIdx = headers.indexOf('B19013_001E')
  const totalIdx  = headers.indexOf('B11001_001E')
  const bracketIdx = []
  for (let i = 2; i <= 17; i++) {
    bracketIdx.push(headers.indexOf(`B19001_${String(i).padStart(3, '0')}E`))
  }

  const stateRows = []
  for (const row of rows) {
    const fips = row[fipsIdx]
    const usps = FIPS_TO_USPS[fips]
    if (!usps) continue   // Skip Puerto Rico, etc.

    const name   = row[nameIdx]
    const median = parseInt(row[medianIdx], 10)
    const total  = parseInt(row[totalIdx], 10)
    const buckets = bracketIdx.map(i => parseInt(row[i], 10))

    if (!Number.isFinite(median) || !Number.isFinite(total) || total <= 0) continue
    if (median <= 0) continue

    const ami80 = Math.round(median * 0.80)

    // LMI = households whose income is at or below 80% AMI.
    // Walk buckets from lowest, accumulate full counts where upper <= ami80,
    // then linearly interpolate the bracket containing ami80.
    let lmi = 0
    for (let i = 0; i < buckets.length; i++) {
      const bucketCount = buckets[i]
      if (!Number.isFinite(bucketCount) || bucketCount < 0) continue
      const upper = BRACKET_UPPER[i]
      const lower = BRACKET_LOWER[i]
      if (upper <= ami80) {
        lmi += bucketCount    // Entire bracket is below the threshold
      } else if (lower < ami80 && ami80 < upper) {
        // Partial credit for the threshold-crossing bracket
        const span = upper - lower
        const frac = (ami80 - lower) / span
        lmi += bucketCount * frac
        break
      } else {
        break   // Threshold already crossed
      }
    }
    lmi = Math.round(lmi)

    const lmiPct = total > 0 ? Math.round((lmi / total) * 1000) / 10 : 0

    stateRows.push({
      state: usps,
      state_name: name,
      total_households: total,
      lmi_households: lmi,
      lmi_pct: lmiPct,
      median_household_income: median,
      ami_80pct: ami80,
      last_updated: new Date().toISOString(),
      source: 'US Census ACS 2018-2022 5-year (live pull)',
    })
  }

  if (stateRows.length === 0) {
    return { ok: false, error: 'No usable state rows from Census API' }
  }

  // Validation: sanity check that we got most of the 51 jurisdictions (50 states + DC).
  // If we got fewer than 40, something's wrong with the pull -- abort to avoid
  // wiping good seed data.
  if (stateRows.length < 40) {
    return { ok: false, error: `Census API returned only ${stateRows.length} states; expected ~51. Aborting upsert.` }
  }

  // Upsert to lmi_data. Conflict on state PK.
  const { error: upsertErr } = await supabaseAdmin
    .from('lmi_data')
    .upsert(stateRows, { onConflict: 'state' })

  if (upsertErr) {
    return { ok: false, error: `Supabase upsert failed: ${upsertErr.message}` }
  }

  return {
    ok: true,
    states_refreshed: stateRows.length,
    sample_state: stateRows.find(r => r.state === 'IL') || stateRows[0],
  }
}
