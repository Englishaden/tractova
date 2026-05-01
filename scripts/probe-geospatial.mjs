/**
 * Pre-work probe for Path B (wetlands + farmland data layers). Single keeper
 * script that captures the validated approach for both data sources.
 *
 *   • USFWS National Wetlands Inventory (NWI) ArcGIS MapServer
 *     - Endpoint: fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0
 *     - Per-county aggregate via outStatistics on Wetlands.ACRES (table-qualified)
 *     - Spatial filter: TIGER county polygon (simplified to ~200 verts)
 *     - WHERE filter: WETLAND_TYPE NOT IN ('Lake', 'Estuarine and Marine Deepwater')
 *     - Latency: ~5-7s/county polygon. ~6h serial / ~1.5h with 4x parallel.
 *     - Output: raw_pct can exceed 100% (overlap, water inclusion). Treat as
 *       categorical signal, not literal area %.
 *
 *   • USDA SSURGO Soil Data Access (T-SQL)
 *     - Endpoint: SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest
 *     - Per-state aggregate via SUM(CASE WHEN farmlndcl IN (...prime classes...))
 *     - Latency: ~80ms per STATE (all counties in one query). ~5s for whole US.
 *     - areasymbol → county_fips: ST + last 3 digits for 49 states.
 *       AK exception: 137 NRCS regions vs 30 boroughs (fuzzy-match areaname).
 *       CT/RI exception: 1-2 state-wide areas (assign uniformly to all counties).
 *
 * Usage:  node scripts/probe-geospatial.mjs
 */

// ───────────────────────────── Helpers ─────────────────────────────

async function tigerCounty(fips) {
  const r = await fetch(
    `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/13/query?where=GEOID%3D%27${fips}%27&outFields=GEOID,NAME,STATE,AREALAND&returnGeometry=true&outSR=4326&f=json`
  )
  const j = await r.json()
  return j.features?.[0]
}

function simplifyRing(ring, target) {
  if (ring.length <= target) return ring
  const stride = Math.ceil(ring.length / target)
  const out = ring.filter((_, i) => i % stride === 0)
  if (out[out.length - 1].join(',') !== ring[ring.length - 1].join(',')) out.push(ring[ring.length - 1])
  return out
}

async function nwiAggregate(feature) {
  const simpRings = feature.geometry.rings.map((r) => simplifyRing(r, 200))
  const geom = JSON.stringify({ rings: simpRings, spatialReference: { wkid: 4326 } })
  const t0 = Date.now()
  const r = await fetch(
    'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    }
  )
  const dt = Date.now() - t0
  const json = await r.json()
  if (json.error) return { ok: false, dt, error: json.error.message }
  const a = json.features?.[0]?.attributes
  return { ok: true, dt, wetAcres: a?.wet_acres ?? 0, featureCount: a?.n ?? 0 }
}

async function ssurgo(sql) {
  const r = await fetch('https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ QUERY: sql, FORMAT: 'JSON+COLUMNNAME' }).toString(),
  })
  const t = await r.text()
  let json
  try { json = JSON.parse(t) } catch { return { ok: false, raw: t.slice(0, 300) } }
  return { ok: !!json.Table, json }
}

// ───────────────────────────── NWI probe ─────────────────────────────

const COUNTIES = [
  { fips: '17031', label: 'Cook IL (urban)' },
  { fips: '17109', label: 'McDonough IL (rural)' },
  { fips: '12087', label: 'Monroe FL (Everglades)' },
  { fips: '06037', label: 'LA County CA' },
  { fips: '31055', label: 'Douglas NE (Omaha)' },
  { fips: '17097', label: "Lake IL (Chain o' Lakes)" },
  { fips: '13127', label: 'Glynn GA (coastal)' },
]

console.log('━━━ NWI: per-county wetland coverage probe ━━━')
console.log('Endpoint: USFWS Wetlands MapServer (outStatistics on ACRES, polygon filter)\n')

for (const c of COUNTIES) {
  process.stdout.write(`  ${c.fips} ${c.label.padEnd(28)} `)
  const feat = await tigerCounty(c.fips)
  if (!feat) { console.log('✗ no TIGER feature'); continue }
  const countyAcres = feat.attributes.AREALAND / 4046.86
  const r = await nwiAggregate(feat)
  if (!r.ok) { console.log(`✗ ${r.dt}ms  ${r.error}`); continue }
  const pct = (r.wetAcres / countyAcres) * 100
  const cat = pct < 5 ? 'minimal' : pct < 15 ? 'moderate' : pct < 40 ? 'significant' : 'severe'
  console.log(`${r.dt}ms  pct=${pct.toFixed(1).padStart(5)}%  → ${cat}`)
}

// ───────────────────────────── SSURGO probe ─────────────────────────────

console.log('\n━━━ SSURGO: per-state prime-farmland aggregate (IL sample) ━━━')
console.log('Endpoint: USDA Soil Data Access T-SQL\n')

const PRIME_CLASSES = [
  'All areas are prime farmland',
  'Prime farmland if drained',
  'Prime farmland if irrigated',
  'Prime farmland if drained and either protected from flooding or not frequently flooded during the growing season',
  'Prime farmland if irrigated and drained',
  'Prime farmland if subsoiled, completely removing the root inhibiting soil layer',
  'Prime farmland if protected from flooding or not frequently flooded during the growing season',
]
const primeIn = PRIME_CLASSES.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')

const t0 = Date.now()
const il = await ssurgo(`
  SELECT lg.areasymbol, lg.areaname,
    SUM(CASE WHEN mu.farmlndcl IN (${primeIn}) THEN mu.muacres ELSE 0 END) AS prime_acres,
    SUM(mu.muacres) AS total_acres
  FROM legend AS lg INNER JOIN mapunit AS mu ON mu.lkey = lg.lkey
  WHERE lg.areasymbol LIKE 'IL%' AND lg.areatypename = 'Non-MLRA Soil Survey Area'
  GROUP BY lg.areasymbol, lg.areaname
  ORDER BY lg.areasymbol
`)
const dt = Date.now() - t0

if (!il.ok) {
  console.log(`  ✗ ${dt}ms  raw=${il.raw}`)
} else {
  const rows = il.json.Table.slice(1)
  console.log(`  ${dt}ms  ${rows.length} IL counties returned in one query\n`)
  console.log(`  ${'areasymbol'.padEnd(10)} ${'county'.padEnd(34)} ${'prime%'.padStart(8)}  threshold`)
  console.log('  ' + '─'.repeat(70))
  for (const [sym, name, prime, total] of rows.slice(0, 8)) {
    const pct = total > 0 ? (prime / total) * 100 : 0
    const flag = pct >= 25 ? 'availableLand=true' : 'availableLand=false'
    console.log(`  ${sym.padEnd(10)} ${name.padEnd(34)} ${pct.toFixed(1).padStart(7)}%  ${flag}`)
  }
  console.log(`  ... (${rows.length - 8} more)`)
}

// ───────────────────────────── Wrap-up ─────────────────────────────
console.log(`
━━━ Calibration summary ━━━

Wetland coverage (NWI methodology — raw % can exceed 100% from overlapping
polygons + water inclusion, treat as categorical):
  < 5%  → minimal     (no permitting concern)
  5-15% → moderate
  ≥15%  → wetlandWarning = true  (matches BUILD_LOG sketch)
  ≥40%  → severe / likely deal-breaker

Prime farmland (SSURGO):
  ≥25%  → availableLand = true   (matches BUILD_LOG sketch)

Mapping caveats:
  • areasymbol→FIPS works for 49 of 50 states (last 3 digits = county FIPS).
  • AK: 137 NRCS regions vs 30 boroughs — fuzzy areaname match needed.
  • CT (2 statewide areas) and RI (1) — assign value uniformly to counties.
  • Territories (AS, GU, MH, MP, PW, VI) — skip; not in 50-state coverage.

Performance for production ingest:
  NWI: ~5-7s/county polygon × 3,142 counties ≈ 6h serial / 1.5h with 4x parallel.
       Suggests one-shot seed via separate cron func with maxDuration=300, then
       quarterly refresh (NWI updates infrequently anyway).
  SSURGO: ~80ms × 50 states ≈ 5s total. Trivially weekly via existing cron.
`)
