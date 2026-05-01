/**
 * One-shot: probe ix_queue_data live coverage so the IX-score blend uses
 * calibrated thresholds, not invented ones. Reports:
 *   - state coverage count
 *   - distribution of mw_pending, avg_study_months, withdrawal_pct
 *   - which CS-active states are MISSING from ix_queue_data
 *   - data_source breakdown (seed vs scraper vs manual)
 *
 * Usage:  node scripts/probe-ix-queue.mjs
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

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log(`→ Probing ix_queue_data in ${url}\n`)

// ── Full pull (table is small — at most a few hundred rows) ──
const { data: rows, error } = await admin
  .from('ix_queue_data')
  .select('state_id, iso, utility_name, projects_in_queue, mw_pending, avg_study_months, withdrawal_pct, avg_upgrade_cost_mw, queue_trend, data_source, fetched_at')
if (error) { console.error(error); process.exit(1) }

console.log(`Total rows: ${rows.length}`)
console.log(`Distinct states: ${new Set(rows.map(r => r.state_id)).size}`)
console.log(`Distinct ISOs:   ${new Set(rows.map(r => r.iso)).size}`)
console.log(``)

// State-level rollup
const byState = new Map()
for (const r of rows) {
  if (!byState.has(r.state_id)) byState.set(r.state_id, [])
  byState.get(r.state_id).push(r)
}
const states = Array.from(byState.keys()).sort()
console.log(`States with at least one row (${states.length}):`)
console.log(`  ${states.join(', ')}\n`)

// Numeric distributions
function pctile(arr, p) {
  const sorted = arr.slice().sort((a, b) => a - b)
  if (!sorted.length) return null
  return sorted[Math.floor(sorted.length * p / 100)]
}
function dist(label, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && Number.isFinite(Number(v))).map(Number)
  if (!vals.length) { console.log(`${label}: no data`); return }
  console.log(`${label}: n=${vals.length}  min=${Math.min(...vals)}  p25=${pctile(vals, 25)}  p50=${pctile(vals, 50)}  p75=${pctile(vals, 75)}  max=${Math.max(...vals)}`)
}
dist('projects_in_queue   ', 'projects_in_queue')
dist('mw_pending          ', 'mw_pending')
dist('avg_study_months    ', 'avg_study_months')
dist('withdrawal_pct      ', 'withdrawal_pct')
dist('avg_upgrade_cost_mw ', 'avg_upgrade_cost_mw')

console.log(``)

// data_source breakdown
const sourceTally = {}
for (const r of rows) sourceTally[r.data_source] = (sourceTally[r.data_source] || 0) + 1
console.log(`data_source breakdown: ${JSON.stringify(sourceTally)}`)

// queue_trend breakdown
const trendTally = {}
for (const r of rows) trendTally[r.queue_trend] = (trendTally[r.queue_trend] || 0) + 1
console.log(`queue_trend breakdown: ${JSON.stringify(trendTally)}\n`)

// Cross-check: which CS-active states (cs_status != 'none') are MISSING?
const { data: csStates, error: csErr } = await admin
  .from('state_programs')
  .select('id, cs_status, ix_difficulty')
  .neq('cs_status', 'none')
if (csErr) { console.error(csErr); process.exit(1) }

const missingFromIx = csStates
  .filter(s => !byState.has(s.id))
  .map(s => `${s.id}(cs=${s.cs_status},ix=${s.ix_difficulty})`)
console.log(`CS-active states MISSING from ix_queue_data (${missingFromIx.length}):`)
console.log(`  ${missingFromIx.join(', ') || '(none)'}\n`)

// Sample row
console.log(`Sample row:`)
console.log(JSON.stringify(rows[0], null, 2))
