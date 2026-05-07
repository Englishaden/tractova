/**
 * Pre-option-2 sanity probe: confirm migrations 050-054 applied + which
 * seeds are populated. Tells us whether to dive into option 2 (cs_status
 * audit) or sweep up earlier prerequisites first.
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

console.log('\n→ Pre-option-2 state probe\n')

// Migration 050 — cs_projects
const csp = await admin.from('cs_projects').select('project_id, state', { count: 'exact', head: true })
const cspExists = !csp.error
console.log(`050 cs_projects: ${cspExists ? `✓ ${csp.count} rows` : `✗ ${csp.error?.message}`}`)

// Migration 052 — solar_cost_index confidence_tier
const sci = await admin.from('solar_cost_index').select('state, confidence_tier, install_count', { count: 'exact' }).order('state')
console.log(`052 solar_cost_index w/ confidence_tier: ${sci.error ? '✗ ' + sci.error.message : `✓ ${sci.count} rows`}`)
if (!sci.error && sci.data) {
  const byTier = { strong: 0, modest: 0, thin: 0 }
  for (const r of sci.data) byTier[r.confidence_tier] = (byTier[r.confidence_tier] || 0) + 1
  console.log(`     tiers: strong=${byTier.strong}, modest=${byTier.modest}, thin=${byTier.thin}`)
  console.log(`     states: ${sci.data.map(r => `${r.state}(${r.confidence_tier},n=${r.install_count})`).join(', ')}`)
}

// Migration 053 — cs_specific_yield
const csy = await admin.from('cs_specific_yield').select('project_id, state, source', { count: 'exact' })
const csyExists = !csy.error
console.log(`053 cs_specific_yield: ${csyExists ? `✓ ${csy.count} rows` : `✗ ${csy.error?.message}`}`)
if (csyExists && csy.data && csy.count > 0) {
  const bySource = {}
  for (const r of csy.data) bySource[r.source] = (bySource[r.source] || 0) + 1
  console.log(`     by source: ${JSON.stringify(bySource)}`)
}

// state_programs accuracy preview — what option 2 will work against
const sp = await admin.from('state_programs').select('id, name, cs_status').eq('cs_status', 'active').order('id')
console.log(`\nstate_programs cs_status='active': ${sp.error ? '✗' : `${sp.count ?? sp.data.length} states`}`)
if (sp.data) console.log(`     ${sp.data.map(s => s.id).join(', ')}`)

// state_programs cs_status='limited'
const spLim = await admin.from('state_programs').select('id, name, cs_status').eq('cs_status', 'limited').order('id')
console.log(`state_programs cs_status='limited': ${spLim.error ? '✗' : `${spLim.count ?? spLim.data.length} states`}`)
if (spLim.data) console.log(`     ${spLim.data.map(s => s.id).join(', ')}`)
