/**
 * One-time cutover: replace NY's ix_queue_data rows (fabricated seed + the
 * empty NYISO-transmission "scraper" rows, which use inconsistent utility-name
 * spellings) with real NYSERDA distribution-level CS pipeline rows.
 *
 * SAFETY: default is DRY RUN (no writes). Pass --apply to execute.
 * The apply path DELETEs the existing NY rows then INSERTs fresh ones — a
 * destructive op, so it requires explicit operator approval (CLAUDE.md §1.1).
 *
 * PREREQUISITE: migration 064 must be applied first (adds completed_projects /
 * completed_mw). The script checks for those columns and aborts if missing.
 *
 * Usage:
 *   node scripts/apply-ny-dg.mjs            # dry run — shows the plan
 *   node scripts/apply-ny-dg.mjs --apply    # execute (after approval)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { scrapeNyDg } from '../api/scrapers/_refresh-ny-dg.js'

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

console.log(`═══ NY ix_queue_data cutover — ${APPLY ? 'APPLY (writes!)' : 'DRY RUN'} ═══\n`)

// 1. Fetch the new NYSERDA rows.
const newRows = await scrapeNyDg()
console.log(`NYSERDA produced ${newRows.length} rows:`)
for (const r of newRows) {
  console.log(`  + ${r.utility_name.padEnd(18)} pipeline ${String(r.projects_in_queue).padStart(4)}/${String(r.mw_pending).padStart(4)}MW · complete ${String(r.completed_projects).padStart(4)}/${String(r.completed_mw).padStart(4)}MW · src=${r.data_source}`)
}

// 2. Show what would be deleted.
const { data: oldRows, error: oldErr } = await admin
  .from('ix_queue_data').select('utility_name, data_source, projects_in_queue, fetched_at').eq('state_id', 'NY')
if (oldErr) { console.error(oldErr); process.exit(1) }
console.log(`\nExisting NY rows to be DELETED (${oldRows.length}):`)
for (const r of oldRows) console.log(`  - ${r.utility_name.padEnd(18)} src=${r.data_source} proj=${r.projects_in_queue} @${r.fetched_at?.slice(0,10)}`)

if (!APPLY) {
  console.log(`\nDRY RUN — no writes. Re-run with --apply to delete the ${oldRows.length} rows above and insert the ${newRows.length} NYSERDA rows.`)
  process.exit(0)
}

// 3. Guard: migration 064 columns must exist.
const probe = await admin.from('ix_queue_data').select('completed_projects, completed_mw').limit(1)
if (probe.error && /completed_projects|completed_mw|column/.test(probe.error.message)) {
  console.error(`\nABORT: migration 064 not applied (completed_projects/completed_mw missing). Apply it in Supabase first.\n  ${probe.error.message}`)
  process.exit(1)
}

// 4. Delete + insert.
const del = await admin.from('ix_queue_data').delete().eq('state_id', 'NY')
if (del.error) { console.error('DELETE failed:', del.error.message); process.exit(1) }
console.log(`\nDeleted NY rows.`)
const ins = await admin.from('ix_queue_data').insert(newRows)
if (ins.error) { console.error('INSERT failed:', ins.error.message); process.exit(1) }
console.log(`Inserted ${newRows.length} NYSERDA rows.`)

// 5. Verify.
const { data: check } = await admin.from('ix_queue_data').select('utility_name, projects_in_queue, completed_projects, data_source').eq('state_id', 'NY').order('projects_in_queue', { ascending: false })
console.log(`\nVerified NY rows now in table (${check.length}):`)
for (const r of check) console.log(`  ${r.utility_name.padEnd(18)} pipeline=${r.projects_in_queue} complete=${r.completed_projects} src=${r.data_source}`)
console.log('\nDone.')
