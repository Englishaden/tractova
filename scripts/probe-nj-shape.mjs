/**
 * Read-only: NJ JCP&L queue — clean keyed parse (header at row index 1), find
 * the capacity column + UNIT, distribution by System Type + capacity bucket, so
 * we can isolate community-scale (not residential rooftop) before building.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const JCPL = 'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx'

const r = await fetch(JCPL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
const buf = Buffer.from(await r.arrayBuffer())
const XLSX = await import('xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
const sheet = wb.Sheets['JCPL Monthly Queue']
const rows = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: '' })  // header = row index 1
console.log(`rows=${rows.length}`)
const cols = Object.keys(rows[0])
console.log(`columns (${cols.length}):`)
cols.forEach((c, i) => console.log(`  [${i}] ${JSON.stringify(c.replace(/\r\n/g, ' '))}`))

// Identify likely columns
const findCol = (re) => cols.find(c => re.test(c.replace(/\r\n/g, ' ')))
const edcCol = findCol(/Distribution.*Company|Company Name/i)
const countyCol = findCol(/County/i)
const typeCol = findCol(/System Type/i)
const statusCol = cols[cols.length - 1] // status looked last
console.log(`\nedcCol=${JSON.stringify(edcCol)} countyCol=${JSON.stringify(countyCol)} typeCol=${JSON.stringify(typeCol)}`)

// The capacity is the numeric col right after System Type. Find numeric columns.
console.log(`\nFirst data row values:`)
cols.forEach((c, i) => console.log(`  [${i}] ${c.replace(/\r\n/g, ' ').slice(0, 30).padEnd(30)} = ${JSON.stringify(rows[0][c])}`))

// Capacity distribution: try the column after typeCol
const typeIdx = cols.indexOf(typeCol)
const capCol = cols[typeIdx + 1]
console.log(`\nAssuming capacity col = [${typeIdx + 1}] ${JSON.stringify(capCol)}`)
const caps = rows.map(r => Number(r[capCol])).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
const pct = (p) => caps[Math.floor(caps.length * p / 100)]
console.log(`capacity n=${caps.length} min=${caps[0]} p10=${pct(10)} p50=${pct(50)} p90=${pct(90)} p99=${pct(99)} max=${caps[caps.length - 1]}`)
console.log(`(if min ~2-10 and p50 ~5-8 → unit is kW residential-dominated; if values like 2.64/3.8 are MW unlikely given max)`)

// buckets to read the unit
const buckets = { '<10': 0, '10-100': 0, '100-1000': 0, '1000-5000': 0, '5000+': 0 }
for (const c of caps) {
  if (c < 10) buckets['<10']++
  else if (c < 100) buckets['10-100']++
  else if (c < 1000) buckets['100-1000']++
  else if (c < 5000) buckets['1000-5000']++
  else buckets['5000+']++
}
console.log(`capacity buckets: ${JSON.stringify(buckets)}`)

// System Type distribution
const typeTally = {}
for (const r of rows) { const t = String(r[typeCol] || '').trim(); typeTally[t] = (typeTally[t] || 0) + 1 }
console.log(`\nSystem Type values: ${JSON.stringify(Object.fromEntries(Object.entries(typeTally).slice(0, 12)))}`)

// EDC distribution (should be all JCP&L in this file)
const edcTally = {}
for (const r of rows) { const e = String(r[edcCol] || '').trim(); edcTally[e] = (edcTally[e] || 0) + 1 }
console.log(`EDC values: ${JSON.stringify(edcTally)}`)

// Program/purchase-type col (Net Metering vs PURPA vs ...) — helps isolate CS
const progCol = cols[typeIdx + 2]
const progTally = {}
for (const r of rows) { const p = String(r[progCol] || '').trim(); progTally[p] = (progTally[p] || 0) + 1 }
console.log(`Program col [${typeIdx + 2}] ${JSON.stringify(progCol)} values: ${JSON.stringify(progTally)}`)
