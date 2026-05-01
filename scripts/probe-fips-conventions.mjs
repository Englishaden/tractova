/**
 * Pre-work probe for Path B (wetlands + farmland data layers).
 *
 * Verifies county_fips conventions across the 4 county-keyed tables we'll
 * need to join against (energy_community_data, nmtc_lic_data, hud_qct_dda_data,
 * county_acs_data) and surfaces the county_intelligence shape (which uses
 * state_id + county_slug, NOT FIPS — so we'll need a slug→FIPS bridge in
 * lens-insight when we wire the new table in).
 *
 * Usage:  node scripts/probe-fips-conventions.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (process.env[k] === undefined) process.env[k] = v
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log(`→ Probing FIPS conventions in ${url}\n`)

const tables = ['energy_community_data', 'nmtc_lic_data', 'hud_qct_dda_data', 'county_acs_data']

for (const t of tables) {
  const { count, error: countErr } = await admin.from(t).select('county_fips', { count: 'exact', head: true })
  if (countErr) {
    console.log(`✗ ${t}: ${countErr.message}`)
    continue
  }

  // Sample 5 rows for FIPS shape inspection
  const { data, error } = await admin.from(t).select('*').limit(5)
  if (error) {
    console.log(`✗ ${t} sample: ${error.message}`)
    continue
  }

  const fipsValues = data.map((r) => r.county_fips).filter(Boolean)
  const lengths = [...new Set(fipsValues.map((f) => String(f).length))].sort()
  const allDigits = fipsValues.every((f) => /^\d+$/.test(String(f)))
  const sampleStateCodes = [...new Set(data.map((r) => r.state).filter(Boolean))]

  console.log(`✓ ${t}`)
  console.log(`    rows: ${count}`)
  console.log(`    fips lengths: ${lengths.join(',')}  all-digits: ${allDigits}`)
  console.log(`    sample fips: ${fipsValues.slice(0, 3).join(', ')}`)
  console.log(`    sample states: ${sampleStateCodes.join(', ')}`)

  // Check for low-state-code FIPS (01-09) to confirm leading zeros are preserved
  const { data: lowState } = await admin
    .from(t)
    .select('county_fips,state')
    .like('county_fips', '0%')
    .limit(3)
  if (lowState && lowState.length) {
    console.log(`    leading-zero check: ${lowState.map((r) => `${r.county_fips}(${r.state})`).join(', ')}`)
  } else {
    console.log(`    leading-zero check: NONE FOUND — possible bug if state has counties in 01-09 range`)
  }
  console.log('')
}

// county_intelligence — different shape, uses slug not FIPS
console.log(`→ county_intelligence (slug-based, NOT FIPS):\n`)
const { count: ciCount, error: ciCountErr } = await admin
  .from('county_intelligence')
  .select('id', { count: 'exact', head: true })
if (ciCountErr) {
  console.log(`✗ county_intelligence: ${ciCountErr.message}`)
} else {
  const { data: ciSample } = await admin
    .from('county_intelligence')
    .select('state_id, county_slug, available_land, wetland_warning, ease_score')
    .limit(8)
  console.log(`    rows: ${ciCount}`)
  console.log(`    sample:`)
  for (const r of ciSample || []) {
    console.log(`      ${r.state_id}/${r.county_slug.padEnd(15)} land=${r.available_land} wetland=${r.wetland_warning} ease=${r.ease_score}`)
  }

  // Count default vs non-default rows
  const { count: defaultCount } = await admin
    .from('county_intelligence')
    .select('id', { count: 'exact', head: true })
    .eq('county_slug', 'default')
  const { count: namedCount } = await admin
    .from('county_intelligence')
    .select('id', { count: 'exact', head: true })
    .neq('county_slug', 'default')
  console.log(`\n    state-default rows: ${defaultCount}   named-county rows: ${namedCount}`)

  // Distinct states with default rows
  const { data: defStates } = await admin
    .from('county_intelligence')
    .select('state_id')
    .eq('county_slug', 'default')
  const distinctDefStates = [...new Set((defStates || []).map((r) => r.state_id))].sort()
  console.log(`    states with a 'default' row (${distinctDefStates.length}): ${distinctDefStates.join(', ')}`)
}
