#!/usr/bin/env node
// Restore from a JSON snapshot produced by dump-supabase-snapshot.mjs.
//
// SAFETY MODEL — read this before running.
//
//   1. Default is DRY RUN. The script reads + parses + previews snapshot
//      data but performs zero writes. To actually write, pass --live.
//   2. Even with --live, the script refuses to run against a Supabase URL
//      whose host contains "prod" or "production" unless the env var
//      RESTORE_ALLOW_PROD=1 is also set. Belt and suspenders.
//   3. Default mode is upsert by primary key, idempotent. Rows present in
//      the live table but not in the snapshot are LEFT ALONE (i.e., not
//      destructive). To wipe-and-restore, use SQL editor manually under
//      explicit approval per CLAUDE.md § 1.1.
//
// USAGE
//
//   node scripts/restore-from-snapshot.mjs --dry-run --date 2026-05-06
//   node scripts/restore-from-snapshot.mjs --date 2026-05-06 --table state_programs
//   node scripts/restore-from-snapshot.mjs --date 2026-05-06 --all --live
//
// FLAGS
//
//   --date=YYYY-MM-DD     snapshot directory under backups/. Required.
//   --table=NAME          restore exactly one table. Mutually exclusive with --all.
//   --all                 restore every JSON file in backups/<date>/.
//   --live                actually upsert. Without this, dry-run only.
//   --on-conflict=COL     pass-through to Supabase upsert; defaults to id.
//   --batch=N             rows per upsert call. Default 500.
//
// See docs/runbooks/restore-from-snapshot.md for procedure + escalation.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(import.meta.dirname, '..')

// ── env loading (mirrors the dump script) ─────────────────────────────
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

// ── arg parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name) => {
  const eq = args.find(a => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = args.indexOf(`--${name}`)
  if (i === -1) return null
  const next = args[i + 1]
  if (!next || next.startsWith('--')) return true
  return next
}

const date = flag('date')
const table = flag('table')
const all = flag('all') === true
const live = flag('live') === true
const onConflict = flag('on-conflict') || 'id'
const batch = Number(flag('batch')) || 500

if (!date) {
  console.error('  ! --date=YYYY-MM-DD required.')
  console.error('  Usage: node scripts/restore-from-snapshot.mjs --date 2026-05-06 [--table NAME | --all] [--live]')
  process.exit(1)
}

if (table && all) {
  console.error('  ! Pass --table OR --all, not both.')
  process.exit(1)
}

if (!table && !all) {
  console.error('  ! Pass --table=NAME for single-table or --all for full restore.')
  process.exit(1)
}

const snapDir = join(ROOT, 'backups', date)
if (!existsSync(snapDir)) {
  console.error(`  ! No snapshot at ${snapDir}.`)
  process.exit(1)
}

// ── safety: prod guard ────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ! Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.')
  process.exit(1)
}

const looksLikeProd = /prod|production/i.test(new URL(SUPABASE_URL).host)
if (live && looksLikeProd && process.env.RESTORE_ALLOW_PROD !== '1') {
  console.error(`  ! Refusing to write to prod-looking host: ${new URL(SUPABASE_URL).host}`)
  console.error('  ! Set RESTORE_ALLOW_PROD=1 in env to override (and pair with explicit human approval per CLAUDE.md § 1.1).')
  process.exit(1)
}

const mode = live ? 'LIVE WRITE' : 'DRY RUN'
console.log(`\n  ${mode}  ·  target: ${SUPABASE_URL}  ·  snapshot: backups/${date}/\n`)

const admin = live ? createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
}) : null

// ── per-table runner ──────────────────────────────────────────────────
async function restoreOne(tableName) {
  const file = join(snapDir, `${tableName}.json`)
  if (!existsSync(file)) {
    console.log(`    ⊘ ${tableName.padEnd(34)} (no snapshot file — skipping)`)
    return { ok: true, rows: 0, skipped: true }
  }
  let rows
  try {
    rows = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    console.log(`    ! ${tableName.padEnd(34)} JSON parse failed: ${err.message}`)
    return { ok: false, rows: 0 }
  }
  if (!Array.isArray(rows)) {
    console.log(`    ! ${tableName.padEnd(34)} not an array; got ${typeof rows}`)
    return { ok: false, rows: 0 }
  }
  if (rows.length === 0) {
    console.log(`    ⊘ ${tableName.padEnd(34)} (empty snapshot — skipping)`)
    return { ok: true, rows: 0, skipped: true }
  }
  if (!live) {
    const preview = rows[0] ? Object.keys(rows[0]).slice(0, 6).join(', ') : '(empty)'
    console.log(`    ✓ ${tableName.padEnd(34)} ${String(rows.length).padStart(6)} rows  · keys: ${preview}…  (dry-run)`)
    return { ok: true, rows: rows.length }
  }
  // live upsert in batches
  let written = 0
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch)
    const { error } = await admin.from(tableName).upsert(slice, { onConflict })
    if (error) {
      console.log(`    ! ${tableName.padEnd(34)} batch ${i}-${i + slice.length} failed: ${error.message}`)
      return { ok: false, rows: written }
    }
    written += slice.length
  }
  console.log(`    ✓ ${tableName.padEnd(34)} ${String(written).padStart(6)} rows upserted`)
  return { ok: true, rows: written }
}

// ── orchestration ─────────────────────────────────────────────────────
let targets
if (table) {
  targets = [table]
} else {
  // --all: restore in the same order the dump script writes (parent → child)
  targets = readdirSync(snapDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5))
}

const t0 = Date.now()
let totalRows = 0
let failures = 0
for (const t of targets) {
  const r = await restoreOne(t)
  if (!r.ok) failures += 1
  totalRows += r.rows || 0
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
const summary = live ? `${totalRows.toLocaleString()} rows upserted` : `${totalRows.toLocaleString()} rows previewed`
console.log(`\n  ${mode} complete: ${summary} across ${targets.length} table(s) · ${elapsed}s${failures ? ` · ${failures} failure(s)` : ''}\n`)
if (failures > 0) process.exit(1)
