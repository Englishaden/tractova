/**
 * Probe: simulate the Search.jsx data fetchers for state=NY, tech=BESS to
 * identify which row has malformed data that throws.
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
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing env'); process.exit(1) }
const supabase = createClient(url, key)

const STATE = 'NY'

console.log(`\n── revenue_rates row for ${STATE} ──`)
const { data: rates, error: rErr } = await supabase
  .from('revenue_rates').select('*').eq('state_id', STATE).maybeSingle()
if (rErr) console.log('  ERROR:', rErr.message)
else if (!rates) console.log('  NO ROW')
else {
  const bessFields = Object.entries(rates).filter(([k]) => k.startsWith('bess_'))
  console.log(`  ${bessFields.length} bess_ fields:`)
  bessFields.forEach(([k, v]) => console.log(`    ${k} = ${JSON.stringify(v)}`))
}

console.log(`\n── state_programs row for ${STATE} ──`)
const { data: sp } = await supabase
  .from('state_programs').select('id, cs_program, cs_status, ix_difficulty, capacity_mw, lmi_required, lmi_percent').eq('id', STATE).maybeSingle()
console.log(' ', sp || 'NO ROW')

console.log(`\n── ix_queue_data rows for ${STATE} ──`)
const { data: ix, error: ixErr } = await supabase
  .from('ix_queue_data').select('*').eq('state_id', STATE)
if (ixErr) console.log('  ERROR:', ixErr.message)
else if (!ix?.length) console.log('  NO ROWS')
else { console.log(`  ${ix.length} rows. First row keys:`, Object.keys(ix[0])); console.log('  First row:', JSON.stringify(ix[0], null, 2)) }

console.log(`\n── substations sample for ${STATE} ──`)
const { data: subs, error: sErr } = await supabase
  .from('substations').select('*').eq('state_id', STATE).limit(2)
if (sErr) console.log('  ERROR:', sErr.message)
else { console.log(`  rows=${subs?.length || 0}`); if (subs?.[0]) console.log('  First row keys:', Object.keys(subs[0])) }

console.log(`\n── county_intelligence for ${STATE} (top 3) ──`)
const { data: counties, error: cErr } = await supabase
  .from('county_intelligence').select('*').eq('state_id', STATE).limit(3)
if (cErr) console.log('  ERROR:', cErr.message)
else { console.log(`  rows=${counties?.length || 0}`); if (counties?.[0]) console.log('  First row keys:', Object.keys(counties[0])) }

console.log()
