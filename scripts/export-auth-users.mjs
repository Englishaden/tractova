#!/usr/bin/env node
// Export auth.users to backups/<date>/auth_users.json.
//
// The standard JSON snapshot (dump-supabase-snapshot.mjs) covers public.*
// tables only — Supabase auth lives in a separate schema with restricted
// access. This script uses the supabase admin API
// (`supabaseAdmin.auth.admin.listUsers`) which DOES read auth.users
// via the service-role key.
//
// What's exported (verified against Supabase JS SDK return shape):
//   id, email, created_at, last_sign_in_at, email_confirmed_at,
//   phone, role, app_metadata, user_metadata, aud, raw fields stripped.
//
// What's NEVER exported:
//   encrypted_password (password hash), recovery_token, email_change_token,
//   confirmation_token. The SDK doesn't return them, but we explicitly
//   redact in case the shape changes upstream.
//
// Usage:
//   node scripts/export-auth-users.mjs
// Output:
//   backups/YYYY-MM-DD/auth_users.json (one row per user)

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
} catch { /* ok */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ! Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Allowlist of fields we keep. Everything else is dropped — defense in depth.
const KEEP = new Set([
  'id', 'email', 'phone', 'role', 'aud',
  'created_at', 'updated_at', 'last_sign_in_at',
  'email_confirmed_at', 'phone_confirmed_at', 'banned_until',
  'app_metadata', 'user_metadata', 'is_anonymous',
])

function sanitize(u) {
  const out = {}
  for (const k of Object.keys(u || {})) if (KEEP.has(k)) out[k] = u[k]
  return out
}

const today = new Date().toISOString().slice(0, 10)
const outDir = join(ROOT, 'backups', today)
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const all = []
const PAGE = 1000
let page = 1
console.log(`\n  Exporting auth.users to backups/${today}/auth_users.json…\n`)

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE })
  if (error) {
    console.error(`  ! page ${page} failed: ${error.message}`)
    process.exit(1)
  }
  const users = data?.users ?? []
  all.push(...users.map(sanitize))
  console.log(`    page ${page}: ${users.length} user(s) (running total: ${all.length})`)
  if (users.length < PAGE) break
  page += 1
  if (page > 50) {
    console.warn('  ! more than 50,000 users — pagination cap hit; tighten this script.')
    break
  }
}

const file = join(outDir, 'auth_users.json')
writeFileSync(file, JSON.stringify(all, null, 2), 'utf8')
const sizeKB = (JSON.stringify(all).length / 1024).toFixed(0)
console.log(`\n  ✓ ${all.length} user(s) exported · ${sizeKB} KB · ${file}\n`)
