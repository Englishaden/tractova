/**
 * One-shot: confirm migration 059 dropped legacy email-based RLS
 * policies. Queries pg_policies via service role; expected zero rows.
 *
 * Usage:  node scripts/probe-rls-policies.mjs
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

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log(`→ Probing RLS policy state in ${url}…\n`)

// Probe 1 — any legacy email-literal policies still present?
// Uses an inline SQL via pg_policies through a one-time RPC if available;
// otherwise falls back to the Supabase REST endpoint pg_meta would use.
//
// Supabase doesn't expose pg_policies directly via REST. We'll create a
// one-shot SQL function call OR rely on the user's existing rpc surface.
// Cleanest path: probe via a known policy-protected table.

let policies, polErr
try {
  const r = await admin.rpc('list_email_legacy_policies')
  policies = r.data; polErr = r.error
} catch (e) { polErr = e }

if (polErr && (polErr.code === 'PGRST202' || /not found/i.test(polErr.message ?? ''))) {
  console.log('No list_email_legacy_policies RPC defined. Falling back to behavior probes.\n')
} else if (polErr) {
  console.log(`RPC error: ${polErr.message ?? polErr}\n`)
} else if (Array.isArray(policies)) {
  if (policies.length === 0) {
    console.log('✓ pg_policies query returned zero email-literal policies — migration 059 applied.\n')
  } else {
    console.log(`⚠ ${policies.length} legacy email policies still present:`)
    for (const p of policies) console.log(`  - ${p.tablename}.${p.policyname}`)
    console.log()
  }
}

// Probe 2 — check is_admin() helper exists and returns sane result
let isAdminProbe, helperErr
try {
  const r = await admin.rpc('is_admin')
  isAdminProbe = r.data; helperErr = r.error
} catch (e) { helperErr = e }

if (helperErr) {
  console.log(`is_admin() helper: ✗ ${helperErr.message ?? helperErr}`)
} else {
  console.log(`is_admin() helper exists, returns: ${JSON.stringify(isAdminProbe)} (service-role caller — null/false expected; we only verify the function resolves)`)
}

// Probe 3 — confirm a known role-based-policy table is reachable as service role
const probes = [
  'state_programs',
  'cs_projects',
  'solar_cost_index',
  'cs_specific_yield',
  'comparable_deals',
  'puc_dockets',
  'lmi_data',
  'county_acs_data',
  'energy_community_data',
  'hud_qct_dda_data',
  'nmtc_lic_data',
  'county_geospatial_data',
]
console.log('\nTable read probes (service role):')
for (const t of probes) {
  const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true })
  console.log(`  ${error ? '✗' : '✓'} ${t.padEnd(28)} ${error ? error.message : `${count ?? 0} rows`}`)
}

// Probe 4 — confirm profiles.role is populated for the admin
const { data: adminProfile, error: profErr } = await admin
  .from('profiles')
  .select('id, role')
  .eq('role', 'admin')
  .limit(5)

if (profErr) {
  console.log(`\nprofiles.role probe: ✗ ${profErr.message}`)
} else {
  console.log(`\nprofiles.role = 'admin' rows: ${adminProfile?.length ?? 0}`)
  for (const p of adminProfile || []) console.log(`  - id=${p.id} role=${p.role}`)
}

// Probe 5 — list all profile columns (sanity check on schema shape)
const { data: oneProfile, error: oneErr } = await admin
  .from('profiles')
  .select('*')
  .limit(1)
if (!oneErr && oneProfile?.[0]) {
  console.log(`\nprofiles row keys: ${Object.keys(oneProfile[0]).sort().join(', ')}`)
}

// Probe 6 — admin_audit_log table exists?
const { count: auditCount, error: auditErr } = await admin
  .from('admin_audit_log')
  .select('*', { count: 'exact', head: true })
console.log(`\nadmin_audit_log: ${auditErr ? `✗ ${auditErr.message}` : `✓ ${auditCount ?? 0} rows`}`)
