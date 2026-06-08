/**
 * Shared NWI wetland-ingest primitives — used by the incremental cron source
 * (api/scrapers/_refresh-geospatial-wetland.js) and available to the bulk local
 * seed (scripts/seed-county-geospatial-nwi.mjs). Pure / fetch-injected so the
 * non-network logic is unit-testable without Supabase or live ArcGIS.
 *
 * Source: USFWS National Wetlands Inventory (NWI) ArcGIS MapServer, county
 * polygon clipped against TIGER county geometry. See docs + SiteControlCard for
 * the two-layer honesty framing (NWI coverage is observed; the wetland_category
 * buckets + the 15% site threshold are Tractova's disclosed synthesis).
 */

export const NWI_QUERY_URL = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query'
export const TIGER_COUNTY_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/13/query'
export const NWI_UA = 'Tractova/1.0 (community-solar intel; aden.walker67@gmail.com)'

// Acres per square meter (TIGER AREALAND is in m²).
const ACRES_PER_SQM = 1 / 4046.86

const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

// Bucket a wetland-coverage % into the categorical signal. Raw % can exceed 100
// from NWI polygon overlap + water inclusion, so the category is the cleaner read.
// Thresholds match the seed script + the site engine's 15% warning line.
export function categorizeWetland(pct) {
  if (pct < 5)  return 'minimal'
  if (pct < 15) return 'moderate'
  if (pct < 40) return 'significant'
  return 'severe'
}

// wetland_coverage_pct = wetland acres / county land acres × 100. Guards a zero
// or missing denominator (returns 0 rather than NaN/Infinity).
export function pctFromAcres(wetAcres, areaAcres) {
  if (!(areaAcres > 0)) return 0
  return Number((((Number(wetAcres) || 0) / areaAcres) * 100).toFixed(2))
}

// Downsample a polygon ring to ~target vertices (NWI rejects huge geometries).
export function simplifyRing(ring, target = 200) {
  if (!Array.isArray(ring) || ring.length <= target) return ring
  const stride = Math.ceil(ring.length / target)
  const out = ring.filter((_, i) => i % stride === 0)
  if (out[out.length - 1].join(',') !== ring[ring.length - 1].join(',')) out.push(ring[ring.length - 1])
  return out
}

// Map a 2-digit state FIPS → USPS (null for territories / unknown).
export function uspsFromStateFips(stateFips) {
  return FIPS_TO_USPS[String(stateFips).padStart(2, '0')] || null
}

// Fetch TIGER county geometry + AREALAND for an explicit set of GEOIDs, in one
// query (incremental cron path — the bulk seed pulls per-state instead). Returns
// [{ county_fips, state, county_name, area_acres, geometry }]. `fetchImpl` is
// injected so callers/tests can stub it.
export async function fetchCountyGeometries(fipsList, fetchImpl = fetch) {
  if (!Array.isArray(fipsList) || fipsList.length === 0) return []
  const inList = fipsList.map(f => `'${f}'`).join(',')
  const u = new URL(TIGER_COUNTY_URL)
  u.searchParams.set('where', `GEOID IN (${inList})`)
  u.searchParams.set('outFields', 'GEOID,NAME,STATE,AREALAND')
  u.searchParams.set('returnGeometry', 'true')
  u.searchParams.set('outSR', '4326')
  u.searchParams.set('f', 'json')
  const r = await fetchImpl(u, { headers: { 'User-Agent': NWI_UA } })
  const j = await r.json()
  if (j.error) throw new Error(`TIGER: ${j.error.message}`)
  return (j.features || []).map(f => ({
    county_fips: f.attributes.GEOID,
    state:       uspsFromStateFips(f.attributes.STATE),
    county_name: f.attributes.NAME,
    area_acres:  (f.attributes.AREALAND || 0) * ACRES_PER_SQM,
    geometry:    f.geometry,
  }))
}

// Query NWI for the wetland-acre sum within a county polygon. Excludes open-water
// classes (lakes / marine deepwater) so the signal reflects PERMITTABLE wetland
// constraint, not lakes. `fetchImpl` injected. Returns { ok, wetAcres, featureCount }.
export async function nwiAggregate(geometry, fetchImpl = fetch) {
  const simpRings = (geometry?.rings || []).map(r => simplifyRing(r, 200))
  const geom = JSON.stringify({ rings: simpRings, spatialReference: { wkid: 4326 } })
  const r = await fetchImpl(NWI_QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': NWI_UA },
    body: new URLSearchParams({
      geometry: geom,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      where: `Wetlands.WETLAND_TYPE NOT IN ('Lake', 'Estuarine and Marine Deepwater')`,
      outStatistics: JSON.stringify([
        { statisticType: 'sum', onStatisticField: 'Wetlands.ACRES', outStatisticFieldName: 'wet_acres' },
        { statisticType: 'count', onStatisticField: 'Wetlands.OBJECTID', outStatisticFieldName: 'n' },
      ]),
      f: 'json',
    }).toString(),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { return { ok: false, error: `non-JSON response: ${text.slice(0, 100)}` } }
  if (json.error) return { ok: false, error: json.error.message }
  const a = json.features?.[0]?.attributes
  return { ok: true, wetAcres: Number(a?.wet_acres) || 0, featureCount: Number(a?.n) || 0 }
}
