#!/usr/bin/env node
// Supabase manual snapshot — exports critical tables to timestamped
// JSON files under backups/ (gitignored). Defense-in-depth alongside
// Supabase's automatic daily backups + PITR.
//
// Why JSON instead of pg_dump? pg_dump needs direct database access
// (port 5432) which Supabase exposes only on paid tiers, and it's
// less portable across local environments. The Supabase JS client
// works on every tier and from any machine with the service-role key.
//
// What this CAN restore: the row data of the listed tables, idempotent
// upsert by primary key.
// What this CANNOT restore on its own: schema (use migration files),
// extensions, RLS policies (also migrations), Storage buckets (separate
// flow), auth users (different export path).
//
// Run: `node scripts/dump-supabase-snapshot.mjs`
// Output: backups/YYYY-MM-DD/<table>.json
//
// Tied to Plan B item B.3 (Backup posture).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(import.meta.dirname, '..')

try {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
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
} catch { /* .env.local not present in CI */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ! Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Cannot dump.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Critical tables — the load-bearing data layer for the product. New
// tables should be added here when they become product-critical.
// Ordering follows dependency: parent tables first, child tables last
// (so a partial restore fails fast if FK constraints are violated).
//
// Names verified against supabase/migrations/*.sql on 2026-05-06. If a
// table here can't be found, the migration may have renamed it — fix
// the name rather than letting the snapshot silently skip it.
const TABLES = [
  // — auth + product —
  'profiles',
  'projects',
  'project_events',
  'share_tokens',
  // — curated data layer —
  'state_programs',
  'state_programs_snapshots',
  'revenue_rates',
  'lmi_data',
  'county_acs_data',
  'county_geospatial_data',
  'energy_community_data',
  'hud_qct_dda_data',
  'nmtc_lic_data',
  'puc_dockets',
  'comparable_deals',
  // — observed external data —
  'substations',
  'ix_queue_data',
  'ix_queue_snapshots',
  'solar_cost_index',
  'cs_projects',
  'cs_specific_yield',
  // — user features —
  'scenario_snapshots',
  'cancellation_feedback',
  // — operational telemetry —
  'cron_runs',
  'api_call_log',
  'ai_response_cache',
  'admin_audit_log',
]

const today = new Date().toISOString().slice(0, 10)
const outDir = join(ROOT, 'backups', today)
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

let totalRows = 0
let totalBytes = 0
let errors = 0

console.log(`\n  Dumping snapshot to backups/${today}/\n`)

for (const table of TABLES) {
  const rows = []
  let from = 0
  const pageSize = 1000
  let done = false
  while (!done) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)
    if (error) {
      console.warn(`    ! ${table.padEnd(34)} ${error.message}`)
      errors += 1
      done = true
      break
    }
    if (!data || data.length === 0) { done = true; break }
    rows.push(...data)
    if (data.length < pageSize) { done = true; break }
    from += pageSize
  }
  if (rows.length === 0) continue
  const json = JSON.stringify(rows, null, 2)
  const file = join(outDir, `${table}.json`)
  writeFileSync(file, json, 'utf8')
  totalRows += rows.length
  totalBytes += json.length
  console.log(`    ✓ ${table.padEnd(34)} ${String(rows.length).padStart(6)} rows  ${(json.length / 1024).toFixed(0)} KB`)
}

// auth.users — separate export path (not in public.* schema). Wired
// in here so a single `dump-supabase-snapshot.mjs` invocation produces
// a fully-restorable snapshot.
console.log(`\n  Exporting auth.users…`)
let authUsersCount = 0
try {
  const all = []
  const PAGE = 1000
  let page = 1
  const KEEP = new Set([
    'id', 'email', 'phone', 'role', 'aud',
    'created_at', 'updated_at', 'last_sign_in_at',
    'email_confirmed_at', 'phone_confirmed_at', 'banned_until',
    'app_metadata', 'user_metadata', 'is_anonymous',
  ])
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) {
      const sanitized = {}
      for (const k of Object.keys(u || {})) if (KEEP.has(k)) sanitized[k] = u[k]
      all.push(sanitized)
    }
    if (users.length < PAGE) break
    page += 1
    if (page > 50) break
  }
  const file = join(outDir, 'auth_users.json')
  writeFileSync(file, JSON.stringify(all, null, 2), 'utf8')
  authUsersCount = all.length
  console.log(`    ✓ auth_users                       ${String(authUsersCount).padStart(6)} users  (sanitized; password hashes never written)`)
} catch (err) {
  console.warn(`    ! auth_users export failed: ${err.message ?? err}`)
  errors += 1
}

const sizeStr = totalBytes > 1024 * 1024
  ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
  : `${(totalBytes / 1024).toFixed(0)} KB`
console.log(`\n  Snapshot complete: ${totalRows.toLocaleString()} rows + ${authUsersCount} users / ${sizeStr}${errors > 0 ? ` · ${errors} target(s) failed` : ''}`)
console.log(`  Location: backups/${today}/`)
console.log(`  Recovery drill: see docs/runbooks/restore-from-snapshot.md\n`)

if (errors > 0) process.exit(1)
