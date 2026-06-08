/**
 * Seed / refresh for nmtc_lic_data — §48(e) Category 1 Low-Income-Community
 * eligibility, sourced from the AUTHORITATIVE DOE file (not re-derived).
 *
 * Replaces the old live Census-ACS derivation (which used ACS 2018-2022 + a
 * state-MFI-only approximation of the CDFI rule). The DOE "IRA Low-Income
 * Community Bonus Credit Program Layers" Excel carries the CDFI CIMS NMTC LIC
 * determination (ACS 2016-2020 — the legally-operative §48(e) Cat 1 vintage),
 * which already applies the greater-of-state/MSA-MFI rule + special provisions.
 *
 *   Input:  data/cdfi-lic/*.xlsx  (gitignored; re-download from
 *           https://data.nlr.gov/submissions/222 — "48 Program | Excel tool")
 *   Output: src/data/nmtcLicCounties.js  (committed artifact the prod handler
 *           api/scrapers/_refresh-nmtc-lic.js imports + upserts)
 *
 *   Usage:  node scripts/seed-nmtc-lic.mjs            # dry-run (default): regenerate
 *                                                       the artifact + print the
 *                                                       impact diff vs the live DB
 *           node scripts/seed-nmtc-lic.mjs --apply    # also upsert nmtc_lic_data
 *
 * The artifact is the source of truth; the DB is synced from it via --apply
 * here OR the admin "Refresh nmtc_lic" button (handler reads the same artifact).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import { parseTractRow, rollupByCounty, QUALIFY_MIN_PCT } from '../api/scrapers/_nmtcLic.js'

// ── env loader (same pattern as scripts/seed-county-geospatial-nwi.mjs) ──
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
} catch { /* no .env.local — artifact still generates; DB diff/apply will be skipped */ }

const APPLY = process.argv.slice(2).includes('--apply')

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

const META = {
  datasetVersion: 'ACS 2016-2020 (CDFI NMTC LIC)',
  source: 'DOE §48(e) Low-Income Community Bonus Credit Program Layers · CDFI CIMS NMTC LIC determination (ACS 2016-2020)',
}

// ── 1. locate + parse the latest DOE Excel ──
const dir = resolve(process.cwd(), 'data/cdfi-lic')
let xlsxFiles
try {
  xlsxFiles = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.xlsx')).sort()
} catch {
  console.error(`✗ ${dir} not found. Re-download the DOE "48 Program | Excel tool" from`)
  console.error('  https://data.nlr.gov/submissions/222 into data/cdfi-lic/ and re-run.')
  process.exit(1)
}
if (!xlsxFiles.length) {
  console.error(`✗ No .xlsx in ${dir}. Re-download the DOE Excel (data.nlr.gov/submissions/222) and re-run.`)
  process.exit(1)
}
const file = resolve(dir, xlsxFiles[xlsxFiles.length - 1])  // latest by name (filenames carry a date)
console.log(`→ Parsing ${xlsxFiles[xlsxFiles.length - 1]} (threshold: NMTC_2020_pct > ${QUALIFY_MIN_PCT})`)

const wb = xlsx.readFile(file)
const sheetName = wb.SheetNames.find(n => /tract/i.test(n)) || wb.SheetNames[wb.SheetNames.length - 1]
const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName])
const tracts = rawRows.map(parseTractRow).filter(t => t && t.countyFips)
const counties = rollupByCounty(tracts, FIPS_TO_USPS, { minPct: QUALIFY_MIN_PCT })

const totalTracts = counties.reduce((s, c) => s + c.total_tracts_in_county, 0)
const totalQualTracts = counties.reduce((s, c) => s + c.qualifying_tracts_count, 0)
const countiesWithLic = counties.filter(c => c.qualifying_tracts_count > 0).length
console.log(`→ Parsed ${rawRows.length} tract rows → ${tracts.length} valid → ${counties.length} tracked counties`)
console.log(`   ${countiesWithLic}/${counties.length} counties have ≥1 LIC tract · ${totalQualTracts}/${totalTracts} tracts qualify`)

// ── 2. emit the committed artifact (scalars only — no geoid arrays) ──
const artifactRows = counties.map(c => ({
  county_fips:             c.county_fips,
  state:                   c.state,
  county_name:             c.county_name,
  total_tracts_in_county:  c.total_tracts_in_county,
  qualifying_tracts_count: c.qualifying_tracts_count,
}))
const artifactPath = resolve(process.cwd(), 'src/data/nmtcLicCounties.js')
const banner =
`// AUTO-GENERATED by scripts/seed-nmtc-lic.mjs — do not edit by hand.
// Per-county rollup of NMTC §48(e) Category 1 Low-Income-Community eligibility.
// Source: ${META.source}
// Threshold: a tract is LIC when NMTC_2020_pct > ${QUALIFY_MIN_PCT}.
// Regenerate: re-download the DOE Excel to data/cdfi-lic/, then
//   node scripts/seed-nmtc-lic.mjs          (regenerates this file + prints the DB impact diff)
//   node scripts/seed-nmtc-lic.mjs --apply  (also upserts nmtc_lic_data)
`
const body =
`export const NMTC_LIC_META = ${JSON.stringify(META)}

export const NMTC_LIC_COUNTIES = [
${artifactRows.map(r => JSON.stringify(r)).join(',\n')}
]
`
writeFileSync(artifactPath, `${banner}\n${body}`)
console.log(`→ Wrote ${artifactRows.length} counties to src/data/nmtcLicCounties.js`)

// ── 3. DB diff (read-only) + optional upsert ──
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.log('\n(no SUPABASE creds — skipping DB diff/apply; artifact generated)')
  process.exit(0)
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// pull current eligibility for the flip diff (paginate past the 1000-row cap)
const current = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
    .from('nmtc_lic_data')
    .select('county_fips, qualifying_tracts_count')
    .range(from, from + 999)
  if (error) { console.error(`✗ DB read failed: ${error.message}`); process.exit(1) }
  for (const r of data) current.set(r.county_fips, r.qualifying_tracts_count || 0)
  if (data.length < 1000) break
}

const newlyEligible = []   // old==0/absent → new>0  (the metro uplift we expect)
const newlyIneligible = [] // old>0 → new==0
for (const c of counties) {
  const wasElig = (current.get(c.county_fips) || 0) > 0
  const isElig = c.qualifying_tracts_count > 0
  if (isElig && !wasElig) newlyEligible.push(c)
  else if (!isElig && wasElig) newlyIneligible.push(c)
}
console.log(`\n── impact vs live DB (${current.size} rows) ──`)
console.log(`   newly ELIGIBLE:   ${newlyEligible.length}  e.g. ${newlyEligible.slice(0, 8).map(c => `${c.state}/${c.county_name}`).join(', ') || '—'}`)
console.log(`   newly INELIGIBLE: ${newlyIneligible.length}  e.g. ${newlyIneligible.slice(0, 8).map(c => `${c.state}/${c.county_name}`).join(', ') || '—'}`)

if (!APPLY) {
  console.log('\n(dry-run — no DB writes. Re-run with --apply to upsert nmtc_lic_data.)')
  process.exit(0)
}

// ── upsert (merge by county_fips; legacy via_*/mfi cleared, geoids emptied) ──
const nowIso = new Date().toISOString()
const dbRows = counties.map(c => ({
  county_fips:                 c.county_fips,
  state:                       c.state,
  county_name:                 c.county_name,
  total_tracts_in_county:      c.total_tracts_in_county,
  qualifying_tracts_count:     c.qualifying_tracts_count,
  qualifying_via_poverty:      0,      // legacy column — not split by the authoritative source
  qualifying_via_low_mfi:      0,      // legacy column — not split by the authoritative source
  qualifying_tract_geoids:     [],     // cleared (drill-down sample is a future tract-level track)
  state_median_family_income:  null,   // legacy column — N/A for the published determination
  dataset_version:             META.datasetVersion,
  last_updated:                nowIso,
  source:                      META.source,
}))
const BATCH = 500
let upserted = 0
for (let i = 0; i < dbRows.length; i += BATCH) {
  const slice = dbRows.slice(i, i + BATCH)
  const { error } = await admin.from('nmtc_lic_data').upsert(slice, { onConflict: 'county_fips' })
  if (error) { console.error(`✗ upsert failed at batch ${i / BATCH}: ${error.message}`); process.exit(1) }
  upserted += slice.length
}
console.log(`\n✓ upserted ${upserted} counties into nmtc_lic_data`)
