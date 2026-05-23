/**
 * Read-only: verify the NYSERDA "Solar Electric Programs" Socrata feed shape +
 * volumes for distribution-level community-DG interconnection. Confirms the
 * GREEN source has what we need before writing a scraper (CLAUDE.md: no guessing).
 *   dataset: data.ny.gov/resource/3x8r-34rs
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const BASE = 'https://data.ny.gov/resource/3x8r-34rs.json'

async function soda(qs) {
  const url = `${BASE}?${qs}`
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`${r.status} on ${url}`)
  return r.json()
}

console.log('═══ NYSERDA Solar Electric Programs (3x8r-34rs) ═══\n')

// 1. sample row → real column names
const sample = await soda('$limit=1')
console.log('columns:', Object.keys(sample[0]).join(', '))
console.log('\nsample row:\n' + JSON.stringify(sample[0], null, 2))

// 2. total rows
const totalRes = await soda('$select=count(1)')
console.log('\ntotal rows in dataset:', totalRes[0]?.count_1 ?? JSON.stringify(totalRes[0]))

// 3. distinct community_distributed_generation values
try {
  const cdg = await soda('$select=community_distributed_generation,count(1)&$group=community_distributed_generation')
  console.log('\ncommunity_distributed_generation breakdown:')
  for (const r of cdg) console.log(`  ${JSON.stringify(r)}`)
} catch (e) { console.log('CDG group err:', e.message) }

// 4. distinct project_status
try {
  const st = await soda('$select=project_status,count(1)&$group=project_status&$order=count_1 desc')
  console.log('\nproject_status breakdown:')
  for (const r of st.slice(0, 20)) console.log(`  ${JSON.stringify(r)}`)
} catch (e) { console.log('status group err:', e.message) }

// 5. CDG=Yes by county (top 25) + by utility
try {
  const byCounty = await soda("$select=county,count(1),sum(totalnameplatekwdc)&$where=community_distributed_generation='Yes'&$group=county&$order=count_1 desc&$limit=25")
  console.log('\nCDG=Yes by county (top 25): [county, count, sum_kwdc]')
  for (const r of byCounty) console.log(`  ${r.county}: n=${r.count_1} kWdc=${Math.round(Number(r.sum_totalnameplatekwdc)||0)}`)
} catch (e) { console.log('county group err:', e.message) }

try {
  const byUtil = await soda("$select=electric_utility,count(1)&$where=community_distributed_generation='Yes'&$group=electric_utility&$order=count_1 desc&$limit=15")
  console.log('\nCDG=Yes by electric_utility:')
  for (const r of byUtil) console.log(`  ${r.electric_utility}: n=${r.count_1}`)
} catch (e) { console.log('util group err:', e.message) }

// 6. CDG=Yes by status (the actual "in queue / pending" signal)
try {
  const cdgStatus = await soda("$select=project_status,count(1)&$where=community_distributed_generation='Yes'&$group=project_status&$order=count_1 desc")
  console.log('\nCDG=Yes by project_status (the queue-vs-installed signal):')
  for (const r of cdgStatus) console.log(`  ${r.project_status}: n=${r.count_1}`)
} catch (e) { console.log('cdg status group err:', e.message) }

console.log('\nDone.')
