/**
 * Generic distribution-DG cutover: replace a state's ix_queue_data rows
 * (fabricated seed / stale ISO-scraper rows) with real distribution-level CS
 * rows from that state's scraper. Supersedes the NY-specific apply-ny-dg.mjs.
 *
 * SAFETY: default is DRY RUN. Pass --apply to execute. The apply path DELETEs
 * the state's existing rows then INSERTs fresh ones — destructive, so it needs
 * explicit operator approval (CLAUDE.md §1.1). Aborts if the scraper returns 0
 * rows (never wipe a state to empty) or if migration 064 columns are missing.
 *
 * Usage:
 *   node scripts/apply-dist-cutover.mjs NJ           # dry run
 *   node scripts/apply-dist-cutover.mjs NJ --apply   # execute (after approval)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { scrapeNyDg } from '../api/scrapers/_refresh-ny-dg.js'
import { scrapeNjDg } from '../api/scrapers/_refresh-nj-dg.js'

const SCRAPERS = { NY: scrapeNyDg, NJ: scrapeNjDg }

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const args = process.argv.slice(2)
const state = (args.find(a => /^[A-Z]{2}$/.test(a)) || '').toUpperCase()
const APPLY = args.includes('--apply')
if (!SCRAPERS[state]) { console.error(`Usage: node scripts/apply-dist-cutover.mjs <${Object.keys(SCRAPERS).join('|')}> [--apply]`); process.exit(1) }

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
console.log(`═══ ${state} ix_queue_data cutover — ${APPLY ? 'APPLY (writes!)' : 'DRY RUN'} ═══\n`)

const newRows = await SCRAPERS[state]()
console.log(`scraper produced ${newRows.length} row(s):`)
for (const r of newRows) console.log(`  + ${r.utility_name.padEnd(18)} pipeline ${String(r.projects_in_queue).padStart(4)}/${String(r.mw_pending).padStart(5)}MW · completed ${r.completed_projects ?? '—'} · src=${r.data_source}`)

const { data: oldRows, error: oldErr } = await admin
  .from('ix_queue_data').select('utility_name, data_source, projects_in_queue, fetched_at').eq('state_id', state)
if (oldErr) { console.error(oldErr); process.exit(1) }
console.log(`\nexisting ${state} rows to be DELETED (${oldRows.length}):`)
for (const r of oldRows) console.log(`  - ${r.utility_name.padEnd(18)} src=${r.data_source} proj=${r.projects_in_queue} @${r.fetched_at?.slice(0,10)}`)

if (!APPLY) { console.log(`\nDRY RUN — no writes. Re-run with --apply.`); process.exit(0) }

if (newRows.length === 0) { console.error('\nABORT: scraper returned 0 rows — refusing to wipe the state to empty.'); process.exit(1) }
const probe = await admin.from('ix_queue_data').select('completed_projects').limit(1)
if (probe.error && /completed_projects|column/.test(probe.error.message)) { console.error(`\nABORT: migration 064 not applied — ${probe.error.message}`); process.exit(1) }

const del = await admin.from('ix_queue_data').delete().eq('state_id', state)
if (del.error) { console.error('DELETE failed:', del.error.message); process.exit(1) }
const ins = await admin.from('ix_queue_data').insert(newRows)
if (ins.error) { console.error('INSERT failed:', ins.error.message); process.exit(1) }
console.log(`\nDeleted ${state} rows; inserted ${newRows.length}.`)

const { data: check } = await admin.from('ix_queue_data').select('utility_name, projects_in_queue, completed_projects, data_source').eq('state_id', state)
console.log(`Verified ${state} rows now (${check.length}):`)
for (const r of check) console.log(`  ${r.utility_name.padEnd(18)} pipeline=${r.projects_in_queue} completed=${r.completed_projects ?? '—'} src=${r.data_source}`)
console.log('\nDone.')
