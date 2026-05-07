/**
 * Probe live state_programs for rows past the 30-day staleness threshold.
 * Mirrors the data-health.js handleFreshness drift logic.
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

const { data, error } = await admin
  .from('state_programs')
  .select('id, name, cs_status, last_verified, updated_at, capacity_mw, enrollment_rate_mw_per_month')

if (error) { console.error(error.message); process.exit(1) }

const now = Date.now()
const stale = []
for (const r of data || []) {
  if (r.cs_status === 'none') continue
  const v = r.last_verified ? new Date(r.last_verified).getTime() : 0
  const u = r.updated_at ? new Date(r.updated_at).getTime() : 0
  const latest = Math.max(v, u)
  if (!latest) continue
  const ageDays = Math.floor((now - latest) / (86400000))
  if (ageDays > 30) {
    stale.push({
      id: r.id, name: r.name, cs_status: r.cs_status, age_days: ageDays,
      last_verified: r.last_verified, updated_at: r.updated_at,
      capacity_mw: r.capacity_mw, enrollment_rate_mw_per_month: r.enrollment_rate_mw_per_month,
    })
  }
}

stale.sort((a, b) => b.age_days - a.age_days)

console.log(`\nState_programs rows older than 30 days (cs_status != 'none'):\n`)
console.log(`STATE  STATUS    AGE  LAST_VERIFIED        UPDATED_AT           CAP   ENROLL`)
console.log(`─────  ────────  ───  ───────────────────  ───────────────────  ────  ──────`)
for (const r of stale) {
  console.log(
    `  ${r.id}   ${(r.cs_status || '').padEnd(8)}  ${String(r.age_days).padStart(3)}  ${(r.last_verified || '—').slice(0, 19).padEnd(19)}  ${(r.updated_at || '—').slice(0, 19).padEnd(19)}  ${(r.capacity_mw == null ? '—' : String(r.capacity_mw)).padStart(4)}  ${(r.enrollment_rate_mw_per_month == null ? '—' : String(r.enrollment_rate_mw_per_month)).padStart(6)}`
  )
}
console.log(`\n${stale.length} stale rows found.\n`)
