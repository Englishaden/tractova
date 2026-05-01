/**
 * One-shot seed for county_geospatial_data wetland coverage from USFWS NWI.
 *
 * The slow half of Path B: per-county wetland_coverage_pct via the NWI ArcGIS
 * MapServer. Per-county polygon query takes ~5-7s. Running serial across all
 * 3,142 counties = ~6h. With 4x parallelism = ~1.5h. Vercel cron tops out at
 * 300s so this is structured as a local script — run it once after migration
 * 039 is applied, then refresh quarterly via re-run.
 *
 * Idempotent + resumable: each county is processed independently and upserted
 * as soon as its data is back. Re-running picks up where the previous run
 * left off (skips counties whose wetland_last_updated is < REFRESH_AGE_DAYS).
 *
 *   Usage:  node scripts/seed-county-geospatial-nwi.mjs            # full seed
 *           node scripts/seed-county-geospatial-nwi.mjs --refresh  # only stale rows
 *           node scripts/seed-county-geospatial-nwi.mjs --state=IL # one state only
 *
 * Methodology:
 *   - Pull each county polygon from TIGER (Census FeatureServer)
 *   - Simplify to ~200 vertices
 *   - Query NWI with WHERE WETLAND_TYPE NOT IN ('Lake', 'Estuarine and Marine Deepwater')
 *     and outStatistics SUM(Wetlands.ACRES)
 *   - wetland_coverage_pct = (wetland_acres / county_AREALAND_acres) * 100
 *   - wetland_category bucketed: <5 minimal | <15 moderate | <40 significant | >=40 severe
 *   - Raw % may exceed 100% due to polygon overlap + water inclusion;
 *     wetland_category is the cleaner categorical signal.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env loader (same pattern as scripts/check-migrations.mjs) ──
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// ── config ──
const args = process.argv.slice(2)
const argSet = new Set(args)
const REFRESH_ONLY = argSet.has('--refresh')
const REFRESH_AGE_DAYS = 90  // skip rows updated more recently than this
// Concurrent NWI queries. Initial 2026-05-01 run with PARALLEL=4 succeeded
// for ~700 counties before NWI's server throttled hard and started returning
// "Wait timeout for the request exceeded" — 2,400 of 3,144 failed. PARALLEL=2
// is the empirically-safer baseline for catch-up runs. Override with
// --parallel=N for tuning.
const parallelArg = args.find(a => a.startsWith('--parallel='))?.split('=')[1]
const PARALLEL = parallelArg ? Math.max(1, Math.min(8, parseInt(parallelArg, 10))) : 4
const STATE_FILTER = args.find(a => a.startsWith('--state='))?.split('=')[1]?.toUpperCase()

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

// ── pull TIGER county list (FIPS + state + AREALAND for denominator) ──
async function fetchAllCounties() {
  console.log('→ Pulling all 3,142 county records + geometries from TIGER…')
  const all = []

  // TIGER FeatureServer caps payload at ~1000-2000 records per page; iterate per state.
  for (const stateFips of Object.keys(FIPS_TO_USPS)) {
    const usps = FIPS_TO_USPS[stateFips]
    if (STATE_FILTER && usps !== STATE_FILTER) continue
    const u = new URL('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/13/query')
    u.searchParams.set('where', `STATE='${stateFips}'`)
    u.searchParams.set('outFields', 'GEOID,NAME,STATE,AREALAND')
    u.searchParams.set('returnGeometry', 'true')
    u.searchParams.set('outSR', '4326')
    u.searchParams.set('f', 'json')
    const r = await fetch(u, { headers: { 'User-Agent': 'tractova-seed/1.0' } })
    const j = await r.json()
    if (j.error) {
      console.warn(`  ✗ ${usps}: ${j.error.message}`)
      continue
    }
    for (const f of j.features || []) {
      all.push({
        county_fips: f.attributes.GEOID,
        state:       FIPS_TO_USPS[f.attributes.STATE],
        county_name: f.attributes.NAME,
        area_acres:  (f.attributes.AREALAND || 0) / 4046.86,
        geometry:    f.geometry,
      })
    }
    process.stdout.write(`  ${usps}:${(j.features || []).length} `)
  }
  console.log(`\n  → ${all.length} counties total`)
  return all
}

function simplifyRing(ring, target) {
  if (ring.length <= target) return ring
  const stride = Math.ceil(ring.length / target)
  const out = ring.filter((_, i) => i % stride === 0)
  if (out[out.length - 1].join(',') !== ring[ring.length - 1].join(',')) out.push(ring[ring.length - 1])
  return out
}

// ── query NWI per county ──
async function nwiAggregate(geometry) {
  const simpRings = geometry.rings.map(r => simplifyRing(r, 200))
  const geom = JSON.stringify({ rings: simpRings, spatialReference: { wkid: 4326 } })
  const t0 = Date.now()
  const r = await fetch(
    'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'tractova-seed/1.0' },
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
  const text = await r.text()
  let json
  try { json = JSON.parse(text) }
  catch { return { ok: false, dt, error: `non-JSON response: ${text.slice(0, 100)}` } }
  if (json.error) return { ok: false, dt, error: json.error.message }
  const a = json.features?.[0]?.attributes
  return {
    ok: true,
    dt,
    wet_acres: Number(a?.wet_acres) || 0,
    feature_count: Number(a?.n) || 0,
  }
}

function categorize(pct) {
  if (pct < 5)  return 'minimal'
  if (pct < 15) return 'moderate'
  if (pct < 40) return 'significant'
  return 'severe'
}

// ── main ──
const counties = await fetchAllCounties()

let toProcess = counties
if (REFRESH_ONLY) {
  const cutoff = new Date(Date.now() - REFRESH_AGE_DAYS * 86400000).toISOString()
  const { data: existing } = await admin
    .from('county_geospatial_data')
    .select('county_fips, wetland_last_updated')
    .gte('wetland_last_updated', cutoff)
  const fresh = new Set((existing || []).map(r => r.county_fips))
  toProcess = counties.filter(c => !fresh.has(c.county_fips))
  console.log(`→ Refresh mode: ${counties.length} total, ${fresh.size} already fresh, ${toProcess.length} to process\n`)
} else {
  console.log(`→ Full seed: processing all ${toProcess.length} counties\n`)
}

const startTs = Date.now()
let okCount = 0
let failCount = 0
const failures = []

for (let i = 0; i < toProcess.length; i += PARALLEL) {
  const batch = toProcess.slice(i, i + PARALLEL)
  const settled = await Promise.allSettled(batch.map(async (c) => {
    const r = await nwiAggregate(c.geometry)
    if (!r.ok) return { county: c, ok: false, error: r.error, dt: r.dt }
    const pct = c.area_acres > 0 ? (r.wet_acres / c.area_acres) * 100 : 0
    const row = {
      county_fips:           c.county_fips,
      state:                 c.state,
      wetland_coverage_pct:  Number(pct.toFixed(2)),
      wetland_category:      categorize(pct),
      wetland_feature_count: r.feature_count,
      wetland_acres:         Math.round(r.wet_acres),
      wetland_last_updated:  new Date().toISOString(),
    }
    const { error } = await admin
      .from('county_geospatial_data')
      .upsert(row, { onConflict: 'county_fips' })
    if (error) return { county: c, ok: false, error: `DB upsert: ${error.message}`, dt: r.dt }
    return { county: c, ok: true, pct, n: r.feature_count, dt: r.dt }
  }))

  for (const s of settled) {
    if (s.status !== 'fulfilled') {
      failCount += 1
      failures.push(`(thrown) ${s.reason?.message || 'unknown'}`)
      continue
    }
    const { county, ok, error, pct, n, dt } = s.value
    if (ok) {
      okCount += 1
      const elapsed = Math.round((Date.now() - startTs) / 1000)
      const rate = okCount > 0 ? (Date.now() - startTs) / okCount : 0
      const remaining = Math.round((toProcess.length - okCount - failCount) * rate / 1000 / 60)
      process.stdout.write(`\r  [${okCount + failCount}/${toProcess.length}] ${county.county_fips} ${county.state}/${county.county_name.padEnd(22).slice(0, 22)} ${dt}ms pct=${pct.toFixed(1).padStart(5)}% n=${String(n).padStart(5)}  elapsed=${elapsed}s eta=${remaining}m fail=${failCount}     `)
    } else {
      failCount += 1
      failures.push(`${county.county_fips} ${county.state}/${county.county_name}: ${error}`)
    }
  }
}

console.log(`\n\n━━━ Done ━━━`)
console.log(`  total:    ${toProcess.length}`)
console.log(`  ok:       ${okCount}`)
console.log(`  failed:   ${failCount}`)
console.log(`  elapsed:  ${Math.round((Date.now() - startTs) / 1000)}s`)

if (failures.length) {
  console.log(`\n  First 10 failures:`)
  for (const f of failures.slice(0, 10)) console.log(`    ${f}`)
  if (failures.length > 10) console.log(`    ... +${failures.length - 10} more`)
  console.log(`\n  Re-run with --refresh to retry only the missing/stale rows.`)
}
