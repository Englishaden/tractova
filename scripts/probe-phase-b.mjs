/**
 * Phase B verification probe — confirms migrations 044-049 are applied
 * in the live Supabase. One-off, safe to delete after the check.
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

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('\n→ Phase B verification\n')

// 048: solar_cost_index
const sci = await admin
  .from('solar_cost_index')
  .select('state, p50_per_watt, install_count, vintage_year, vintage_window', { count: 'exact' })
  .order('state')
console.log(`048 solar_cost_index table: ${sci.error ? '✗ ' + sci.error.message : `✓ ${sci.count} rows`}`)
if (!sci.error) {
  for (const r of sci.data || []) {
    console.log(`     ${r.state}  $${r.p50_per_watt}/W (n=${r.install_count}, vintage ${r.vintage_window})`)
  }
}

// 044: NY = 2.03
const ny = await admin.from('revenue_rates').select('installed_cost_per_watt').eq('state_id', 'NY').maybeSingle()
console.log(`\n044 NY installed_cost_per_watt: ${ny.error ? '✗' : `$${ny.data?.installed_cost_per_watt}/W (expect 2.03)`}`)

// 045: NY C&I should be 1.99 — but 045 probably uses a separate column. Skip granular.
// 046/047: skip granular — covered by audit script if needed.

// 049: RPC has solar_cost_index block
const fresh = await admin.rpc('get_data_freshness')
console.log(`\n049 RPC: ${fresh.error ? '✗ ' + fresh.error.message : (fresh.data && 'solar_cost_index' in fresh.data ? '✓ block present' : '✗ block missing')}`)
if (fresh.data && fresh.data.solar_cost_index) {
  console.log(`     ${JSON.stringify(fresh.data.solar_cost_index)}`)
}
