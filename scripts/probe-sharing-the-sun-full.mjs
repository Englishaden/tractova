/**
 * Full column listing + sample data for Sharing the Sun XLSX. One-shot probe
 * to guide the cs_projects schema design.
 */
import { read, utils } from 'xlsx'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'data/Sharing the Sun Community Solar Project Data (Jan 2026).xlsx')
const wb = read(readFileSync(file), { type: 'buffer' })
const ws = wb.Sheets['Project List']
const rows = utils.sheet_to_json(ws, { header: 1, defval: null })
const headers = rows[0]
console.log(`All ${headers.length} columns:`)
for (let c = 0; c < headers.length; c++) {
  const samples = rows.slice(1, 4).map(r => r[c]).map(v => v == null ? '∅' : String(v).slice(0, 40))
  console.log(`  col ${String(c).padStart(2)}: "${headers[c]}"`)
  console.log(`         samples: [${samples.join(' | ')}]`)
}

// Aggregated Data Entry breakdown
const aggCol = headers.findIndex(h => /Aggregated Data/i.test(h || ''))
const data = rows.slice(1).filter(r => r.some(c => c != null))
const aggregateRows = data.filter(r => String(r[aggCol] || '').toLowerCase() === 'yes').length
const projectRows = data.filter(r => String(r[aggCol] || '').toLowerCase() === 'no').length
const otherRows = data.length - aggregateRows - projectRows
console.log(`\nRow type breakdown:`)
console.log(`  individual projects: ${projectRows}`)
console.log(`  aggregated entries:  ${aggregateRows}`)
console.log(`  other / null:        ${otherRows}`)

// State distribution sanity
const stateCol = headers.findIndex(h => /^State$/i.test(h || ''))
const yearCol = headers.findIndex(h => /Year of Interconnection/i.test(h || ''))
const sizeCol = headers.findIndex(h => /System Size \(MW-AC\)/i.test(h || ''))
const byState = new Map()
for (const r of data) {
  if (String(r[aggCol] || '').toLowerCase() === 'yes') continue
  const st = r[stateCol]
  if (!st) continue
  const sz = parseFloat(r[sizeCol])
  if (!byState.has(st)) byState.set(st, { count: 0, mw: 0 })
  byState.get(st).count++
  if (!isNaN(sz)) byState.get(st).mw += sz
}
const sorted = [...byState.entries()].sort((a, b) => b[1].count - a[1].count)
console.log(`\nTop 15 states by project count (individual projects only):`)
for (const [st, v] of sorted.slice(0, 15)) {
  console.log(`  ${st}: ${v.count.toString().padStart(4)} projects, ${v.mw.toFixed(1).padStart(7)} MW operational`)
}

// Year range
const years = data.filter(r => String(r[aggCol] || '').toLowerCase() !== 'yes').map(r => parseInt(r[yearCol], 10)).filter(y => !isNaN(y))
console.log(`\nVintage range: ${Math.min(...years)} – ${Math.max(...years)}`)
