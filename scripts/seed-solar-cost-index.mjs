/**
 * One-shot seed for solar_cost_index from the LBNL Tracking the Sun CSV.
 *
 * The local file is large (~1.9 GB uncompressed for the 29-Sep-2025 release),
 * so the canonical refresh path is this local script — not the Vercel cron.
 * The cron is best-effort yearly automation; if LBNL changes their host or
 * the CSV gets larger, fail-clean and Aden re-runs this locally.
 *
 *   Usage:  node scripts/seed-solar-cost-index.mjs                       # use newest TTS_LBNL_public_file_*.csv in public/
 *           node scripts/seed-solar-cost-index.mjs --file=path/to.csv    # explicit path
 *           node scripts/seed-solar-cost-index.mjs --dry-run             # compute but don't upsert
 *
 * Methodology mirrors api/refresh-data.js → refreshSolarCosts() exactly so
 * the two paths produce identical rows. Filter:
 *   - non-residential customer segments (COM/NON-RES/AGRICULTURAL/SCHOOL/GOV/
 *     NON-PROFIT/OTHER TAX-EXEMPT)
 *   - 0.5-5 MW DC (LBNL "large non-residential")
 *   - last 3 install years (latest year ± 2)
 *   - $/W ∈ [0.50, 8.00] sanity bounds
 *
 * Per-state percentiles (p10/p25/p50/p75/p90) are upserted as one row per
 * state per vintage_year. Sector is hardcoded 'large_non_res' — the bracket
 * Phase B targets.
 */
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── env loader ─────────────────────────────────────────────────────────────
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

// ── args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argSet = new Set(args)
const DRY_RUN = argSet.has('--dry-run')
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1]

function newestTtsCsv() {
  const dir = resolve(process.cwd(), 'public')
  const files = readdirSync(dir)
    .filter(f => /^TTS_LBNL_public_file_.+_all\.csv$/i.test(f))
    .map(f => join(dir, f))
  if (!files.length) {
    throw new Error('No TTS_LBNL_public_file_*.csv found in public/. Download from emp.lbl.gov/tracking-the-sun and place in public/, or pass --file=PATH.')
  }
  // Filename dates (29-Sep-2025) sort lexicographically wrong — pick by mtime.
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

const inputFile = fileArg
  ? resolve(process.cwd(), fileArg)
  : newestTtsCsv()

console.log(`→ Source CSV: ${inputFile}`)
if (DRY_RUN) console.log(`  (--dry-run — rows will not be upserted)`)

// ── filter constants (must mirror api/refresh-data.js → refreshSolarCosts) ──
const VALID_USPS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

const NON_RES_SEGMENTS = new Set([
  'COM', 'NON-RES', 'AGRICULTURAL', 'SCHOOL', 'GOV', 'NON-PROFIT', 'OTHER TAX-EXEMPT',
])

const SIZE_MIN_KW = 500
const SIZE_MAX_KW = 5000
const DPW_FLOOR = 0.50
const DPW_CEIL  = 8.00

// Tier ladder — MUST mirror api/refresh-data.js → refreshSolarCosts() exactly.
// If these constants drift between the two files, refreshes will flip rows
// between tiers between scheduled runs. Update both in lockstep.
const TIER_FLOOR        = 3   // n<3 → not published, falls through to Tier B
const TIER_MODEST_MIN   = 10  // n=10-39 → 'modest'
const TIER_STRONG_MIN   = 40  // n>=40  → 'strong'

function assignTier(n) {
  if (n >= TIER_STRONG_MIN) return 'strong'
  if (n >= TIER_MODEST_MIN) return 'modest'
  if (n >= TIER_FLOOR)      return 'thin'
  return null
}

// ── stream-parse ────────────────────────────────────────────────────────────
const rl = createInterface({ input: createReadStream(inputFile), crlfDelay: Infinity })

let header = null
let colIdx = {}
let rowsScanned = 0
let rowsKept = 0
let latestYearSeen = 0
const byState = new Map()

for await (const line of rl) {
  if (header === null) {
    header = line.split(',')
    header.forEach((c, i) => { colIdx[c] = i })
    continue
  }
  rowsScanned++
  if (rowsScanned % 500000 === 0) {
    process.stderr.write(`\r  scanned ${rowsScanned.toLocaleString()} rows…`)
  }
  const f = line.split(',')
  const state = f[colIdx.state]
  if (!VALID_USPS.has(state)) continue

  const seg = f[colIdx.customer_segment]
  if (!NON_RES_SEGMENTS.has(seg)) continue

  const date = f[colIdx.installation_date]
  if (!date || date.length < 4) continue
  const year = parseInt(date.slice(0, 4), 10)
  if (!year || year < 2000) continue
  if (year > latestYearSeen) latestYearSeen = year

  const size = parseFloat(f[colIdx.PV_system_size_DC])
  if (isNaN(size) || size < SIZE_MIN_KW || size > SIZE_MAX_KW) continue

  const price = parseFloat(f[colIdx.total_installed_price])
  if (isNaN(price) || price <= 0) continue

  const dpw = price / (size * 1000)
  if (dpw < DPW_FLOOR || dpw > DPW_CEIL) continue

  if (!byState.has(state)) byState.set(state, [])
  byState.get(state).push({ dpw, year })
  rowsKept++
}
process.stderr.write(`\r  scanned ${rowsScanned.toLocaleString()} rows.    \n`)

if (latestYearSeen < 2020 || rowsKept < 100) {
  throw new Error(`TTS parse anomaly: rows_scanned=${rowsScanned}, rows_kept=${rowsKept}, latest_year=${latestYearSeen}.`)
}

const recentYears = new Set([latestYearSeen, latestYearSeen - 1, latestYearSeen - 2])
const vintageWindow = `${latestYearSeen - 2}-${latestYearSeen}`

console.log(`\nLatest install year: ${latestYearSeen}`)
console.log(`Aggregation window: ${vintageWindow}`)
console.log(`Total rows kept (all states, all years): ${rowsKept.toLocaleString()}`)

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

const upsertRows = []
const skipped = []
for (const [state, arr] of byState) {
  const recent = arr.filter(r => recentYears.has(r.year)).map(r => r.dpw)
  const tier = assignTier(recent.length)
  if (!tier) {
    skipped.push({ state, n: recent.length })
    continue
  }
  const sorted = [...recent].sort((a, b) => a - b)
  upsertRows.push({
    state,
    sector:                   'large_non_res',
    vintage_year:             latestYearSeen,
    vintage_window:           vintageWindow,
    install_count:            recent.length,
    confidence_tier:          tier,
    aggregation_window_years: 3,
    p10_per_watt:             Number(percentile(sorted, 10).toFixed(2)),
    p25_per_watt:             Number(percentile(sorted, 25).toFixed(2)),
    p50_per_watt:             Number(percentile(sorted, 50).toFixed(2)),
    p75_per_watt:             Number(percentile(sorted, 75).toFixed(2)),
    p90_per_watt:             Number(percentile(sorted, 90).toFixed(2)),
    source:                   'LBNL_TTS',
    source_url:               'https://emp.lbl.gov/tracking-the-sun',
    notes:                    `Tier=${tier}, n=${recent.length}; LBNL Tracking the Sun ${vintageWindow} install years, customer_segment ∈ {COM,NON-RES,AGRICULTURAL,SCHOOL,GOV,NON-PROFIT,OTHER TAX-EXEMPT}, ${SIZE_MIN_KW}-${SIZE_MAX_KW} kW DC.`,
    last_updated:             new Date().toISOString(),
  })
}

upsertRows.sort((a, b) => a.state.localeCompare(b.state))

const byTier = { strong: [], modest: [], thin: [] }
for (const r of upsertRows) byTier[r.confidence_tier].push(r)

console.log(`\nStates published (n>=${TIER_FLOOR}): ${upsertRows.length}`)
console.log(`  · strong (n>=${TIER_STRONG_MIN}): ${byTier.strong.length}`)
console.log(`  · modest (n=${TIER_MODEST_MIN}-${TIER_STRONG_MIN - 1}): ${byTier.modest.length}`)
console.log(`  · thin   (n=${TIER_FLOOR}-${TIER_MODEST_MIN - 1}): ${byTier.thin.length}`)
console.log(`States skipped (n<${TIER_FLOOR}): ${skipped.length}`)
console.log()

function printTierTable(label, rows) {
  if (!rows.length) return
  console.log(`── ${label} ──`)
  console.log(`STATE   n      p10    p25    p50    p75    p90`)
  console.log(`─────  ─────  ─────  ─────  ─────  ─────  ─────`)
  for (const r of rows) {
    console.log(
      `  ${r.state}  ${r.install_count.toString().padStart(5)}  ${r.p10_per_watt.toFixed(2).padStart(5)}  ${r.p25_per_watt.toFixed(2).padStart(5)}  ${r.p50_per_watt.toFixed(2).padStart(5)}  ${r.p75_per_watt.toFixed(2).padStart(5)}  ${r.p90_per_watt.toFixed(2).padStart(5)}`
    )
  }
  console.log()
}

printTierTable(`STRONG (n>=${TIER_STRONG_MIN})`, byTier.strong)
printTierTable(`MODEST (n=${TIER_MODEST_MIN}-${TIER_STRONG_MIN - 1})`, byTier.modest)
printTierTable(`THIN   (n=${TIER_FLOOR}-${TIER_MODEST_MIN - 1})`, byTier.thin)

if (skipped.length) {
  console.log(`Skipped (n<${TIER_FLOOR}): ${skipped.map(s => `${s.state}(${s.n})`).join(', ')}`)
}

if (DRY_RUN) {
  console.log(`\n[--dry-run] no upsert performed.`)
  process.exit(0)
}

console.log(`\n→ Upserting ${upsertRows.length} rows to solar_cost_index…`)
const { error } = await admin
  .from('solar_cost_index')
  .upsert(upsertRows, { onConflict: 'state,sector,vintage_year,source,aggregation_window_years' })
if (error) {
  console.error(`✗ Upsert failed: ${error.message}`)
  process.exit(1)
}
console.log(`✓ Upserted ${upsertRows.length} rows.`)
