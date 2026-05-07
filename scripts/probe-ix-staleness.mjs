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

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: ixRows } = await admin.from('ix_queue_data').select('iso, fetched_at')
const ixByIso = {}
for (const r of ixRows || []) {
  if (!r.fetched_at) continue
  const ts = new Date(r.fetched_at).getTime()
  if (!ixByIso[r.iso] || ts > ixByIso[r.iso].newestTs) {
    ixByIso[r.iso] = { newestTs: ts, newestFetch: r.fetched_at }
  }
}

const now = Date.now()
console.log(`\nix_queue_data freshness per ISO:\n`)
for (const [iso, v] of Object.entries(ixByIso).sort((a, b) => a[0].localeCompare(b[0]))) {
  const age = Math.floor((now - v.newestTs) / 86400000)
  const flag = age > 7 ? '🔴 stale' : '✓ fresh'
  console.log(`  ${iso.padEnd(8)} newest_fetch=${v.newestFetch} (${age}d ago)  ${flag}`)
}

const { data: cronRows } = await admin
  .from('cron_runs')
  .select('cron_name, status, started_at, finished_at, duration_ms, summary')
  .eq('cron_name', 'ix-queue-refresh')
  .order('started_at', { ascending: false })
  .limit(5)

console.log(`\nLast 5 ix-queue-refresh runs:\n`)
for (const r of cronRows || []) {
  const summary = r.summary ? JSON.stringify(r.summary).slice(0, 120) : '—'
  console.log(`  ${r.status.padEnd(8)} ${r.started_at}  duration=${r.duration_ms}ms  ${summary}`)
}
