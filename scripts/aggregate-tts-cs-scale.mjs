/**
 * Phase A aggregator: stream the LBNL TTS CSV, filter to community-solar scale
 * (1-5 MW non-residential, last 3 install years), compute per-state $/W
 * percentiles. Output is a CSV-style table that I can paste into the
 * recalibration commit.
 *
 * Scope decisions:
 *   - Size bracket: 1,000 – 5,000 kW DC (the literal Tractova CS scale).
 *     If sample size is thin in some states, also report the broader
 *     500 – 5,000 kW bracket as fallback.
 *   - Segments: all non-residential (COM, NON-RES, AGRICULTURAL, SCHOOL,
 *     GOV, NON-PROFIT, OTHER TAX-EXEMPT). Excludes RES_*.
 *   - Vintage: install years 2022, 2023, 2024 (last 3 years; 2024 is the
 *     most recent in the 29-Sep-2025 release).
 *   - State validation: only USPS 2-char codes (filters out the dirty rows
 *     where state field contains city names like "CHINCOTEAGUE").
 *   - Price validation: total_installed_price > 0, not NaN, not -1; size > 0.
 *   - $/W computation: total_installed_price / (PV_system_size_DC * 1000).
 *
 * Run: node scripts/aggregate-tts-cs-scale.mjs
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'public/TTS_LBNL_public_file_29-Sep-2025_all.csv')
const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })

const VALID_USPS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

const NON_RES_SEGMENTS = new Set([
  'COM', 'NON-RES', 'AGRICULTURAL', 'SCHOOL', 'GOV', 'NON-PROFIT', 'OTHER TAX-EXEMPT',
])

const RECENT_YEARS = new Set([2022, 2023, 2024])

// Two scale brackets — primary is the literal Tractova CS scale; fallback is
// broader and lets us see if extending to 500 kW changes state coverage.
const PRIMARY = { min: 1000, max: 5000, label: 'CS scale (1-5 MW)' }
const FALLBACK = { min: 500,  max: 5000, label: 'Wider (500 kW - 5 MW)' }

let header = null
let colIdx = {}
let rowsScanned = 0
let rowsKeptPrimary = 0
let rowsKeptFallback = 0

// Per-state arrays of $/W values for percentile computation
const primary = new Map()    // state -> [d/W, ...]
const fallback = new Map()

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
  if (!RECENT_YEARS.has(year)) continue

  const size = parseFloat(f[colIdx.PV_system_size_DC])
  if (isNaN(size) || size <= 0 || size === -1) continue

  const price = parseFloat(f[colIdx.total_installed_price])
  if (isNaN(price) || price <= 0 || price === -1) continue

  const dollarsPerWatt = price / (size * 1000)
  // Hard sanity cap — exclude obvious data-entry errors. CS-scale projects
  // realistically run $1.00 - $6.00/W. Anything outside this is a parse bug
  // (price-in-cents, size-in-W, etc.) we don't want polluting the median.
  if (dollarsPerWatt < 0.50 || dollarsPerWatt > 8.00) continue

  if (size >= FALLBACK.min && size <= FALLBACK.max) {
    if (!fallback.has(state)) fallback.set(state, [])
    fallback.get(state).push(dollarsPerWatt)
    rowsKeptFallback++
  }
  if (size >= PRIMARY.min && size <= PRIMARY.max) {
    if (!primary.has(state)) primary.set(state, [])
    primary.get(state).push(dollarsPerWatt)
    rowsKeptPrimary++
  }
}

process.stderr.write(`\r  scanned ${rowsScanned.toLocaleString()} rows.    \n`)
console.log(`\nTotal scanned: ${rowsScanned.toLocaleString()}`)
console.log(`Kept (CS scale 1-5 MW): ${rowsKeptPrimary.toLocaleString()}`)
console.log(`Kept (wider 500 kW - 5 MW): ${rowsKeptFallback.toLocaleString()}`)
console.log()

// National medians across all states — these are the literal "national large
// non-res median $/W" denominators used to compute Tier A state multipliers.
// Replaces the prior "midpoint of 20-80% band $2.40" synthesis with the
// actual TTS-derived median.
function nationalMedian(byState) {
  const all = []
  for (const arr of byState.values()) all.push(...arr)
  return percentile(all, 50)
}
function percentile(arr, p) {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

const nationalMedianPrimary  = nationalMedian(primary)
const nationalMedianFallback = nationalMedian(fallback)
console.log(`NATIONAL MEDIAN (Tier A denominator):`)
console.log(`  CS-scale 1-5 MW:        $${nationalMedianPrimary?.toFixed(2)}/W   (n=${[...primary.values()].reduce((s, a) => s + a.length, 0)})`)
console.log(`  Wider 500 kW - 5 MW:    $${nationalMedianFallback?.toFixed(2)}/W   (n=${[...fallback.values()].reduce((s, a) => s + a.length, 0)})`)
console.log()

function median(arr) { return percentile(arr, 50) }

function reportBracket(label, byState) {
  console.log('═'.repeat(86))
  console.log(`${label}`)
  console.log('═'.repeat(86))
  console.log(`  STATE  count    p10     p25     p50      p75     p90      mean`)
  console.log(`  ─────  ─────   ─────   ─────   ─────   ─────   ─────   ─────`)
  // Order: 17 active CS states first (matching Tractova's coverage), then
  // any other state with significant sample. Active CS states from our
  // probe-active-cs-states.mjs run: IL, NY, MA, MN, CO, NJ, ME, MD,
  // CA, FL, CT, HI, NM, OR, RI, VA, WA.
  const active = ['IL','NY','MA','MN','CO','NJ','ME','MD','CA','FL','CT','HI','NM','OR','RI','VA','WA']
  const otherStates = [...byState.keys()].filter(s => !active.includes(s)).sort()
  for (const state of [...active, '---separator---', ...otherStates]) {
    if (state === '---separator---') {
      console.log('  ─────────────── (other states)')
      continue
    }
    const arr = byState.get(state) || []
    if (arr.length === 0) {
      console.log(`  ${state}     —`)
      continue
    }
    const p10 = percentile(arr, 10)
    const p25 = percentile(arr, 25)
    const p50 = median(arr)
    const p75 = percentile(arr, 75)
    const p90 = percentile(arr, 90)
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    console.log(
      `  ${state}     ${arr.length.toString().padStart(5)}  ${p10.toFixed(2)}    ${p25.toFixed(2)}    ${p50.toFixed(2)}    ${p75.toFixed(2)}    ${p90.toFixed(2)}    ${mean.toFixed(2)}`
    )
  }
  console.log()
}

reportBracket(PRIMARY.label, primary)
reportBracket(FALLBACK.label, fallback)

// Year-by-year breakdown for the 17 active states (helps spot vintage skew)
console.log('═'.repeat(86))
console.log('YEAR BREAKDOWN — primary bracket (1-5 MW), 17 active CS states')
console.log('═'.repeat(86))
console.log(`  STATE  2022 (n / med)        2023 (n / med)        2024 (n / med)`)
const active = ['IL','NY','MA','MN','CO','NJ','ME','MD','CA','FL','CT','HI','NM','OR','RI','VA','WA']

// To get per-year arrays we need to re-scan or have stored them — re-scan
// is cheaper than allocating a Map<year, Map<state, [...]>> upfront for
// just this report.
// We already finished the stream so re-open it.

const rl2 = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
const byStateYear = new Map()  // 'state::year' -> [d/W, ...]
let h = null, ci = {}

for await (const line of rl2) {
  if (h === null) {
    h = line.split(',')
    h.forEach((c, i) => { ci[c] = i })
    continue
  }
  const f = line.split(',')
  const state = f[ci.state]
  if (!VALID_USPS.has(state)) continue
  if (!active.includes(state)) continue
  const seg = f[ci.customer_segment]
  if (!NON_RES_SEGMENTS.has(seg)) continue
  const date = f[ci.installation_date]
  if (!date || date.length < 4) continue
  const year = parseInt(date.slice(0, 4), 10)
  if (!RECENT_YEARS.has(year)) continue
  const size = parseFloat(f[ci.PV_system_size_DC])
  if (isNaN(size) || size < PRIMARY.min || size > PRIMARY.max) continue
  const price = parseFloat(f[ci.total_installed_price])
  if (isNaN(price) || price <= 0) continue
  const dpw = price / (size * 1000)
  if (dpw < 0.50 || dpw > 8.00) continue
  const k = `${state}::${year}`
  if (!byStateYear.has(k)) byStateYear.set(k, [])
  byStateYear.get(k).push(dpw)
}

for (const state of active) {
  const cells = []
  for (const year of [2022, 2023, 2024]) {
    const arr = byStateYear.get(`${state}::${year}`) || []
    if (arr.length === 0) {
      cells.push('—'.padEnd(20))
    } else {
      cells.push(`${arr.length}n  $${median(arr).toFixed(2)}/W`.padEnd(20))
    }
  }
  console.log(`  ${state}     ${cells.join('   ')}`)
}
