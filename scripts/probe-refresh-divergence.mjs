/**
 * One-shot: explain why Dashboard and Library show different "data refreshed"
 * timestamps. They read different sources.
 *
 * Dashboard: /api/data-health?action=last-refresh →
 *   max(cron_runs.finished_at) where status='success'
 *   = "the most recent SUCCESSFUL cron run, of any source"
 *
 * Library:   computed locally in src/pages/Library.jsx:225 →
 *   max(state_programs.last_verified, state_programs.updated_at)
 *   for rows where cs_status != 'none'
 *   = "the last time a CS-state program ROW was actually changed"
 *
 * These can diverge by days+ if recent cron runs successfully fetched data
 * but produced no row-level changes (e.g., DSIRE returned identical content).
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
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const fmt = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—'
const days = d => d ? ((Date.now() - new Date(d).getTime()) / 86_400_000).toFixed(1) + 'd' : '—'

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Refresh-timestamp divergence probe')
console.log(`  now: ${fmt(new Date())}`)
console.log('═══════════════════════════════════════════════════════════════════\n')

// ── Dashboard source ───────────────────────────────────────────────────────
{
  const { data } = await admin
    .from('cron_runs')
    .select('finished_at, cron_name, summary')
    .eq('status', 'success')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(5)

  console.log('## Dashboard signal: max(cron_runs.finished_at where status=success)')
  console.log('   (the global "Refreshed N ago" caption in the hero)')
  if (!data?.length) {
    console.log('   ⚠️  no successful runs')
  } else {
    console.log(`   → ${fmt(data[0].finished_at)}  (${days(data[0].finished_at)} ago)`)
    console.log(`   → cron_name: ${data[0].cron_name}`)
    console.log()
    console.log('   Last 5 successful runs (any source):')
    for (const r of data) {
      console.log(`     ${fmt(r.finished_at)}  ${r.cron_name}`)
    }
  }
  console.log()
}

// ── Library source ─────────────────────────────────────────────────────────
{
  // Library uses max(lastVerified, updatedAt) across active CS states.
  // We replicate that exact computation server-side.
  const { data } = await admin
    .from('state_programs')
    .select('id, cs_status, last_verified, updated_at')
    .neq('cs_status', 'none')

  console.log('## Library signal: max(state_programs.last_verified | updated_at) where cs_status != none')
  console.log('   (the "Data refreshed" stamp in the Library hero)')
  if (!data?.length) {
    console.log('   ⚠️  no CS-active rows')
  } else {
    let latestTs = 0
    let latestRow = null
    let latestField = null
    for (const r of data) {
      const v = r.last_verified ? new Date(r.last_verified).getTime() : 0
      const u = r.updated_at    ? new Date(r.updated_at).getTime()    : 0
      if (v > latestTs)   { latestTs = v; latestRow = r; latestField = 'last_verified' }
      if (u > latestTs)   { latestTs = u; latestRow = r; latestField = 'updated_at' }
    }
    console.log(`   → ${fmt(latestTs)}  (${days(latestTs)} ago)`)
    console.log(`   → driven by: ${latestRow.id} . ${latestField}`)
    console.log()

    // Distribution: how many rows by week
    const buckets = {}
    for (const r of data) {
      const u = r.updated_at ? new Date(r.updated_at).getTime() : 0
      const v = r.last_verified ? new Date(r.last_verified).getTime() : 0
      const ts = Math.max(u, v)
      const bucket = ts ? Math.floor((Date.now() - ts) / 86_400_000 / 7) : 99
      const key = bucket >= 99 ? 'never' : bucket === 0 ? '<1w' : bucket === 1 ? '1-2w' : bucket === 2 ? '2-3w' : bucket === 3 ? '3-4w' : bucket === 4 ? '4-5w' : `${bucket}w+`
      buckets[key] = (buckets[key] || 0) + 1
    }
    console.log('   Row distribution by age:')
    for (const k of ['<1w','1-2w','2-3w','3-4w','4-5w','5w+','6w+','7w+','8w+','never']) {
      if (buckets[k]) console.log(`     ${k.padEnd(6)} ${buckets[k]} rows`)
    }
  }
  console.log()
}

// ── Diagnose: did recent crons mutate state_programs at all? ───────────────
{
  console.log('## Did recent state_programs cron runs actually change rows?')
  const { data } = await admin
    .from('cron_runs')
    .select('finished_at, status, summary')
    .eq('cron_name', 'refresh-data:state_programs')
    .order('finished_at', { ascending: false })
    .limit(8)
  if (!data?.length) {
    console.log('   no state_programs runs logged')
  } else {
    for (const r of data) {
      const s = typeof r.summary === 'string' ? JSON.parse(r.summary) : r.summary || {}
      // state_programs return shape (api/scrapers/_refresh-state-programs.js:212):
      //   states_checked, updates_applied, snapshots_written, verified, partial, no_match
      const stats = ` checked=${s.states_checked ?? '—'} updated=${s.updates_applied ?? '—'} snapshots=${s.snapshots_written ?? '—'} verified=${s.verified ?? '—'} partial=${s.partial ?? '—'} no_match=${s.no_match ?? '—'}`
      console.log(`   ${r.status === 'success' ? '✅' : '❌'} ${fmt(r.finished_at)}${stats}`)
    }
  }
  console.log()
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Verdict: if Dashboard ≠ Library, both are technically accurate but')
console.log(' they answer different questions. Dashboard tracks "did any cron')
console.log(' fire?", Library tracks "did the underlying program data change?".')
console.log('═══════════════════════════════════════════════════════════════════')
