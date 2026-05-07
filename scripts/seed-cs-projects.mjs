/**
 * One-shot seed for cs_projects from NREL "Sharing the Sun" XLSX.
 *
 *   Usage:  node scripts/seed-cs-projects.mjs                       # use newest "Sharing the Sun*.xlsx" in data/
 *           node scripts/seed-cs-projects.mjs --file=path/to.xlsx   # explicit path
 *           node scripts/seed-cs-projects.mjs --dry-run             # parse + report, no upsert
 *
 * Filter rules:
 *   - Sheet "Project List" only
 *   - row[col 23] (Aggregated Data Entry) === 'No' (drop aggregate roll-ups)
 *   - state ∈ valid USPS
 *   - project_id present (used as primary key)
 *   - Year of Interconnection populated (some rows are placeholder)
 *
 * Field mapping (source → cs_projects column):
 *   col 0  Utility ID                  → utility_id (int or null)
 *   col 1  Project Name                → project_name
 *   col 2  Project ID                  → project_id (PK)
 *   col 3  City                        → city
 *   col 4  State                       → state
 *   col 5  Utility                     → utility_name
 *   col 6  Utility Type                → utility_type
 *   col 7  Subscription Marketer       → subscription_marketer
 *   col 8  Program Name                → program_name (often null)
 *   col 9  Developer / Subscription Manager / Contractor → developer_name
 *           (Source uses '.' as a placeholder for unknown — coerced to null)
 *   col 10 System Size (MW-AC)         → system_size_mw_ac
 *   col 12 System Size (MW-DC)         → system_size_mw_dc
 *   col 14 Year of Interconnection     → vintage_year
 *   col 15 LMI Portion Requirement     → lmi_required (Yes→true, No→false, Unknown→null)
 *   col 20 LMI Portion                 → lmi_portion_pct (× 100; 'Unknown'→null)
 *   col 22 LMI System Size (MW-AC)     → lmi_size_mw_ac ('Unknown'→null)
 */
import { read, utils } from 'xlsx'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env loader ────────────────────────────────────────────────────────────
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

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argSet = new Set(args)
const DRY_RUN = argSet.has('--dry-run')
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1]

function newestXlsx() {
  const dir = resolve(process.cwd(), 'data')
  const files = readdirSync(dir)
    .filter(f => /^Sharing the Sun.*\.xlsx$/i.test(f))
    .map(f => join(dir, f))
  if (!files.length) {
    throw new Error('No "Sharing the Sun*.xlsx" found in data/. Download from nrel.gov community-solar-data, or pass --file=PATH.')
  }
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

const inputFile = fileArg
  ? resolve(process.cwd(), fileArg)
  : newestXlsx()

console.log(`→ Source: ${inputFile}`)
if (DRY_RUN) console.log(`  (--dry-run — no upsert)\n`)

// Extract release stamp from filename, e.g. "Sharing the Sun ... (Jan 2026).xlsx" → "Jan 2026"
const releaseMatch = inputFile.match(/\(([^)]+)\)\.xlsx$/i)
const sourceRelease = releaseMatch ? releaseMatch[1] : null
console.log(`  source_release: ${sourceRelease || '(unknown)'}`)

const VALID_USPS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

// ── parse XLSX ────────────────────────────────────────────────────────────
const wb = read(readFileSync(inputFile), { type: 'buffer' })
const ws = wb.Sheets['Project List']
if (!ws) throw new Error('Sheet "Project List" not found in workbook.')
const rows = utils.sheet_to_json(ws, { header: 1, defval: null })
const headers = rows[0]
const data = rows.slice(1).filter(r => r.some(c => c != null))
console.log(`\n→ Sheet "Project List": ${data.length} non-empty rows after header`)

// Locate columns by exact header (resilient to NREL adding columns mid-list)
function colByExactHeader(label) {
  const idx = headers.findIndex(h => h === label)
  if (idx === -1) throw new Error(`Column "${label}" not found in workbook headers — schema may have changed.`)
  return idx
}
const COL = {
  utility_id:    colByExactHeader('Utility ID'),
  project_name:  colByExactHeader('Project Name'),
  project_id:    colByExactHeader('Project ID'),
  city:          colByExactHeader('City'),
  state:         colByExactHeader('State'),
  utility:       colByExactHeader('Utility'),
  utility_type:  colByExactHeader('Utility Type'),
  marketer:      colByExactHeader('Subscription Marketer'),
  program:       colByExactHeader('Program Name'),
  developer:     colByExactHeader('Developer, Subscription Management, or Contractor Name'),
  size_mw_ac:    colByExactHeader('System Size (MW-AC)'),
  size_mw_dc:    colByExactHeader('System Size (MW-DC)'),
  vintage_year:  colByExactHeader('Year of Interconnection'),
  lmi_required:  colByExactHeader('Does this Project have LMI Portion Requirement?'),
  lmi_portion:   colByExactHeader('LI/LMI Portion'),
  lmi_size_ac:   colByExactHeader('LI/LMI System Size (MW-AC)'),
  aggregated:    colByExactHeader('Aggregated Data Entry (Does this row refer to aggregated capacity rather than an individual project?)'),
}

// ── helpers ───────────────────────────────────────────────────────────────
const cleanText = (v) => {
  if (v == null) return null
  const s = String(v).trim()
  if (!s || s === '.' || s.toLowerCase() === 'unknown') return null
  return s
}
const parseInteger = (v) => {
  if (v == null || v === '') return null
  const n = parseInt(String(v).replace(/[, ]/g, ''), 10)
  return isNaN(n) ? null : n
}
const parseFloatOrNull = (v) => {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!s || s.toLowerCase() === 'unknown') return null
  const n = parseFloat(s.replace(/[, ]/g, ''))
  return isNaN(n) ? null : n
}
const parseTriBool = (v) => {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  if (s === 'yes') return true
  if (s === 'no') return false
  return null  // 'unknown' / blank / anything else
}

// ── transform rows ────────────────────────────────────────────────────────
const upserts = []
const skipped = { aggregated: 0, no_state: 0, no_id: 0, no_year: 0, bad_state: 0, dup_id: 0 }
const seenIds = new Set()

for (const r of data) {
  if (String(r[COL.aggregated] || '').toLowerCase() === 'yes') {
    skipped.aggregated++
    continue
  }
  const projectId = cleanText(r[COL.project_id])
  if (!projectId) { skipped.no_id++; continue }
  if (seenIds.has(projectId)) { skipped.dup_id++; continue }

  const stateRaw = cleanText(r[COL.state])
  if (!stateRaw) { skipped.no_state++; continue }
  if (!VALID_USPS.has(stateRaw)) { skipped.bad_state++; continue }

  const vintage = parseInteger(r[COL.vintage_year])
  if (!vintage || vintage < 2000 || vintage > 2030) { skipped.no_year++; continue }

  // LMI portion: source value is a fraction 0-1 (e.g. 1.0 == 100%); store as 0-100.
  const lmiPortionRaw = parseFloatOrNull(r[COL.lmi_portion])
  const lmiPct = lmiPortionRaw == null
    ? null
    : Number((lmiPortionRaw <= 1.5 ? lmiPortionRaw * 100 : lmiPortionRaw).toFixed(2))

  upserts.push({
    project_id:            projectId,
    utility_id:            parseInteger(r[COL.utility_id]),
    project_name:          cleanText(r[COL.project_name]) || projectId,
    city:                  cleanText(r[COL.city]),
    state:                 stateRaw,
    utility_name:          cleanText(r[COL.utility]),
    utility_type:          cleanText(r[COL.utility_type]),
    subscription_marketer: cleanText(r[COL.marketer]),
    program_name:          cleanText(r[COL.program]),
    developer_name:        cleanText(r[COL.developer]),
    system_size_mw_ac:     parseFloatOrNull(r[COL.size_mw_ac]),
    system_size_mw_dc:     parseFloatOrNull(r[COL.size_mw_dc]),
    vintage_year:          vintage,
    lmi_required:          parseTriBool(r[COL.lmi_required]),
    lmi_portion_pct:       lmiPct,
    lmi_size_mw_ac:        parseFloatOrNull(r[COL.lmi_size_ac]),
    source:                'NREL_SHARING_THE_SUN',
    source_release:        sourceRelease,
    last_updated:          new Date().toISOString(),
  })
  seenIds.add(projectId)
}

console.log(`\n→ Filter results:`)
console.log(`  individual projects accepted: ${upserts.length}`)
console.log(`  aggregated rows skipped:      ${skipped.aggregated}`)
console.log(`  no project_id:                ${skipped.no_id}`)
console.log(`  no/invalid state:             ${skipped.no_state + skipped.bad_state}`)
console.log(`  no/invalid vintage_year:      ${skipped.no_year}`)
console.log(`  duplicate project_id:         ${skipped.dup_id}`)

// State distribution sanity
const byState = new Map()
for (const r of upserts) {
  const k = r.state
  if (!byState.has(k)) byState.set(k, { count: 0, mw: 0 })
  byState.get(k).count++
  if (r.system_size_mw_ac != null) byState.get(k).mw += r.system_size_mw_ac
}
const sorted = [...byState.entries()].sort((a, b) => b[1].count - a[1].count)
console.log(`\n→ State distribution (top 15):`)
console.log(`  STATE   projects   operational MW`)
console.log(`  ─────   ────────   ──────────────`)
for (const [st, v] of sorted.slice(0, 15)) {
  console.log(`  ${st}      ${v.count.toString().padStart(5)}      ${v.mw.toFixed(1).padStart(10)}`)
}
console.log(`  ─────   ────────   ──────────────`)
console.log(`  total: ${sorted.length} states, ${upserts.length} projects`)

if (DRY_RUN) {
  console.log(`\n[--dry-run] no upsert performed.`)
  process.exit(0)
}

// ── upsert in batches ─────────────────────────────────────────────────────
const BATCH = 500
let upserted = 0
console.log(`\n→ Upserting ${upserts.length} rows in batches of ${BATCH}…`)
for (let i = 0; i < upserts.length; i += BATCH) {
  const slice = upserts.slice(i, i + BATCH)
  const { error } = await admin
    .from('cs_projects')
    .upsert(slice, { onConflict: 'project_id' })
  if (error) {
    console.error(`✗ Batch ${i / BATCH} failed: ${error.message}`)
    process.exit(1)
  }
  upserted += slice.length
  process.stderr.write(`\r  ${upserted.toString().padStart(5)} / ${upserts.length}`)
}
process.stderr.write(`\r  ${upserted} / ${upserts.length}    \n`)
console.log(`✓ Upserted ${upserted} rows.`)
