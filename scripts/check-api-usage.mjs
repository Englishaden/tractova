#!/usr/bin/env node
// API usage probe — quick weekly snapshot of AI / cron spend signals
// the project produces, so cost runaway shows up before it becomes a
// surprise on the Anthropic / Vercel bill.
//
// Anthropic does not expose a per-API-key usage endpoint to non-admins,
// so this script triangulates from what we DO have:
//
//   1. cron_runs — duration_ms + status + summary fields per cron
//      execution. High-frequency expensive cron = budget concern.
//   2. lens_insight_cache — if present, count of cached insights
//      generated in the last 7 days.
//   3. Sanity self-check — confirm the ANTHROPIC_API_KEY in env is
//      set and the most recent cron run is recent enough.
//
// Output: short text summary printed to stdout. Run weekly via cron
// or manually before reviewing the Anthropic Console.
//
// Tied to CLAUDE.md Section 4 (COST RUNAWAY CIRCUIT BREAKERS) and
// Plan B item B.5.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(import.meta.dirname, '..')

// Best-effort .env.local loader. Idempotent — won't override existing env.
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
} catch { /* .env.local not present in CI / production */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ! Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Cannot probe.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

console.log('\n  Tractova API usage probe — last 7 days\n')
console.log(`  ANTHROPIC_API_KEY in env: ${HAS_ANTHROPIC ? 'yes' : 'NO (set before deploy)'}`)

// 1. cron_runs activity
const { data: cronRows, error: cronErr } = await admin
  .from('cron_runs')
  .select('cron_name, status, started_at, duration_ms')
  .gte('started_at', sevenDaysAgo)

if (cronErr) {
  console.error(`  ! cron_runs query failed: ${cronErr.message}`)
} else {
  const byName = {}
  for (const r of cronRows || []) {
    byName[r.cron_name] ??= { runs: 0, ok: 0, fail: 0, totalMs: 0 }
    byName[r.cron_name].runs += 1
    if (r.status === 'success' || r.status === 'ok') byName[r.cron_name].ok += 1
    else byName[r.cron_name].fail += 1
    byName[r.cron_name].totalMs += r.duration_ms || 0
  }
  console.log(`\n  cron_runs (last 7d):`)
  const sorted = Object.entries(byName).sort((a, b) => b[1].totalMs - a[1].totalMs)
  for (const [name, s] of sorted) {
    const flag = s.fail > 0 ? ' ⚠' : ''
    console.log(`    ${name.padEnd(32)} runs=${String(s.runs).padStart(3)}  ok=${String(s.ok).padStart(3)}  fail=${String(s.fail).padStart(2)}  total=${(s.totalMs / 1000).toFixed(1)}s${flag}`)
  }
}

// 2. lens-insight cache (if table exists)
const { data: insightRows, error: insightErr } = await admin
  .from('lens_insight_cache')
  .select('id, generated_at')
  .gte('generated_at', sevenDaysAgo)
if (!insightErr && insightRows) {
  console.log(`\n  lens_insight_cache: ${insightRows.length} insight(s) generated in last 7d`)
} else if (insightErr && insightErr.code !== 'PGRST205' && !insightErr.message?.includes('does not exist')) {
  console.log(`\n  lens_insight_cache: ${insightErr.message}`)
}

// 3. Cost-runaway thresholds (heuristic)
console.log('\n  Cost-runaway thresholds (heuristic — see CLAUDE.md §4):')
const totalCronRuns = (cronRows || []).length
console.log(`    cron runs / week      = ${totalCronRuns}    (>500 ⇒ investigate; current floor ~350)`)
const lensCount = (insightRows || []).length
console.log(`    Lens insights / week  = ${lensCount}    (>500 ⇒ investigate / cache TTL)`)

console.log('\n  Anthropic Console (manual): https://console.anthropic.com/usage')
console.log('  Vercel Functions (manual):  https://vercel.com/<team>/tractova/usage\n')
