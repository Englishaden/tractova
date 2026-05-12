/**
 * Diagnostic probe for saved_comparisons (migration 062).
 *
 * Reports:
 *   1. Table existence + total row count
 *   2. RLS policies (sanity check the four own-rows policies are in place)
 *   3. Per-user row distribution (counts only — no row content unless --dump)
 *   4. Most-recent 5 saved comparisons (name + item count + age)
 *
 * Usage:
 *   node scripts/probe-saved-comparisons.mjs
 *   node scripts/probe-saved-comparisons.mjs --dump      # include item_ids + first snapshot row
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
const dump = !!args.dump

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const fmtTs = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—'
const ageDays = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' saved_comparisons probe (migration 062)')
console.log('═══════════════════════════════════════════════════════════════════\n')

// ── 1. Table existence + total count ──────────────────────────────────────
const { count: total, error: countErr } = await admin
  .from('saved_comparisons')
  .select('*', { count: 'exact', head: true })

if (countErr) {
  if (countErr.code === 'PGRST116' || /relation .* does not exist/i.test(countErr.message)) {
    console.error('❌ Table saved_comparisons does not exist.')
    console.error('   Apply migration 062_saved_comparisons.sql via the Supabase SQL editor.')
    process.exit(1)
  }
  console.error('query failed:', countErr.message)
  process.exit(1)
}

console.log(`Total rows: ${total}`)

// ── 2. RLS policies ───────────────────────────────────────────────────────
{
  const { data, error } = await admin
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'saved_comparisons')
  if (error) {
    console.log('\nRLS policies: (could not read pg_policies — service-role may not expose it)')
  } else {
    const expected = ['users read own saved comparisons', 'users insert own saved comparisons', 'users update own saved comparisons', 'users delete own saved comparisons']
    const found = (data || []).map(p => p.policyname)
    console.log('\nRLS policies:')
    for (const name of expected) {
      const has = found.includes(name)
      console.log(`  ${has ? '✓' : '✗'} ${name}`)
    }
  }
}

if (total === 0) {
  console.log('\n(empty — save a comparison from the Compare tray to populate)')
  process.exit(0)
}

// ── 3. Per-user distribution (counts only) ────────────────────────────────
{
  const { data } = await admin
    .from('saved_comparisons')
    .select('user_id')
  const perUser = {}
  for (const r of data || []) perUser[r.user_id] = (perUser[r.user_id] || 0) + 1
  console.log('\nPer-user counts:')
  for (const [u, n] of Object.entries(perUser).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${u.slice(0, 8)}…  ${n}`)
  }
  if (Object.keys(perUser).length > 10) console.log(`  …and ${Object.keys(perUser).length - 10} more`)
}

// ── 4. Most-recent 5 saved comparisons ────────────────────────────────────
{
  const { data } = await admin
    .from('saved_comparisons')
    .select('id, user_id, name, item_ids, snapshot, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5)
  if (data?.length) {
    console.log('\nMost-recent 5:')
    for (const r of data) {
      const days = ageDays(r.updated_at)
      console.log(`\n  ${r.name}  ·  ${r.item_ids?.length || 0} items  ·  ${days === 0 ? 'today' : `${days}d ago`}`)
      console.log(`    id:       ${r.id}`)
      console.log(`    user:     ${r.user_id.slice(0, 8)}…`)
      console.log(`    created:  ${fmtTs(r.created_at)}`)
      console.log(`    updated:  ${fmtTs(r.updated_at)}`)
      if (dump) {
        console.log(`    item_ids: ${(r.item_ids || []).join(', ')}`)
        const first = Array.isArray(r.snapshot) && r.snapshot[0]
        if (first) {
          console.log(`    first snapshot row: name=${first.name}, state=${first.state}, mw=${first.mw}, score=${first.feasibilityScore}`)
        }
      }
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════')
