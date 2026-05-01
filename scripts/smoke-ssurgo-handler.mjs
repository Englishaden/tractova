/**
 * Local smoke test for the per-state SSURGO batching logic.
 *
 * Replicates the production refreshGeospatialFarmland() loop (without
 * touching the DB) to verify ALL 51 state codes return clean data and
 * the wall-clock fits inside the 300s function budget.
 *
 * Usage:  node scripts/smoke-ssurgo-handler.mjs
 */

const FIPS_TO_USPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

const SSURGO_PRIME_FARMLAND_CLASSES = [
  'All areas are prime farmland',
  'Prime farmland if drained',
  'Prime farmland if irrigated',
  'Prime farmland if drained and either protected from flooding or not frequently flooded during the growing season',
  'Prime farmland if irrigated and drained',
  'Prime farmland if subsoiled, completely removing the root inhibiting soil layer',
  'Prime farmland if protected from flooding or not frequently flooded during the growing season',
]
const primeIn = SSURGO_PRIME_FARMLAND_CLASSES
  .map(s => `'${s.replace(/'/g, "''")}'`)
  .join(', ')

async function ssurgoQuery(sql) {
  const body = new URLSearchParams({ QUERY: sql, FORMAT: 'JSON+COLUMNNAME' })
  const r = await fetch('https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'tractova-smoke/1.0',
    },
    body: body.toString(),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) }
  catch { return { ok: false, status: r.status, raw: text.slice(0, 300) } }
  return { ok: r.ok && Array.isArray(json.Table), status: r.status, json, raw: text.slice(0, 200) }
}

const usps = Object.fromEntries(Object.entries(FIPS_TO_USPS).map(([f, u]) => [u, f]))
const stateCodes = Object.keys(usps)

console.log(`→ Smoke test: ${stateCodes.length} states, 4-way concurrency, target <60s\n`)

const t0 = Date.now()
const allRows = []
const stateErrors = []

const PARALLEL = 4
for (let i = 0; i < stateCodes.length; i += PARALLEL) {
  const batch = stateCodes.slice(i, i + PARALLEL)
  const settled = await Promise.allSettled(batch.map(async (st) => {
    const sql = `
      SELECT lg.areasymbol, lg.areaname,
        SUM(CASE WHEN mu.farmlndcl IN (${primeIn}) THEN mu.muacres ELSE 0 END) AS prime_acres,
        SUM(mu.muacres) AS total_acres
      FROM legend AS lg INNER JOIN mapunit AS mu ON mu.lkey = lg.lkey
      WHERE lg.areatypename = 'Non-MLRA Soil Survey Area'
        AND lg.areasymbol LIKE '${st}%'
      GROUP BY lg.areasymbol, lg.areaname
    `.trim().replace(/\s+/g, ' ')
    const r0 = Date.now()
    const res = await ssurgoQuery(sql)
    if (!res.ok) throw new Error(`${st} status=${res.status} body=${res.raw}`)
    return { st, rows: res.json.Table.slice(1), dt: Date.now() - r0 }
  }))
  for (let j = 0; j < batch.length; j++) {
    const r = settled[j]
    if (r.status === 'fulfilled') {
      const { st, rows, dt } = r.value
      allRows.push(...rows)
      process.stdout.write(`${st}:${rows.length}(${dt}ms) `)
    } else {
      stateErrors.push(`${batch[j]}: ${r.reason?.message || 'unknown'}`)
      process.stdout.write(`${batch[j]}:✗ `)
    }
  }
}

const elapsed = Date.now() - t0
console.log(`\n\n━━━ Result ━━━`)
console.log(`  total survey areas returned: ${allRows.length}`)
console.log(`  wall-clock:                  ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`)
console.log(`  state errors:                ${stateErrors.length}`)
if (stateErrors.length) for (const e of stateErrors) console.log(`    ${e}`)

// Sanity check a sample row
const ilSample = allRows.find(r => r[0]?.startsWith('IL0'))
if (ilSample) {
  const [sym, name, prime, total] = ilSample
  const pct = total > 0 ? (Number(prime) / Number(total)) * 100 : 0
  console.log(`\n  sanity (IL sample): ${sym} ${name}  primePct=${pct.toFixed(1)}%`)
}

console.log(`\n  → ${elapsed < 60000 ? 'OK' : 'TOO SLOW'} for 300s function budget (~${Math.round(elapsed / 1000)}s)`)
