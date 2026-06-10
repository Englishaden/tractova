// Address↔county consistency helpers for the optional site-address LIC lookup.
//
// The Census geocoder resolves an address to a census tract AND its 5-digit
// county GEOID (FIPS). We reuse the bundled NMTC LIC county rollup
// (src/data/nmtcLicCounties.js — a comprehensive 3,144-row state+name crosswalk
// keyed by county_fips, the SAME authoritative source the LIC panel reads) to
// name the address's county and compare it against the county the user picked.
// All offline + free — no extra geocoder calls, no DB round-trip.
import { NMTC_LIC_COUNTIES } from '../data/nmtcLicCounties.js'

// county_fips → { state, countyName }. Built once at module load.
const BY_FIPS = new Map(
  NMTC_LIC_COUNTIES.map((r) => [r.county_fips, { state: r.state, countyName: r.county_name }]),
)

// 5-digit county GEOID → { state, countyName } | null (unknown FIPS).
export function countyForFips(fips) {
  return (typeof fips === 'string' && BY_FIPS.get(fips)) || null
}

// Normalize a county display name for comparison: drop the '(city)' independent-
// city marker, anything after a comma, a trailing type word, and case. Mirrors
// the stripping in programData.resolveCountyFips so the two agree on identity.
export function normCountyName(name) {
  return String(name || '')
    .replace(/\s*\(city\)\s*$/i, '')
    .replace(/,.*$/, '')
    .replace(/\s+(county|parish|borough|census area|municipality|city)$/i, '')
    .trim()
    .toLowerCase()
}

// Compare a resolved address's county (derived from result.countyGeoid) against
// the county the user picked in the form.
//   { verdict: 'match' }    — same state + same county; address is consistent.
//   { verdict: 'mismatch', addrCounty } — address falls in a DIFFERENT county/state.
//   { verdict: 'unknown', addrCounty } — can't tell (no countyGeoid, FIPS not in
//                            the crosswalk, or no county picked yet). Callers MUST
//                            fail open here — never warn or block on 'unknown'.
// addrCounty (when resolvable) = { state, countyName } for display + the switch CTA.
//
// Note: independent cities that share a base name with their surrounding county
// (e.g. Baltimore city vs Baltimore County) normalize to the same name, so a
// city-vs-county pick is treated as a match. That fails OPEN (never a false
// mismatch) — the common case (wholly different counties) is caught exactly.
export function classifyCountyMatch(result, stateId, selectedCountyName) {
  const addrCounty = countyForFips(result?.countyGeoid)
  if (!addrCounty || !stateId || !String(selectedCountyName || '').trim()) {
    return { verdict: 'unknown', addrCounty: addrCounty || null }
  }
  const sameState = addrCounty.state === stateId
  const sameCounty = normCountyName(addrCounty.countyName) === normCountyName(selectedCountyName)
  return { verdict: sameState && sameCounty ? 'match' : 'mismatch', addrCounty }
}
