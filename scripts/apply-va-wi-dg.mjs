/**
 * Additive VA + WI distribution-DG population for ix_queue_data.
 *
 * VA (Dominion Queue Status Report) + WI (Alliant DG queue) are BRAND-NEW states
 * — no existing rows to replace — so this is a pure additive UPSERT (no DELETE,
 * not a destructive op). Mirrors api/refresh-ix-queue.js semantics: compute trend
 * vs any existing row, upsert on (state_id,utility_name), append a snapshot.
 *
 * SAFETY: default is DRY RUN. Pass --apply to write. Aborts if a scraper returns
 * 0 rows (never write empty signal).
 *
 * Usage:
 *   node scripts/apply-va-wi-dg.mjs            # dry run
 *   node scripts/apply-va-wi-dg.mjs --apply    # execute
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { scrapeVaDg } from '../api/scrapers/_refresh-va-dg.js'
import { scrapeWiDg } from '../api/scrapers/_refresh-wi-dg.js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const APPLY = process.argv.includes('--apply')
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
console.log(`═══ VA + WI ix_queue_data ADDITIVE upsert — ${APPLY ? 'APPLY (writes!)' : 'DRY RUN'} ═══\n`)

function computeTrend(newCount, oldCount) {
  if (oldCount == null) return 'stable'
  const delta = (newCount - oldCount) / Math.max(oldCount, 1)
  if (delta > 0.10) return 'growing'
  if (delta < -0.10) return 'shrinking'
  return 'stable'
}

const scrapers = [{ name: 'VA-DG', fn: scrapeVaDg }, { name: 'WI-DG', fn: scrapeWiDg }]
const allRows = []
for (const s of scrapers) {
  const rows = await s.fn()
  if (!rows || rows.length === 0) { console.error(`ABORT: ${s.name} returned 0 rows — refusing to write empty signal.`); process.exit(1) }
  console.log(`${s.name}: ${rows.length} row(s)`)
  for (const r of rows) console.log(`  + ${r.state_id} ${r.utility_name.padEnd(16)} pipeline ${String(r.projects_in_queue).padStart(5)}/${String(r.mw_pending).padStart(5)}MW · completed ${r.completed_projects ?? '—'} · src=${r.data_source}`)
  allRows.push(...rows)
}

// Existing rows for trend (VA/WI expected absent → trend 'stable').
const { data: existing } = await admin.from('ix_queue_data').select('state_id, utility_name, projects_in_queue')
const existingMap = {}
for (const r of (existing || [])) existingMap[`${r.state_id}:${r.utility_name}`] = r.projects_in_queue

if (!APPLY) { console.log(`\nDRY RUN — no writes. Re-run with --apply.`); process.exit(0) }

let upserted = 0, snapped = 0
for (const row of allRows) {
  const key = `${row.state_id}:${row.utility_name}`
  const trend = computeTrend(row.projects_in_queue, existingMap[key])
  const { error } = await admin.from('ix_queue_data').upsert({ ...row, queue_trend: trend }, { onConflict: 'state_id,utility_name' })
  if (error) { console.error(`upsert ${key} failed:`, error.message); process.exit(1) }
  upserted++
  const { error: snapErr } = await admin.from('ix_queue_snapshots').insert({
    state_id: row.state_id, iso: row.iso, utility_name: row.utility_name,
    projects_in_queue: row.projects_in_queue, mw_pending: row.mw_pending, queue_trend: trend,
    avg_study_months: row.avg_study_months ?? null, withdrawal_pct: row.withdrawal_pct ?? null,
    avg_upgrade_cost_mw: row.avg_upgrade_cost_mw ?? null, data_source: row.data_source,
  })
  if (snapErr) console.warn(`  snapshot ${key} failed: ${snapErr.message}`); else snapped++
}
console.log(`\nUpserted ${upserted} row(s); recorded ${snapped} snapshot(s).`)

const { data: check } = await admin.from('ix_queue_data').select('utility_name, projects_in_queue, completed_projects, data_source').in('state_id', ['VA', 'WI'])
console.log(`Verified VA/WI rows now (${check.length}):`)
for (const r of check) console.log(`  ${r.utility_name.padEnd(16)} pipeline=${r.projects_in_queue} completed=${r.completed_projects ?? '—'} src=${r.data_source}`)
console.log('\nDone.')
