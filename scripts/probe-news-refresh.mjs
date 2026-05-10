/**
 * One-shot: probe news_feed + cron_runs to answer "is the news refresh actually
 * working?" — independent of what BUILD_LOG.md or vercel.json claim.
 *
 * Reports:
 *   1. Last 10 cron_runs entries where source='news' (when, ok, summary)
 *   2. news_feed total row count + auto_classified vs manual breakdown
 *   3. Inserted-this-week count (last 7d by created_at if present, else
 *      published_at fallback)
 *   4. Latest 5 inserts with auto_classified flag + relevance_score
 *   5. Per-RSS-source: most-recent published_at per news_feed.source
 *   6. Staleness: hours since last successful cron run vs the weekly
 *      Sun-07:00-UTC cadence (vercel.json:69-72)
 *
 * Usage:  node scripts/probe-news-refresh.mjs
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
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}
function hoursAgo(d) {
  if (!d) return '—'
  return ((Date.now() - new Date(d).getTime()) / 3_600_000).toFixed(1) + 'h'
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Tractova news-refresh probe')
console.log(`  now: ${fmtDate(new Date())}`)
console.log('═══════════════════════════════════════════════════════════════════\n')

// ── 1. cron_runs for source='news' ─────────────────────────────────────────
{
  const { data, error } = await admin
    .from('cron_runs')
    .select('id, cron_name, status, started_at, finished_at, duration_ms, summary')
    .eq('cron_name', 'refresh-data:news')
    .order('started_at', { ascending: false })
    .limit(10)
  if (error) { console.error('cron_runs query failed:', error.message); process.exit(1) }
  console.log('## 1. Last 10 cron_runs (cron_name=refresh-data:news)')
  if (!data || data.length === 0) {
    console.log('   ⚠️  NO ROWS. The news cron has never logged to cron_runs.')
  } else {
    for (const r of data) {
      const flag = r.status === 'success' ? '✅' : '❌'
      const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'
      const s = (() => {
        if (!r.summary) return {}
        return typeof r.summary === 'string' ? JSON.parse(r.summary) : r.summary
      })()
      const summ = ` ins=${s.inserted ?? '—'} cls=${s.ai_classified ?? '—'} novel=${s.novel_candidates ?? '—'} dup=${s.already_known_skipped ?? '—'} fetched=${s.rss_items_fetched ?? '—'} aiErr=${s.ai_errors ?? '—'}`
      const auth = s.auth_mode ? ` auth=${s.auth_mode}` : ''
      const errSnip = s.error ? ` err=${String(s.error).slice(0, 80)}` : ''
      console.log(`  ${flag} ${fmtDate(r.started_at)} (${hoursAgo(r.started_at)} ago) ${dur}${auth}${summ}${errSnip}`)
    }
  }
  console.log()
}

// ── 2. news_feed totals ────────────────────────────────────────────────────
{
  const { count: total } = await admin.from('news_feed').select('*', { count: 'exact', head: true })
  const { count: auto } = await admin.from('news_feed').select('*', { count: 'exact', head: true }).eq('auto_classified', true)
  const { count: manual } = await admin.from('news_feed').select('*', { count: 'exact', head: true }).or('auto_classified.is.false,auto_classified.is.null')
  const { count: active } = await admin.from('news_feed').select('*', { count: 'exact', head: true }).eq('is_active', true)
  console.log('## 2. news_feed totals')
  console.log(`   total:           ${total ?? '?'}`)
  console.log(`   auto-classified: ${auto ?? '?'}`)
  console.log(`   manual / null:   ${manual ?? '?'}`)
  console.log(`   is_active=true:  ${active ?? '?'}`)
  console.log()
}

// ── 3. Inserted-this-week (Policy Pulse denominator) ───────────────────────
{
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const { count: lastWeek } = await admin
    .from('news_feed')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', sevenDaysAgo)
    .eq('is_active', true)
  console.log('## 3. Policy Pulse this-week count')
  console.log(`   published_at >= ${sevenDaysAgo} AND is_active: ${lastWeek ?? '?'}`)
  console.log('   (this is the number rendered on the dashboard tile)')
  console.log()
}

// ── 4. Latest 5 inserts ────────────────────────────────────────────────────
{
  const { data, error } = await admin
    .from('news_feed')
    .select('headline, source, published_at, auto_classified, relevance_score, last_seen_at, pillar')
    .order('published_at', { ascending: false })
    .limit(5)
  if (error) { console.error('news_feed query failed:', error.message); process.exit(1) }
  console.log('## 4. Latest 5 news_feed rows by published_at')
  if (!data || data.length === 0) {
    console.log('   ⚠️  NO ROWS in news_feed.')
  } else {
    for (const r of data) {
      const auto = r.auto_classified ? 'auto' : 'man '
      const score = r.relevance_score != null ? `r=${r.relevance_score}` : 'r=—'
      console.log(`  ${r.published_at} [${auto}] [${r.pillar ?? '—'}] ${score} :: ${(r.headline || '').slice(0, 80)}`)
      console.log(`            src=${r.source} last_seen=${fmtDate(r.last_seen_at)}`)
    }
  }
  console.log()
}

// ── 5. Per-RSS-source freshness ────────────────────────────────────────────
{
  // Source list mirrors api/scrapers/_refresh-news.js RSS_SOURCES.
  // 2026-05-10: Solar Industry Mag dropped (host unresponsive), PV-Tech added.
  const sources = ['PV Magazine USA', 'PV-Tech', 'Utility Dive', 'Solar Power World']
  console.log('## 5. Per-RSS-source most-recent published_at')
  for (const src of sources) {
    const { data } = await admin
      .from('news_feed')
      .select('published_at, last_seen_at, headline')
      .eq('source', src)
      .order('published_at', { ascending: false })
      .limit(1)
    const r = data?.[0]
    if (!r) {
      console.log(`   ${src.padEnd(22)} ⚠️  no rows ever`)
    } else {
      console.log(`   ${src.padEnd(22)} pub=${r.published_at} seen=${fmtDate(r.last_seen_at)} :: ${(r.headline || '').slice(0, 50)}`)
    }
  }
  console.log()
}

// ── 6. Staleness vs weekly cadence ─────────────────────────────────────────
{
  const { data } = await admin
    .from('cron_runs')
    .select('started_at, status')
    .eq('cron_name', 'refresh-data:news')
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
  const last = data?.[0]
  console.log('## 6. Staleness vs weekly Sun-07:00-UTC cadence')
  if (!last) {
    console.log('   ⚠️  No SUCCESSFUL news cron run on record.')
  } else {
    const hrs = (Date.now() - new Date(last.started_at).getTime()) / 3_600_000
    const verdict = hrs < 24 ? '✅ very fresh' : hrs < 24 * 8 ? '✅ within weekly window' : '⚠️  STALE — past one cadence'
    console.log(`   last successful: ${fmtDate(last.started_at)}`)
    console.log(`   age:             ${hrs.toFixed(1)}h  ${verdict}`)
  }
  console.log()
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Done.')
console.log('═══════════════════════════════════════════════════════════════════')
