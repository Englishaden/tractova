/**
 * Diagnostic probe for policy_impact_events (migration 059).
 *
 * Reports:
 *   1. Table existence + total row count
 *   2. By-state distribution (published rows only)
 *   3. By-status counts (draft / pending_admin_review / published / rejected)
 *   4. Per-row summary for the most recent 5 published events
 *   5. Drafts in pending_admin_review queue (the AI-assist staging area)
 *
 * Usage:
 *   node scripts/probe-policy-impact.mjs
 *   node scripts/probe-policy-impact.mjs --state=ME
 *   node scripts/probe-policy-impact.mjs --pending      # show pending-review queue only
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

const args = Object.fromEntries(
  process.argv.slice(2)
    .map(a => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true])
)
const stateFilter   = args.state ? String(args.state).toUpperCase() : null
const pendingOnly   = !!args.pending

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : '—'
const fmtTs = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—'

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' policy_impact_events probe')
console.log(`   filter: ${stateFilter || 'all states'}${pendingOnly ? '  pending-review only' : ''}`)
console.log('═══════════════════════════════════════════════════════════════════\n')

// ── 1. Table existence + total count ──────────────────────────────────────
const { count: total, error: countErr } = await admin
  .from('policy_impact_events')
  .select('*', { count: 'exact', head: true })

if (countErr) {
  if (countErr.code === 'PGRST116' || /relation .* does not exist/i.test(countErr.message)) {
    console.error('❌ Table policy_impact_events does not exist.')
    console.error('   Apply migration 059_policy_impact_events.sql via Supabase SQL editor.')
    process.exit(1)
  }
  console.error('query failed:', countErr.message)
  process.exit(1)
}

console.log(`Total rows: ${total}`)

if (total === 0) {
  console.log('\n(empty — seed Maine LD 1777 + others via /admin → Policy Impact tab)')
  process.exit(0)
}

// ── 2. By-state distribution (published) ──────────────────────────────────
{
  const { data } = await admin
    .from('policy_impact_events')
    .select('state, review_status, is_active')
  const pubByState = {}
  for (const r of data || []) {
    if (r.is_active && r.review_status === 'published') {
      pubByState[r.state] = (pubByState[r.state] || 0) + 1
    }
  }
  console.log('\nPublished rows by state:')
  for (const [s, n] of Object.entries(pubByState).sort()) {
    console.log(`  ${s}: ${n}`)
  }
  if (Object.keys(pubByState).length === 0) console.log('  (none published yet)')
}

// ── 3. By-status counts ───────────────────────────────────────────────────
{
  const { data } = await admin
    .from('policy_impact_events')
    .select('review_status, is_active')
  const counts = {}
  for (const r of data || []) {
    const k = `${r.review_status}${r.is_active ? '' : ' (inactive)'}`
    counts[k] = (counts[k] || 0) + 1
  }
  console.log('\nBy review status:')
  for (const [k, n] of Object.entries(counts).sort()) {
    console.log(`  ${k.padEnd(30)} ${n}`)
  }
}

// ── 4. Recent published events ────────────────────────────────────────────
if (!pendingOnly) {
  let q = admin.from('policy_impact_events')
    .select('id, state, event_name, event_type, pillar, effective_date, capex_impact_per_mw_usd, irr_impact_bps, ongoing_fee_per_mw_yr_usd, revenue_haircut_pct, impact_confidence, safe_harbor_eligible, safe_harbor_cutoff_date, feoc_compliance_required, verified_at, summary')
    .eq('is_active', true)
    .eq('review_status', 'published')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(5)
  if (stateFilter) q = q.eq('state', stateFilter)
  const { data } = await q
  if (data && data.length > 0) {
    console.log('\nMost recent 5 published events:')
    for (const r of data) {
      console.log(`\n  ${r.state} · ${r.event_name} (${r.event_type})`)
      console.log(`    effective: ${fmt(r.effective_date)} · pillar=${r.pillar} · confidence=${r.impact_confidence || '—'}`)
      const impact = [
        r.capex_impact_per_mw_usd != null   && `capex=${r.capex_impact_per_mw_usd > 0 ? '+' : ''}$${r.capex_impact_per_mw_usd.toLocaleString()}/MW`,
        r.irr_impact_bps != null            && `irr=${r.irr_impact_bps > 0 ? '+' : ''}${r.irr_impact_bps}bps`,
        r.ongoing_fee_per_mw_yr_usd != null && `ongoing=$${r.ongoing_fee_per_mw_yr_usd.toLocaleString()}/MW/yr`,
        r.revenue_haircut_pct != null       && `rev=${r.revenue_haircut_pct > 0 ? '−' : '+'}${Math.abs(r.revenue_haircut_pct)}%`,
      ].filter(Boolean).join(' · ')
      console.log(`    impact:    ${impact || '(no quantified impact set)'}`)
      console.log(`    safe-harbor: ${r.safe_harbor_eligible ? `yes, cutoff=${fmt(r.safe_harbor_cutoff_date)}` : 'no'} · FEOC: ${r.feoc_compliance_required ? 'required' : 'no'}`)
      console.log(`    verified:    ${fmtTs(r.verified_at)}`)
      console.log(`    summary:     ${(r.summary || '').slice(0, 140)}`)
    }
  } else {
    console.log('\n(no published events match filter)')
  }
}

// ── 5. Pending-review queue ───────────────────────────────────────────────
{
  let q = admin.from('policy_impact_events')
    .select('id, state, event_name, event_type, discovered_via, summary, created_at, discovery_metadata')
    .eq('review_status', 'pending_admin_review')
    .order('created_at', { ascending: false })
    .limit(10)
  if (stateFilter) q = q.eq('state', stateFilter)
  const { data } = await q
  if (data && data.length > 0) {
    console.log('\n⚠️  Pending admin review queue:')
    for (const r of data) {
      console.log(`  ${r.state} · ${r.event_name} (${r.event_type}) via ${r.discovered_via}`)
      console.log(`     created: ${fmtTs(r.created_at)}`)
      console.log(`     summary: ${(r.summary || '').slice(0, 120)}`)
      const meta = r.discovery_metadata
      if (meta?.news_feed_id) console.log(`     source:  news_feed/${meta.news_feed_id}`)
    }
  } else if (pendingOnly) {
    console.log('\n(no pending-review drafts)')
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════')
