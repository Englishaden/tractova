/**
 * Read-only: probe the NJ + MA distribution-queue sources to capture current
 * URLs + shapes before writing parsers (CLAUDE.md: never guess at data shapes).
 *   NJ — JCP&L direct monthly interconnection-queue .xlsx (FirstEnergy)
 *   MA — DOER 'Utility Interconnection in Massachusetts' page → find xlsx links
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function get(url, opts = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: opts.accept || '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(opts.t || 30000) })
  return r
}

// ── NJ: JCP&L xlsx ──
console.log('═══ NJ — JCP&L monthly interconnection queue (.xlsx) ═══')
const JCPL = 'https://www.firstenergycorp.com/content/dam/feconnect/files/retail/nj/JCPL-Monthly-Interconnection-Queue-Report.xlsx'
try {
  const r = await get(JCPL)
  console.log(`status ${r.status} ct=${r.headers.get('content-type')} len=${r.headers.get('content-length')}`)
  if (r.ok) {
    const buf = Buffer.from(await r.arrayBuffer())
    console.log(`magic=${buf.slice(0, 4).toString('hex')} bytes=${buf.length}`)
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'buffer' })
    console.log(`sheets: ${wb.SheetNames.join(' | ')}`)
    for (const name of wb.SheetNames.slice(0, 3)) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false })
      console.log(`\n— sheet "${name}" rows=${rows.length}`)
      for (let i = 0; i < Math.min(5, rows.length); i++) console.log(`  [${i}] ${JSON.stringify(rows[i]).slice(0, 320)}`)
    }
    // try keyed parse of largest sheet
    let best = wb.SheetNames[0], bestN = 0
    for (const n of wb.SheetNames) { const c = XLSX.utils.sheet_to_json(wb.Sheets[n]).length; if (c > bestN) { best = n; bestN = c } }
    const keyed = XLSX.utils.sheet_to_json(wb.Sheets[best])
    console.log(`\nlargest sheet "${best}" keyed rows=${keyed.length}`)
    if (keyed[0]) console.log(`columns: ${Object.keys(keyed[0]).join(' | ')}`)
    if (keyed[0]) console.log(`sample row: ${JSON.stringify(keyed[0]).slice(0, 500)}`)
    // look for fuel/type + capacity + status fields, count solar-ish
    if (keyed.length) {
      const cols = Object.keys(keyed[0])
      const blob = (o) => JSON.stringify(o).toLowerCase()
      const solar = keyed.filter(r => blob(r).includes('solar') || blob(r).includes('photovolt') || blob(r).includes(' pv'))
      console.log(`rows mentioning solar/pv: ${solar.length} of ${keyed.length}`)
      if (solar[0]) console.log(`sample solar row: ${JSON.stringify(solar[0]).slice(0, 500)}`)
    }
  }
} catch (e) { console.log(`JCP&L ERROR: ${e.message}`) }

// ── MA: DOER page → xlsx links ──
console.log('\n\n═══ MA — DOER Utility Interconnection page ═══')
const DOER = 'https://www.mass.gov/info-details/utility-interconnection-in-massachusetts'
try {
  const r = await get(DOER, { accept: 'text/html' })
  console.log(`status ${r.status} ct=${r.headers.get('content-type')}`)
  const html = await r.text()
  console.log(`html len=${html.length}`)
  // mass.gov serves download links as /doc/... or media URLs; find xlsx/xls/csv
  const links = [...html.matchAll(/href="([^"]+\.(?:xlsx|xls|csv))"/gi)].map(m => m[1])
  const docLinks = [...html.matchAll(/href="(\/doc\/[^"]+)"/gi)].map(m => m[1])
  const mediaLinks = [...html.matchAll(/href="([^"]*\/download[^"]*)"/gi)].map(m => m[1])
  console.log(`direct xlsx/xls/csv links (${links.length}):`, links.slice(0, 15).join('  |  ') || 'none')
  console.log(`/doc/ links (${docLinks.length}):`, docLinks.slice(0, 15).join('  |  ') || 'none')
  console.log(`*/download links (${mediaLinks.length}):`, mediaLinks.slice(0, 10).join('  |  ') || 'none')
  // any mention of interconnection queue file names
  const names = [...html.matchAll(/interconnection[^"<>]{0,40}/gi)].map(m => m[0]).slice(0, 6)
  console.log(`'interconnection' text mentions:`, names.join(' || ') || 'none')
} catch (e) { console.log(`DOER ERROR: ${e.message}`) }

console.log('\nDone.')
