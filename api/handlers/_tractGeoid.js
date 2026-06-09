/**
 * Pure helper: extract the census TRACT + county GEOID from a US Census Geocoder
 * `geographies/onelineaddress` JSON response. No fetch / no DB — unit-testable.
 *
 * The Census Geocoder has no CORS, so the actual call is server-side
 * (api/handlers/_tract-resolve.js). This just parses the verified response shape:
 *   result.addressMatches[0].geographies["Census Tracts"][0].GEOID  → 11-digit tract
 *   result.addressMatches[0].geographies["Counties"][0].GEOID       → 5-digit county
 *
 * Honesty note: the GEOID identifies the census TRACT an address falls in — a
 * neighborhood-sized area (~4k people), NOT the literal parcel.
 */
const is11 = (s) => typeof s === 'string' && /^\d{11}$/.test(s)
const is5  = (s) => typeof s === 'string' && /^\d{5}$/.test(s)

export function extractTractGeoid(json) {
  const match = json?.result?.addressMatches?.[0]
  if (!match) return null
  const geos = match.geographies || {}
  const tract = geos['Census Tracts']?.[0]?.GEOID
  if (!is11(tract)) return null
  const county = geos['Counties']?.[0]?.GEOID
  return {
    tractGeoid:     tract,
    countyGeoid:    is5(county) ? county : tract.slice(0, 5),  // county = first 5 of the tract GEOID
    matchedAddress: typeof match.matchedAddress === 'string' ? match.matchedAddress : null,
  }
}
