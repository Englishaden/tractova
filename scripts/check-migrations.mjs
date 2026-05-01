/**
 * One-shot: confirm which of the 034-037 pending migrations are actually
 * applied in the live Supabase DB. Reads via the service role key.
 *
 * Usage:  node scripts/check-migrations.mjs
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

console.log(`→ Checking pending migrations in ${url}…\n`)

// ── Migration 034: hud_qct_dda_data ──
const hud = await admin.from('hud_qct_dda_data').select('county_fips', { count: 'exact', head: true })
const hudExists = !hud.error
console.log(`Migration 034 (hud_qct_dda_data table): ${hudExists ? `✓ APPLIED (${hud.count ?? 0} rows)` : `⏳ NOT APPLIED — ${hud.error?.message}`}`)

// ── Migration 036: nmtc_lic_data ──
const nmtc = await admin.from('nmtc_lic_data').select('county_fips', { count: 'exact', head: true })
const nmtcExists = !nmtc.error
console.log(`Migration 036 (nmtc_lic_data table):    ${nmtcExists ? `✓ APPLIED (${nmtc.count ?? 0} rows)` : `⏳ NOT APPLIED — ${nmtc.error?.message}`}`)

// ── Migrations 035 + 037: get_data_freshness RPC blocks ──
const { data: freshness, error: rpcErr } = await admin.rpc('get_data_freshness')
if (rpcErr) {
  console.log(`get_data_freshness RPC error: ${rpcErr.message}`)
} else {
  const has035 = freshness && 'hud_qct_dda_data' in freshness
  const has037 = freshness && 'nmtc_lic_data'    in freshness
  console.log(`Migration 035 (RPC includes hud_qct_dda_data): ${has035 ? '✓ APPLIED' : '⏳ NOT APPLIED'}`)
  console.log(`Migration 037 (RPC includes nmtc_lic_data):    ${has037 ? '✓ APPLIED' : '⏳ NOT APPLIED'}`)
  console.log(`\nRPC keys present: ${Object.keys(freshness).sort().join(', ')}`)
}
