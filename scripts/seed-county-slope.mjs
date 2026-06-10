/**
 * Seed / build for the county terrain-slope layer (Phase 3a).
 *
 * Computes each county's solar-developable terrain share from the USGS 3DEP
 * Bare-Earth DEM ImageServer ("Slope Degrees" rendering rule +
 * computeStatisticsHistograms over the TIGER county polygon), and commits the
 * result to src/data/countySlope.js — the artifact the prod re-sync handler
 * (api/scrapers/_refresh-slope.js) upserts. Slope is STATIC (terrain doesn't
 * change), so the expensive 3DEP computation runs ONCE here; prod re-syncs from
 * the committed artifact instantly.
 *
 *   Inputs:  data/padus/2023_Gaz_counties_national.txt  (Census Gazetteer — the
 *            FIPS list + county land area used to pick a pixel size). 50 states
 *            + DC only; territories skipped.
 *   Output:  src/data/countySlope.js  (committed artifact; written incrementally
 *            so an interrupted run keeps its progress + resumes).
 *
 * ⚠ COST: one 3DEP call PER county → a full backfill is ~3,142 fetches, over the
 * CLAUDE.md §1.5 / §4 circuit breaker (>50 web fetches/session). So this DEFAULTS
 * to a small --limit; the full backfill needs an explicit --all (Aden's budget OK).
 *
 *   Usage:  node scripts/seed-county-slope.mjs                  # sample (--limit 25)
 *           node scripts/seed-county-slope.mjs --limit 200      # bigger sample
 *           node scripts/seed-county-slope.mjs --all            # FULL backfill (gated)
 *           node scripts/seed-county-slope.mjs --apply [...]    # also upsert the DB
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fetchCountyGeometries, simplifyRing } from '../api/scrapers/_nwiWetland.js'
import { SLOPE_IMAGESERVER, SLOPE_UA, buildSlopeStatsBody, summarizeSlope } from '../api/scrapers/_slope3dep.js'

// ── env loader ──
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
} catch { /* artifact still builds; DB apply skipped */ }

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const ALL = argv.includes('--all')
const limIdx = argv.indexOf('--limit')
const LIMIT = ALL ? Infinity : (limIdx !== -1 ? Number(argv[limIdx + 1]) : 25)

const GAZ = resolve(process.cwd(), 'data/padus/2023_Gaz_counties_national.txt')
const OUT = resolve(process.cwd(), 'src/data/countySlope.js')

const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL',
  '13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME',
  '24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH',
  '34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
}

const META = {
  datasetVersion: 'USGS 3DEP Bare-Earth DEM (Slope Degrees)',
  source: 'USGS 3D Elevation Program (3DEP) ImageServer — % of county at <=10% grade (solar-developable), TIGER county polygon',
}

// ── target counties: Gazetteer rows in the 50 states + DC ──
const gazLines = readFileSync(GAZ, 'utf8').split(/\r?\n/).filter(Boolean)
const gazHead = gazLines[0].split('\t').map(h => h.trim())
const gi = (n) => gazHead.indexOf(n)
const [iGeoid, iUsps, iSqmi] = [gi('GEOID'), gi('USPS'), gi('ALAND_SQMI')]
const targets = []
for (let i = 1; i < gazLines.length; i++) {
  const f = gazLines[i].split('\t'); if (f.length <= iSqmi) continue
  const fips = f[iGeoid].trim()
  if (!FIPS_TO_USPS[fips.slice(0, 2)]) continue   // 50 states + DC only
  targets.push({ fips, state: f[iUsps].trim(), sqmi: Number(f[iSqmi].trim()) || 0 })
}

// ── resume from any existing artifact ──
let done = new Map()
if (existsSync(OUT)) {
  try {
    const mod = await import(`file://${OUT}?t=${Date.now()}`)
    for (const r of mod.COUNTY_SLOPE || []) done.set(r.county_fips, r)
  } catch { /* malformed/empty artifact — start fresh */ }
}
const todo = targets.filter(t => !done.has(t.fips)).slice(0, LIMIT)
console.log(`→ ${targets.length} counties total · ${done.size} already done · running ${todo.length} now${ALL ? ' (FULL backfill)' : ` (sample; --all for full)`}`)

// Pixel size by county land area — keep the sampled grid under the 8000px image
// cap + bound per-call time. (San Bernardino ~20k mi² ran in ~22s at 90 m.)
function pixelFor(sqmi) {
  if (sqmi > 20000) return 250
  if (sqmi > 5000) return 120
  if (sqmi > 1500) return 60
  return 30
}

async function slopeFor(geometry, pixelMeters) {
  const rings = (geometry?.rings || []).map(r => simplifyRing(r, 300))
  const body = buildSlopeStatsBody(rings, pixelMeters)
  const r = await fetch(`${SLOPE_IMAGESERVER}/computeStatisticsHistograms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': SLOPE_UA },
    body: body.toString(),
  })
  const text = await r.text()
  let json; try { json = JSON.parse(text) } catch { return { error: `non-JSON: ${text.slice(0, 120)}` } }
  if (json.error) return { error: JSON.stringify(json.error).slice(0, 160) }
  const s = summarizeSlope(json)
  return s ? { slope: s } : { error: 'no stats/histogram' }
}

function writeArtifact() {
  const rows = [...done.values()].sort((a, b) => a.county_fips.localeCompare(b.county_fips))
  const body = `// AUTO-GENERATED by scripts/seed-county-slope.mjs — do not edit by hand.
// Per-county solar-developable terrain share for the Phase-3a site layer.
// ${META.source}
// slope_developable_pct = % of county terrain at <=10% grade (USGS 3DEP);
// slope_mean_deg = mean county slope. STATIC (terrain doesn't change) — re-seed
// only to extend coverage or re-source. Resumable: re-running skips done FIPS.
//   node scripts/seed-county-slope.mjs --all            (full backfill — gated on a fetch-budget OK)
//   node scripts/seed-county-slope.mjs --apply          (also upserts county_geospatial_data)
// Coverage: ${rows.length} of ${targets.length} counties.

export const COUNTY_SLOPE_META = ${JSON.stringify(META)}

export const COUNTY_SLOPE = [
${rows.map(r => JSON.stringify(r)).join(',\n')}
]
`
  writeArtifactFile(body)
}
function writeArtifactFile(body) { writeFileSync(OUT, body) }

// --apply: set up the DB client UP FRONT (fail fast on missing creds before
// doing hours of fetching) + checkpoint each batch to the DB as we go, so a
// multi-hour run stays crash-safe + resumable on BOTH the artifact and the DB
// (not a single write only at the very end).
let supabase = null
if (APPLY) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('✗ --apply needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
  supabase = createClient(url, key, { auth: { persistSession: false } })
}
let upserted = 0
async function flushUpsert(batch) {
  if (!supabase || batch.length === 0) return
  const now = new Date().toISOString()
  const rows = batch.map(r => ({
    county_fips: r.county_fips, state: r.state,
    slope_developable_pct: r.slope_developable_pct, slope_mean_deg: r.slope_mean_deg,
    slope_last_updated: now,
  }))
  const { error } = await supabase.from('county_geospatial_data').upsert(rows, { onConflict: 'county_fips' })
  if (error) { console.error(`✗ upsert (${rows.length} rows): ${error.message}`); process.exit(1) }
  upserted += rows.length
}

// Re-sync any already-done rows (resumed from the artifact) to the DB up front —
// the initial 14-county sample was seeded WITHOUT --apply, so it's in the
// artifact but not yet in county_geospatial_data. Idempotent.
if (APPLY && done.size > 0) {
  await flushUpsert([...done.values()])
  console.log(`   re-synced ${upserted} already-done counties to DB before the new fetch`)
}

let okN = 0, failN = 0
let pending = []
for (let i = 0; i < todo.length; i++) {
  const t = todo[i]
  let geom
  try {
    [geom] = await fetchCountyGeometries([t.fips])
  } catch (e) { console.log(`✗ ${t.fips} TIGER: ${e.message}`); failN++; continue }
  if (!geom?.geometry) { console.log(`✗ ${t.fips} no TIGER geometry`); failN++; continue }
  let res = await slopeFor(geom.geometry, pixelFor(t.sqmi))
  if (res.error) {   // one retry at a coarser pixel (handles transient + oversize)
    res = await slopeFor(geom.geometry, pixelFor(t.sqmi) * 2)
  }
  if (res.error) { console.log(`✗ ${t.fips} (${t.state}, ${t.sqmi}mi²): ${res.error}`); failN++; continue }
  const row = {
    county_fips: t.fips,
    state: t.state,
    slope_developable_pct: res.slope.developablePct,
    slope_mean_deg: res.slope.meanDeg,
  }
  done.set(t.fips, row)
  pending.push(row)
  okN++
  if (okN % 20 === 0) {
    writeArtifact()
    await flushUpsert(pending); pending = []
    console.log(`   …${okN}/${todo.length} done${supabase ? ` · ${upserted} upserted` : ''} (${t.fips} ${res.slope.developablePct}% dev)`)
  }
}
writeArtifact()
await flushUpsert(pending)
console.log(`✓ ${okN} computed · ${failN} failed · artifact ${done.size}/${targets.length} counties${supabase ? ` · ${upserted} upserted to DB` : ''} → ${OUT}`)
