/**
 * SPIKE (read-only, no DB): inspect the real monetization-structure distribution
 * inside NJ's EDC interconnection-queue .xlsx files.
 *
 * Why: the capture-all-DG scope decision says we tag every distribution-DG row by
 * monetization structure (metering_type) instead of filtering to Community Solar.
 * Before trusting any source-string -> canonical-tag mapping, we need to SEE the
 * actual distinct values the files carry (no fabricating the vocabulary). This
 * script fetches each EDC file and prints, per EDC:
 *   - the detected header row + every column header
 *   - the distinct values of the metering/interconnection-type column (count + MW)
 *   - the distinct values of any separate "Community Solar" Yes/No column
 *   - distinct status values (so we know what "withdrawn" looks like)
 *
 * Usage:  node scripts/spike-nj-structures.mjs
 * Bounded: 3 HTTP GETs, no writes, no auth needed.
 */

const EDCS = [
  { utility: 'JCP&L', url: 'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx' },
  { utility: 'PSE&G', url: 'https://nj.pseg.com/-/media/pseg/public-site/documents/pseg-queue-inventory.ashx' },
  { utility: 'Rockland Electric (RECO)', url: 'https://cdnc-dcxprod2-sitecore.azureedge.net/-/media/files/oru/documents/saveenergyandmoney/using-private-generation-energy-sources/applying-for-private-generation-interconnection-in-new-jersey/interconnection-queue.xlsx?rev=5d8a63aa5321456f86bb8159eb75aead' },
]

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

// Broad header detection: the row carrying a capacity column AND some kind of
// metering/interconnection-type or community-solar indicator.
function detectHeaderRow(aoa) {
  for (let i = 0; i < Math.min(12, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c).toLowerCase())
    const hasCap = cells.some((c) => /capacity/.test(c))
    const hasType = cells.some((c) => /metering|interconnection type|community solar/.test(c))
    if (hasCap && hasType) return i
  }
  return -1
}

function tally(rows, idx, capIdx) {
  const m = new Map()
  for (const r of rows) {
    const key = String(r[idx] ?? '').trim() || '(blank)'
    if (!m.has(key)) m.set(key, { n: 0, mw: 0 })
    const a = m.get(key)
    a.n++
    if (capIdx >= 0) a.mw += num(r[capIdx]) / 1000 // kW -> MW
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
}

async function inspect(edc) {
  console.log(`\n${'═'.repeat(72)}\n${edc.utility}\n${edc.url}\n${'─'.repeat(72)}`)
  let buf
  try {
    const res = await fetch(edc.url, {
      headers: { 'User-Agent': 'Tractova data pipeline (+https://tractova.com)' },
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) { console.log(`  FETCH FAILED: ${res.status}`); return }
    buf = Buffer.from(await res.arrayBuffer())
  } catch (err) { console.log(`  FETCH ERROR: ${err.message}`); return }

  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  console.log(`  sheets: [${wb.SheetNames.join(', ')}]`)

  for (const sheetName of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false })
    const hdrRow = detectHeaderRow(aoa)
    if (hdrRow < 0) { console.log(`  sheet "${sheetName}": no header row matched (rows=${aoa.length})`); continue }
    const hdr = aoa[hdrRow]
    console.log(`\n  sheet "${sheetName}" — header @ row ${hdrRow}, ${aoa.length - hdrRow - 1} data rows`)
    console.log(`  columns: ${hdr.map((h, i) => `[${i}] ${String(h).trim()}`).join(' | ')}`)

    const find = (re) => hdr.findIndex((h) => re.test(String(h)))
    const capIdx = find(/system capacity|capacity \(kw|nameplate/i)
    const meterIdx = find(/metering.*interconnection type|interconnection type|metering type/i)
    const csFlagIdx = find(/community solar/i)
    const statusIdx = find(/status/i)

    const rows = aoa.slice(hdrRow + 1).filter((r) => r && r.length)
    const totalMW = capIdx >= 0 ? rows.reduce((a, r) => a + num(r[capIdx]) / 1000, 0) : 0
    console.log(`  totals: ${rows.length} rows, ~${Math.round(totalMW)} MW (capIdx=${capIdx}, meterIdx=${meterIdx}, csFlagIdx=${csFlagIdx}, statusIdx=${statusIdx})`)

    if (meterIdx >= 0) {
      console.log(`  >> metering/interconnection-type values:`)
      for (const [v, a] of tally(rows, meterIdx, capIdx)) console.log(`       ${String(a.n).padStart(5)}  ${String(Math.round(a.mw)).padStart(5)}MW  ${v}`)
    }
    if (csFlagIdx >= 0 && csFlagIdx !== meterIdx) {
      console.log(`  >> community-solar flag values:`)
      for (const [v, a] of tally(rows, csFlagIdx, capIdx)) console.log(`       ${String(a.n).padStart(5)}  ${String(Math.round(a.mw)).padStart(5)}MW  ${v}`)
    }
    if (statusIdx >= 0) {
      console.log(`  >> status values:`)
      for (const [v, a] of tally(rows, statusIdx, capIdx)) console.log(`       ${String(a.n).padStart(5)}  ${String(Math.round(a.mw)).padStart(5)}MW  ${v}`)
    }
    break // first matching sheet is the queue; stop
  }
}

for (const edc of EDCS) await inspect(edc)
console.log(`\n${'═'.repeat(72)}\nspike done — read-only, no writes.`)
