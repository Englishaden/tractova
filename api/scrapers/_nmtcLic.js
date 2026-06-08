/**
 * Pure NMTC Low-Income-Community (LIC) helpers — used by the §48(e) Category 1
 * ingest (_refresh-nmtc-lic.js) and the local seed (scripts/seed-nmtc-lic.mjs).
 * Kept pure (no Supabase / no fetch / no file IO) so the FIPS normalization +
 * tract→county rollup are unit-testable.
 *
 * Source of the eligibility determination: the DOE "IRA Low-Income Community
 * Bonus Credit Program Layers" Excel (data.gov-cataloged; publisher U.S. Dept
 * of Energy), sheet "2023 Tract percentages". Its Category-1 column
 * `NMTC_2020_pct` is the CDFI CIMS NMTC LIC determination (ACS 2016-2020) —
 * the exact legal basis for §48(e) Cat 1 — expressed as the % of each 2023
 * census tract's land area that falls in an NMTC-eligible area.
 *
 * Why we re-key by county: Tractova's project granularity is state+county, so
 * we roll the tract-level file up to a per-county count of qualifying tracts.
 * A county is treated as LIC-eligible if it contains ≥1 qualifying tract (the
 * developer can site the project on the qualifying parcel) — per-site
 * eligibility is still verified at the parcel level (see the UI disclaimer).
 */

// A tract counts as an NMTC LIC tract if MORE than this % of its land is in an
// NMTC-eligible area. 0 = "any eligible land" (inclusive — preserves the prior
// derive's "any qualifying tract" semantics). Set to 50 for "predominantly LIC"
// (stricter / fewer counties). This is the single knob for the threshold.
export const QUALIFY_MIN_PCT = 0

// Coerce a FIPS-ish value (string or number, possibly with lost leading zeros
// from Excel's numeric parsing) to a zero-padded digit string of the given
// width. Non-digits stripped; empty / null → null.
export function normalizeFips(val, width) {
  if (val == null) return null
  const digits = String(val).trim().replace(/\D/g, '')
  if (!digits) return null
  return digits.padStart(width, '0')
}

// One sheet row (object keyed by header) → a normalized tract record. Derives
// the 5-digit county FIPS from StateCountyFIPS, falling back to StateFIPS +
// CountyFIPS. Reads NMTC_2020_pct as a number (null if unparseable).
export function parseTractRow(row) {
  if (!row) return null
  let countyFips = normalizeFips(row.StateCountyFIPS, 5)
  if (!countyFips) {
    const st = normalizeFips(row.StateFIPS, 2)
    const co = normalizeFips(row.CountyFIPS, 3)
    countyFips = st && co ? `${st}${co}` : null
  }
  // Number('') is 0, not NaN — guard blank/whitespace cells so "unknown" stays
  // null (no data) rather than collapsing to a false "0% eligible".
  const pctCell = typeof row.NMTC_2020_pct === 'string' ? row.NMTC_2020_pct.trim() : row.NMTC_2020_pct
  const pctRaw = (pctCell === '' || pctCell == null) ? NaN : Number(pctCell)
  return {
    geoid:      normalizeFips(row.GEOID_2023, 11),
    countyFips,
    countyName: row.CountyName != null && String(row.CountyName).trim() !== '' ? String(row.CountyName).trim() : null,
    nmtcPct:    Number.isFinite(pctRaw) ? pctRaw : null,
  }
}

// Does a tract's NMTC land-area % clear the LIC threshold?
export function tractQualifies(nmtcPct, minPct = QUALIFY_MIN_PCT) {
  return typeof nmtcPct === 'number' && Number.isFinite(nmtcPct) && nmtcPct > minPct
}

// Roll up normalized tract records into per-county records, GATED to the
// `fipsToUsps` map (our tracked 50 states + DC — territories like PR drop out).
// Returns an array of { county_fips, state, county_name, total_tracts_in_county,
// qualifying_tracts_count, sample_geoids } sorted by county_fips.
export function rollupByCounty(tractRows, fipsToUsps, { minPct = QUALIFY_MIN_PCT, sampleCap = 12 } = {}) {
  const byCounty = new Map()
  for (const t of tractRows) {
    if (!t || !t.countyFips || t.countyFips.length !== 5) continue
    const stateFips = t.countyFips.slice(0, 2)
    const usps = fipsToUsps[stateFips]
    if (!usps) continue   // not a tracked state — skip (e.g. PR/territories)

    let b = byCounty.get(t.countyFips)
    if (!b) {
      b = {
        county_fips:             t.countyFips,
        state:                   usps,
        county_name:             t.countyName || null,
        total_tracts_in_county:  0,
        qualifying_tracts_count: 0,
        sample_geoids:           [],
      }
      byCounty.set(t.countyFips, b)
    }
    b.total_tracts_in_county += 1
    if (!b.county_name && t.countyName) b.county_name = t.countyName
    if (tractQualifies(t.nmtcPct, minPct)) {
      b.qualifying_tracts_count += 1
      if (b.sample_geoids.length < sampleCap && t.geoid) b.sample_geoids.push(t.geoid)
    }
  }
  return Array.from(byCounty.values()).sort((a, b) => a.county_fips.localeCompare(b.county_fips))
}
