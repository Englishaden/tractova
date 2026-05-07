/**
 * NREL ATB 2024 — extract Solar - PV Dist. Comm CAPEX values for the years
 * we care about (2024 base + 2026 forward). Distributed commercial is the
 * NREL ATB analog closest to community solar.
 */
import { read, utils } from 'xlsx'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'data/2024 NREL ATB Electricity.xlsx')
const wb = read(readFileSync(file), { type: 'buffer' })

function dumpSheetMetric(sheetName, rowMatcher, lookForward = false) {
  console.log('═'.repeat(72))
  console.log(`SHEET: "${sheetName}"`)
  console.log('═'.repeat(72))
  const ws = wb.Sheets[sheetName]
  if (!ws) { console.log('  (sheet not found)'); return }
  const rows = utils.sheet_to_json(ws, { header: 1, defval: null })

  // Find header row containing 'Core Metric Variable' or year columns
  let headerRow = -1
  for (let i = 0; i < Math.min(80, rows.length); i++) {
    const r = rows[i] || []
    if (r.some(c => /^(2022|2023|2024|2025|2026|2030)$/.test(String(c || '').trim()))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) { console.log('  (no year header row found)'); return }

  const headers = rows[headerRow]
  console.log(`Header row [${headerRow}]:`)
  // Show first non-null headers and any year columns
  const yearCols = []
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim()
    if (/^(2022|2023|2024|2025|2026|2030|2035)$/.test(h)) yearCols.push({ idx: c, year: parseInt(h, 10) })
  }
  console.log(`  year columns: ${yearCols.map(y => `${y.year}@${y.idx}`).join(', ')}`)

  // Find a column that holds the metric label (CAPEX/CapEx)
  // Scan rows looking for "CAPEX" hits
  console.log('\n  CAPEX rows (first 20):')
  let count = 0
  for (let i = headerRow + 1; i < rows.length && count < 20; i++) {
    const r = rows[i] || []
    const labelText = r.map(c => String(c || '')).join(' ')
    if (!/CAPEX|Capital Expenditure|Capital Cost/i.test(labelText)) continue
    // Identify which columns hold the scenario label and tech class
    // Print first 14 cols + year values
    const cells = r.slice(0, 14).map(c => c == null ? '∅' : String(c).slice(0, 22))
    const yearVals = yearCols.map(y => `${y.year}=${r[y.idx] == null ? '∅' : Number(r[y.idx]).toFixed(0)}`)
    console.log(`    [${i}] ${cells.join(' | ')}`)
    console.log(`         ${yearVals.join('  ')}`)
    count++
  }
  console.log()
}

dumpSheetMetric('Solar - PV Dist. Comm')
dumpSheetMetric('Solar - Utility PV')
dumpSheetMetric('Commercial Battery Storage')
dumpSheetMetric('Utility-Scale Battery Storage')
