/**
 * One-shot stream probe of the LBNL TTS CSV to verify schema before the full
 * Phase A aggregation. Reports:
 *   - Distinct customer_segment codes + counts
 *   - System-size distribution per segment (to confirm if PV_system_size_DC
 *     is kW vs W, and to identify the community-solar bracket)
 *   - $/W computed from total_installed_price / (size * units)
 *   - Date range available
 *   - State distribution
 *
 * Streams the file line-by-line so we don't blow memory on the 1.9 GB CSV.
 *
 * Run: node scripts/probe-tts.mjs
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'data/TTS_LBNL_public_file_29-Sep-2025_all.csv')
const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })

let header = null
let colIdx = {}
let rowCount = 0
const segmentCounts = new Map()
const segmentSizes = new Map()  // segment → { min, max, sum, count, samples: [] }
const segmentPrices = new Map() // segment → { sumDollarsPerW, count }
const stateCounts = new Map()
const yearCounts = new Map()
const segmentByYear = new Map()  // 'segment::year' → count for recent vintages

const SAMPLE_PER_SEGMENT = 5
const RECENT_YEAR = 2022

for await (const line of rl) {
  if (header === null) {
    header = line.split(',')
    header.forEach((c, i) => { colIdx[c] = i })
    console.log(`Header parsed (${header.length} columns)`)
    console.log(`Required columns:`)
    for (const c of ['installation_date', 'PV_system_size_DC', 'total_installed_price', 'customer_segment', 'state']) {
      console.log(`  ${c}: index ${colIdx[c]}`)
    }
    console.log()
    continue
  }
  rowCount++
  if (rowCount % 500000 === 0) process.stderr.write(`\r  scanned ${rowCount.toLocaleString()} rows…`)

  // Naive split — TTS doesn't quote-escape commas in fields per LBNL convention
  // (codebook says "no embedded commas in fields"). If a field genuinely had
  // a comma the row would break, but we tolerate that for the probe.
  const f = line.split(',')
  const seg = f[colIdx.customer_segment]
  const sizeStr = f[colIdx.PV_system_size_DC]
  const priceStr = f[colIdx.total_installed_price]
  const state = f[colIdx.state]
  const date = f[colIdx.installation_date]
  const year = date && date.length >= 4 ? parseInt(date.slice(0, 4), 10) : null

  segmentCounts.set(seg, (segmentCounts.get(seg) || 0) + 1)
  if (state) stateCounts.set(state, (stateCounts.get(state) || 0) + 1)
  if (year) yearCounts.set(year, (yearCounts.get(year) || 0) + 1)

  const size = parseFloat(sizeStr)
  if (!isNaN(size) && size > 0 && size !== -1) {
    if (!segmentSizes.has(seg)) segmentSizes.set(seg, { min: Infinity, max: -Infinity, sum: 0, count: 0, samples: [] })
    const s = segmentSizes.get(seg)
    if (size < s.min) s.min = size
    if (size > s.max) s.max = size
    s.sum += size
    s.count++
    if (s.samples.length < SAMPLE_PER_SEGMENT) {
      s.samples.push({ size, price: parseFloat(priceStr), state, date })
    }
  }

  const price = parseFloat(priceStr)
  if (!isNaN(price) && price > 0 && price !== -1 && !isNaN(size) && size > 0 && size !== -1) {
    // If size is in kW, $/W = price / (size * 1000). If size is in W, $/W = price / size.
    // We log both interpretations in segmentPrices so we can spot which is sane.
    if (!segmentPrices.has(seg)) segmentPrices.set(seg, { kWAssumption: 0, wAssumption: 0, count: 0 })
    const p = segmentPrices.get(seg)
    p.kWAssumption += price / (size * 1000)  // assumes size is kW
    p.wAssumption  += price / size            // assumes size is W
    p.count++
  }

  if (year && year >= RECENT_YEAR && seg) {
    const k = `${seg}::${year}`
    segmentByYear.set(k, (segmentByYear.get(k) || 0) + 1)
  }
}

process.stderr.write(`\r  scanned ${rowCount.toLocaleString()} rows.    \n\n`)

console.log('═'.repeat(70))
console.log('CUSTOMER SEGMENTS (sorted by count)')
console.log('═'.repeat(70))
const segSorted = [...segmentCounts.entries()].sort((a, b) => b[1] - a[1])
for (const [seg, count] of segSorted) {
  const s = segmentSizes.get(seg)
  const avgSize = s ? (s.sum / s.count).toFixed(2) : '—'
  const minSize = s ? s.min.toFixed(2) : '—'
  const maxSize = s ? s.max.toFixed(2) : '—'
  console.log(`  ${(seg || '(blank)').padEnd(20)} ${count.toString().padStart(10)}  size avg=${avgSize.padStart(8)} min=${minSize.padStart(8)} max=${maxSize.padStart(10)}`)
}

console.log()
console.log('═'.repeat(70))
console.log('PRICE INTERPRETATION CHECK ($/W computed two ways)')
console.log('═'.repeat(70))
console.log(`  segment              avg($/W if size=kW)   avg($/W if size=W)`)
for (const [seg, p] of segmentPrices.entries()) {
  if (p.count < 100) continue
  const kw = (p.kWAssumption / p.count).toFixed(2)
  const w  = (p.wAssumption  / p.count).toFixed(4)
  console.log(`  ${(seg || '(blank)').padEnd(20)} ${kw.padStart(10)}            ${w.padStart(10)}`)
}

console.log()
console.log('═'.repeat(70))
console.log('SAMPLE ROWS PER SEGMENT')
console.log('═'.repeat(70))
for (const [seg, s] of segmentSizes.entries()) {
  console.log(`\n${seg || '(blank)'}:`)
  for (const sample of s.samples) {
    const dPerW_kw = sample.price > 0 ? (sample.price / (sample.size * 1000)).toFixed(2) : '?'
    const dPerW_w  = sample.price > 0 ? (sample.price / sample.size).toFixed(4) : '?'
    console.log(`  size=${sample.size.toString().padStart(8)}  price=${sample.price.toString().padStart(12)}  state=${sample.state}  date=${sample.date}  $/W(kw)=${dPerW_kw}  $/W(w)=${dPerW_w}`)
  }
}

console.log()
console.log('═'.repeat(70))
console.log('YEAR DISTRIBUTION')
console.log('═'.repeat(70))
const yearSorted = [...yearCounts.entries()].sort((a, b) => b[0] - a[0])
for (const [year, count] of yearSorted.slice(0, 15)) {
  console.log(`  ${year}: ${count.toLocaleString()}`)
}

console.log()
console.log('═'.repeat(70))
console.log('SEGMENT × YEAR (recent only)')
console.log('═'.repeat(70))
const segYearSorted = [...segmentByYear.entries()].sort((a, b) => b[1] - a[1])
for (const [k, count] of segYearSorted.slice(0, 30)) {
  console.log(`  ${k.padEnd(30)} ${count.toLocaleString()}`)
}

console.log()
console.log(`Total rows: ${rowCount.toLocaleString()}`)
