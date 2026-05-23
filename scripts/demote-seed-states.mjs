/**
 * Honesty cleanup: delete the fabricated seed / empty-ISO-scraper rows in
 * ix_queue_data for the 6 states that never got real distribution data
 * (CO, IL, MA, MD, ME, MN). After NY + NJ cut over to real data, these are the
 * only ones still showing "IX · Live" on synthesized numbers that (a) no longer
 * refresh (ISO scrapers deleted) and (b) blend fabricated study-months into the
 * score. Deleting them → ixCoverage reverts to 'curated' → IX score = pure
 * curated ixDifficulty baseline (honest). MD will instead surface its real BGE
 * hosting-capacity data.
 *
 * SAFETY: dry-run by default. Pass --apply to execute (prod DELETE, CLAUDE.md §1.1).
 * Guard: refuses to touch any state whose rows are real (data_source nyserda_cdg
 * / nj_ic_queue / arcgis_hc) — only seed/scraper rows are eligible.
 *
 * Usage:  node scripts/demote-seed-states.mjs [--apply]
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const STATES = ['CO', 'IL', 'MA', 'MD', 'ME', 'MN']
const REAL_SOURCES = new Set(['nyserda_cdg', 'nj_ic_queue', 'arcgis_hc'])
const APPLY = process.argv.includes('--apply')
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log(`═══ Demote fabricated-seed states — ${APPLY ? 'APPLY (writes!)' : 'DRY RUN'} ═══\n`)

const { data: rows, error } = await admin
  .from('ix_queue_data')
  .select('state_id, utility_name, data_source, projects_in_queue, fetched_at')
  .in('state_id', STATES)
if (error) { console.error(error); process.exit(1) }

// Safety: abort if any targeted row is actually real data.
const realRows = rows.filter(r => REAL_SOURCES.has(r.data_source))
if (realRows.length) {
  console.error(`ABORT: ${realRows.length} targeted row(s) are REAL data — refusing to delete:`)
  for (const r of realRows) console.error(`  ${r.state_id} ${r.utility_name} (${r.data_source})`)
  process.exit(1)
}

console.log(`Rows to DELETE (${rows.length}) across ${STATES.length} states:`)
for (const r of rows) console.log(`  - ${r.state_id} ${r.utility_name.padEnd(22)} src=${r.data_source} proj=${r.projects_in_queue} @${r.fetched_at?.slice(0, 10)}`)
console.log(`\nAfter deletion these 6 states show IX = curated baseline (no fake "live"). MD will surface real BGE hosting capacity instead.`)

if (!APPLY) { console.log(`\nDRY RUN — no writes. Re-run with --apply.`); process.exit(0) }

const del = await admin.from('ix_queue_data').delete().in('state_id', STATES)
if (del.error) { console.error('DELETE failed:', del.error.message); process.exit(1) }

const { data: check } = await admin.from('ix_queue_data').select('state_id, data_source')
const tally = {}
for (const r of check || []) tally[r.data_source] = (tally[r.data_source] || 0) + 1
console.log(`\nDeleted. ix_queue_data now ${check.length} rows: ${JSON.stringify(tally)}`)
console.log(`remaining states: ${[...new Set((check || []).map(r => r.state_id))].sort().join(', ')}`)
