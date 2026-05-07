/**
 * One-shot probe of the NREL "Sharing the Sun: Community Solar Project Data
 * (Jan 2026)" XLSX. Reports sheets, headers, sample rows, distinct field
 * values for the columns we care about (state, capacity, vintage, cost).
 *
 * Run: node scripts/probe-sharing-the-sun.mjs
 */
import { read, utils } from 'xlsx'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'public/Sharing the Sun Community Solar Project Data (Jan 2026).xlsx')
const wb = read(readFileSync(file), { type: 'buffer' })
const XLSX = { utils }

console.log(`Workbook loaded: ${wb.SheetNames.length} sheet(s)`)
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  console.log(`  - "${name}" (${range.e.r + 1} rows × ${range.e.c + 1} cols)`)
}
console.log()

for (const name of wb.SheetNames) {
  console.log('═'.repeat(72))
  console.log(`SHEET: "${name}"`)
  console.log('═'.repeat(72))
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  if (rows.length === 0) { console.log('  (empty)'); continue }

  // Show first 6 rows raw to spot whether row 0 is headers
  console.log(`First 6 rows raw:`)
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const r = rows[i]
    console.log(`  [${i}] ${r.slice(0, 10).map(c => c == null ? 'null' : String(c).slice(0, 30)).join(' | ')}`)
  }
  console.log()

  // Try to identify the header row — usually first row with mostly strings
  let headerIdx = 0
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const r = rows[i]
    const stringCount = r.filter(c => typeof c === 'string' && c.length > 0).length
    const numericCount = r.filter(c => typeof c === 'number').length
    if (stringCount > numericCount * 2 && stringCount > 5) {
      headerIdx = i
      break
    }
  }
  console.log(`Detected header at row ${headerIdx}:`)
  const headers = rows[headerIdx] || []
  for (let c = 0; c < headers.length; c++) {
    if (headers[c] == null) continue
    console.log(`  col ${c}: "${headers[c]}"`)
  }
  console.log()

  // Look at field counts (non-null / unique) for first 200 data rows
  const data = rows.slice(headerIdx + 1).filter(r => r.some(c => c != null))
  console.log(`Data rows: ${data.length}`)
  console.log()

  // Pick out columns matching cost / size / state / year naming
  const interesting = []
  for (let c = 0; c < headers.length; c++) {
    const h = (headers[c] || '').toString().toLowerCase()
    if (h.match(/cost|price|capex|\$|size|capacity|kw|mw|watt|state|year|date|vintage|location/)) {
      interesting.push({ col: c, name: headers[c] })
    }
  }
  console.log('Interesting columns + sample values:')
  for (const { col, name } of interesting) {
    const vals = data.slice(0, 5).map(r => r[col])
    console.log(`  "${name}" (col ${col}): [${vals.map(v => v == null ? '∅' : String(v).slice(0, 20)).join(', ')}]`)
  }
  console.log()
}
