/**
 * Generic cron_runs probe — shows the last N runs for a given cron_name with
 * their full summary jsonb expanded. Lets any "did this cron actually do
 * anything?" question be answered in seconds without hardcoding the per-
 * scraper summary shape into a custom probe.
 *
 * Each scraper returns its own summary fields because they do different
 * work (rows refreshed for ACS vs articles inserted for news vs states
 * verified for state_programs). This probe doesn't care — it dumps every
 * key in summary so the schema-of-the-day is self-evident.
 *
 * Usage:
 *   node scripts/probe-cron-runs.mjs                       # all sources, last 5 each
 *   node scripts/probe-cron-runs.mjs --source=news         # last 10 news runs
 *   node scripts/probe-cron-runs.mjs --source=state_programs --limit=20
 *   node scripts/probe-cron-runs.mjs --failed              # last 10 failures, any source
 *
 * cron_name in the table is `refresh-data:<source>`; pass just the bare
 * source name (e.g. `news`) — the probe prepends the prefix.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

const args = Object.fromEntries(
  process.argv.slice(2)
    .map(a => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true])
)
const sourceArg  = args.source ? `refresh-data:${args.source}` : null
const limit      = parseInt(args.limit, 10) || (sourceArg ? 10 : 5)
const failedOnly = !!args.failed

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const fmt = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—'
const ago = d => d ? ((Date.now() - new Date(d).getTime()) / 3_600_000).toFixed(1) + 'h' : '—'

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' cron_runs probe')
console.log(`  filter: ${sourceArg ?? '(all sources)'}${failedOnly ? '  failed-only' : ''}  limit=${limit}`)
console.log(`  now:    ${fmt(new Date())}`)
console.log('═══════════════════════════════════════════════════════════════════\n')

// Build query
let q = admin.from('cron_runs')
  .select('cron_name, status, started_at, finished_at, duration_ms, summary')
  .order('finished_at', { ascending: false })
if (sourceArg)  q = q.eq('cron_name', sourceArg)
if (failedOnly) q = q.eq('status', 'failed')
q = q.limit(limit)

const { data, error } = await q
if (error) { console.error('cron_runs query failed:', error.message); process.exit(1) }
if (!data?.length) { console.log('No matching runs.'); process.exit(0) }

// If no source filter, group by cron_name so all sources visible at once.
const groups = sourceArg
  ? { [sourceArg]: data }
  : data.reduce((acc, r) => { (acc[r.cron_name] ||= []).push(r); return acc }, {})

for (const [cronName, runs] of Object.entries(groups)) {
  console.log(`## ${cronName}  (${runs.length} run${runs.length !== 1 ? 's' : ''})`)
  for (const r of runs) {
    const flag = r.status === 'success' ? '✅' : '❌'
    const dur  = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'
    console.log(`  ${flag} ${fmt(r.started_at)} → ${fmt(r.finished_at)} (${ago(r.finished_at)} ago) ${dur}`)
    const s = (() => {
      if (!r.summary) return null
      try { return typeof r.summary === 'string' ? JSON.parse(r.summary) : r.summary }
      catch { return { _parse_error: true, raw: r.summary } }
    })()
    if (!s) { console.log('     summary: (none)'); continue }
    // Render every key/value in summary, sorted with `ok`/`error` first for
    // scannability and skipping noisy nested samples.
    const keys = Object.keys(s).sort((a, b) => {
      const top = ['ok', 'error', 'auth_mode']
      const ai = top.indexOf(a), bi = top.indexOf(b)
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      return a.localeCompare(b)
    })
    for (const k of keys) {
      let v = s[k]
      if (k === 'sample_state' || k === 'sample_county' || k === 'samples') {
        v = v ? '<sample row redacted>' : '—'
      } else if (typeof v === 'object' && v !== null) {
        v = JSON.stringify(v).slice(0, 120)
        if (JSON.stringify(s[k]).length > 120) v += '…'
      } else if (typeof v === 'string' && v.length > 120) {
        v = v.slice(0, 117) + '…'
      }
      console.log(`     ${k.padEnd(28)} ${v}`)
    }
  }
  console.log()
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Tip: --source=<name> to filter, --limit=N to extend, --failed for')
console.log(' only failed runs. Combine to debug a specific source quickly.')
console.log('═══════════════════════════════════════════════════════════════════')
