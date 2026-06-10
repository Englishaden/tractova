/**
 * Seed / build for the PAD-US protected-land county layer (Phase 3b).
 *
 * PAD-US is a STATIC source (protected-area boundaries update on multi-year
 * cadences), so — exactly like nmtc_lic — this derives a per-county metric from
 * the authoritative files, commits an artifact, and the prod handler upserts it.
 *
 *   Inputs (both gitignored, under data/padus/):
 *     PADUS4_1VectorAnalysis_Uni_Counties_Clip_CENSUS2022.csv
 *        USGS PAD-US 4.1 Uni_Counties summary — acres protected per county ×
 *        GAP status. Re-download: the "Vector Analysis and Summary Statistics"
 *        zip from https://doi.org/10.5066/P96WBCHS (ScienceBase item, PAD-US 4.x).
 *     2023_Gaz_counties_national.txt
 *        Census 2023 county Gazetteer — the FIPS<->name crosswalk + county land
 *        area (ALAND, m²) used as the denominator. Re-download:
 *        https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_counties_national.zip
 *
 *   Output: src/data/padusProtected.js — committed artifact the prod handler
 *           api/scrapers/_refresh-padus-protected.js imports + upserts.
 *
 *   Usage:  node scripts/seed-padus-protected.mjs            # dry-run: rebuild
 *                                                              the artifact + print
 *                                                              coverage + impact diff
 *           node scripts/seed-padus-protected.mjs --apply    # also upsert the DB
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  rollupProtectedByCounty,
  countyKey,
  normalizeCountyName,
  protectedPct,
  sqMetersToAcres,
} from '../api/scrapers/_padusProtected.js'

// ── env loader (same pattern as the other seeds) ──
try {
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
} catch { /* no .env.local — artifact still builds; DB diff/apply skipped */ }

const APPLY = process.argv.slice(2).includes('--apply')
const DATA = resolve(process.cwd(), 'data/padus')
const CSV = resolve(DATA, 'PADUS4_1VectorAnalysis_Uni_Counties_Clip_CENSUS2022.csv')
const GAZ = resolve(DATA, '2023_Gaz_counties_national.txt')

const META = {
  datasetVersion: 'PAD-US 4.1 (CENSUS2022 clip)',
  source: 'USGS Protected Areas Database of the United States (PAD-US) 4.1 — Uni_Counties vector-analysis summary, GAP status 1+2 share of county land (Census 2023 Gazetteer ALAND denominator)',
}

// ── minimal RFC-4180 CSV line splitter (handles the quoted "County, ST" field) ──
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// ── 1. Census Gazetteer → crosswalk { key → {fips, state, name, landAcres} } ──
const gazLines = readFileSync(GAZ, 'utf8').split(/\r?\n/).filter(Boolean)
const gazHeader = gazLines[0].split('\t').map(h => h.trim())
const gi = (name) => gazHeader.indexOf(name)
const [iUsps, iGeoid, iName, iAland] = [gi('USPS'), gi('GEOID'), gi('NAME'), gi('ALAND')]
const crosswalk = new Map()       // key → { fips, state, name, landAcres }
const fipsToGaz = new Map()       // fips → same (for the apply diff)
for (let i = 1; i < gazLines.length; i++) {
  const f = gazLines[i].split('\t')
  if (f.length <= iAland) continue
  const state = f[iUsps].trim()
  const fips = f[iGeoid].trim()
  const name = f[iName].trim()
  const landAcres = sqMetersToAcres(Number(f[iAland].trim()))
  const rec = { fips, state, name, landAcres }
  crosswalk.set(countyKey(state, name), rec)
  fipsToGaz.set(fips, rec)
}
console.log(`→ Gazetteer: ${crosswalk.size} counties (FIPS↔name + land area)`)

// ── 2. PAD-US county CSV → protected acres per county key ──
const csvLines = readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean)
const head = splitCsvLine(csvLines[0].replace(/^﻿/, '')).map(h => h.trim())
const ci = (n) => head.indexOf(n)
const [iGap, iBndry, iSt, iAcres] = [ci('GAP_Sts'), ci('BndryName'), ci('ST_Name'), ci('GIS_AcrsDb')]
// ST_Name is the full state name; the BndryName tail ("…County, VA") carries the
// USPS code, so derive state from that 2-letter tail to match the Gazetteer.
const rows = []
for (let i = 1; i < csvLines.length; i++) {
  const f = splitCsvLine(csvLines[i])
  if (f.length <= iAcres) continue
  const bndry = f[iBndry]
  const m = /,\s*([A-Z]{2})\s*$/.exec(bndry)
  if (!m) continue
  rows.push({ state: m[1], boundaryName: bndry, gapStatus: f[iGap], acres: Number(f[iAcres]) || 0 })
}
const rolled = rollupProtectedByCounty(rows)
console.log(`→ PAD-US: ${rows.length} county rows → ${rolled.size} distinct counties with protected land`)

// ── 3. Join PAD-US → Gazetteer on (state, normalized name); compute pct ──
const records = []
const unmatched = []
for (const [key, agg] of rolled) {
  const gaz = crosswalk.get(key)
  if (!gaz) { unmatched.push({ key, gap12: Math.round(agg.gap12Acres) }); continue }
  const pct = protectedPct(agg.gap12Acres, gaz.landAcres)
  const pct123 = protectedPct(agg.gap123Acres, gaz.landAcres)
  if (pct == null) continue
  records.push({
    county_fips: gaz.fips,
    state: gaz.state,
    county_name: gaz.name.replace(/\s+(County|Parish|Borough|Census Area|Municipality|Municipio|City and Borough|city)$/i, ''),
    protected_area_pct: pct,
    protected_gap123_pct: pct123,
  })
}
records.sort((a, b) => a.county_fips.localeCompare(b.county_fips))

// Counties with NO protected land in PAD-US (not in `rolled`) are a legitimate
// 0% — but we only write rows PAD-US actually reports protection for, leaving
// the rest null (no fabricated 0). The score treats null as "no data, no penalty".
const constrained = records.filter(r => r.protected_area_pct >= 40).length
console.log(`→ Joined: ${records.length} counties scored · ${unmatched.length} unmatched (logged below)`)
console.log(`   ${constrained} counties >=40% protected (would flag a land-supply constraint)`)
if (unmatched.length) {
  console.log(`   First 25 unmatched PAD-US keys (no Gazetteer county — usually territories / tribal / name drift):`)
  for (const u of unmatched.slice(0, 25)) console.log(`     ${u.key}  (${u.gap12} ac GAP1+2)`)
}

// ── 4. Write the committed artifact ──
const artifact = `// AUTO-GENERATED by scripts/seed-padus-protected.mjs — do not edit by hand.
// Per-county protected-land share for the Phase-3b site layer.
// ${META.source}
// GAP 1+2 = strict protection (undevelopable); protected_area_pct = GAP1+2 acres
// / county land acres (Census 2023 Gazetteer ALAND) × 100.
// Regenerate: place the PAD-US Uni_Counties CSV + Census Gazetteer in data/padus/, then
//   node scripts/seed-padus-protected.mjs          (rebuilds this file + prints coverage)
//   node scripts/seed-padus-protected.mjs --apply  (also upserts county_geospatial_data)

export const PADUS_PROTECTED_META = ${JSON.stringify(META)}

export const PADUS_PROTECTED_COUNTIES = [
${records.map(r => JSON.stringify(r)).join(',\n')}
]
`
const outPath = resolve(process.cwd(), 'src/data/padusProtected.js')
writeFileSync(outPath, artifact)
console.log(`✓ Wrote ${outPath} (${records.length} counties)`)

// ── 5. Optional --apply: upsert into county_geospatial_data ──
if (!APPLY) {
  console.log('\n(dry-run — re-run with --apply to upsert county_geospatial_data)')
  process.exit(0)
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('✗ --apply needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })
const now = new Date().toISOString()
const upsertRows = records.map(r => ({
  county_fips: r.county_fips,
  state: r.state,
  protected_area_pct: r.protected_area_pct,
  protected_gap123_pct: r.protected_gap123_pct,
  protected_last_updated: now,
}))
const BATCH = 500
let upserted = 0
for (let i = 0; i < upsertRows.length; i += BATCH) {
  const slice = upsertRows.slice(i, i + BATCH)
  const { error } = await supabase.from('county_geospatial_data').upsert(slice, { onConflict: 'county_fips' })
  if (error) { console.error(`✗ upsert batch ${i / BATCH}: ${error.message}`); process.exit(1) }
  upserted += slice.length
}
console.log(`✓ Upserted ${upserted} counties' protected_area_pct into county_geospatial_data`)
