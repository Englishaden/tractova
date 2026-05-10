/**
 * Lens API audit — wider state coverage (all 50 states + DC × Community Solar).
 *
 * Companion to audit-lens-matrix.mjs. The matrix audit varied state × tech
 * for depth across the most important markets (12 states); this audit varies
 * state only — 51 states × 1 tech — to catch any state-specific data
 * oddities that the deeper-but-narrower matrix missed.
 *
 * Why Community Solar: it's the most-exercised path in the codebase and
 * the buildContext output is most state-program-dependent. If a state's
 * curated data has a malformed row, the CS prompt is where it'll show.
 *
 * Cost: 51 calls × $0.04 = ~$2.00 (Sonnet 4.6 verdict).
 * Cache: MWs distributed 4.50–7.00 in unique increments so no state shares
 * a cache key with the previous matrix audit.
 *
 * Usage:
 *   node scripts/audit-lens-all-states.mjs                     # full 51
 *   node scripts/audit-lens-all-states.mjs --limit=10          # first 10 only
 *   node scripts/audit-lens-all-states.mjs --host=<url>        # alt target
 *
 * Exit code: 0 if success rate >= 90%, 1 otherwise.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Env loading ────────────────────────────────────────────────────────────
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
const TARGET_HOST  = args.host || 'https://www.tractova.com'
const COST_CAP_USD = 5.00
const COST_PER_CALL = 0.04

// All 50 states + DC, with a representative county for each. Counties are
// either ones we know exist in county_intelligence (limited) or plausible
// major counties — the Lens handler gracefully falls back on missing data
// per buildContext, so this is fine.
const STATES = [
  ['AL', 'Jefferson'],    ['AK', 'Anchorage'],     ['AZ', 'Maricopa'],
  ['AR', 'Pulaski'],      ['CA', 'Los Angeles'],   ['CO', 'Adams'],
  ['CT', 'Hartford'],     ['DE', 'New Castle'],    ['DC', 'District'],
  ['FL', 'Miami-Dade'],   ['GA', 'Fulton'],        ['HI', 'Honolulu'],
  ['ID', 'Ada'],          ['IL', 'Cook'],          ['IN', 'Marion'],
  ['IA', 'Polk'],         ['KS', 'Sedgwick'],      ['KY', 'Jefferson'],
  ['LA', 'Orleans'],      ['ME', 'Cumberland'],    ['MD', 'Anne Arundel'],
  ['MA', 'Hampshire'],    ['MI', 'Wayne'],         ['MN', 'Hennepin'],
  ['MS', 'Hinds'],        ['MO', 'St. Louis'],     ['MT', 'Yellowstone'],
  ['NE', 'Douglas'],      ['NV', 'Clark'],         ['NH', 'Hillsborough'],
  ['NJ', 'Burlington'],   ['NM', 'Bernalillo'],    ['NY', 'Albany'],
  ['NC', 'Mecklenburg'],  ['ND', 'Cass'],          ['OH', 'Franklin'],
  ['OK', 'Oklahoma'],     ['OR', 'Multnomah'],     ['PA', 'Allegheny'],
  ['RI', 'Providence'],   ['SC', 'Charleston'],    ['SD', 'Minnehaha'],
  ['TN', 'Davidson'],     ['TX', 'Harris'],        ['UT', 'Salt Lake'],
  ['VT', 'Chittenden'],   ['VA', 'Fairfax'],       ['WA', 'King'],
  ['WV', 'Kanawha'],      ['WI', 'Milwaukee'],     ['WY', 'Laramie'],
]
const LIMIT = args.limit ? parseInt(args.limit, 10) : STATES.length
const targets = STATES.slice(0, LIMIT)

// MW distribution: distinct per call so cache keys don't collide with the
// matrix audit's 4.50–6.06 / 0.13 increments. Pick 7.00 anchored, decrement
// by 0.07 (also coprime with 0.13 to avoid alignment).
targets.forEach((row, i) => { row.push(+(7.00 - i * 0.07).toFixed(2)) })

// ── Sign in ────────────────────────────────────────────────────────────────
const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supaAnon = process.env.VITE_SUPABASE_ANON_KEY
const supa = createClient(supaUrl, supaAnon, { auth: { persistSession: false } })
const { data: signIn, error: signInErr } = await supa.auth.signInWithPassword({
  email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD,
})
if (signInErr) { console.error('Sign-in failed:', signInErr.message); process.exit(1) }
const accessToken = signIn.session.access_token

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Lens API — all-states audit')
console.log(`   target: ${TARGET_HOST}`)
console.log(`   states: ${targets.length} (Community Solar, Site Control)`)
console.log(`   est cost: $${(targets.length * COST_PER_CALL).toFixed(2)}  (cap $${COST_CAP_USD})`)
console.log('═══════════════════════════════════════════════════════════════════\n')

// ── Run ────────────────────────────────────────────────────────────────────
const results = []
let runningCost = 0
for (let i = 0; i < targets.length; i++) {
  if (runningCost >= COST_CAP_USD) {
    console.warn(`\n  ⚠️  Cost cap $${COST_CAP_USD} reached after ${results.length} calls — aborting`)
    break
  }
  const [state, county, mw] = targets[i]
  const t0 = Date.now()
  let resp, text, payload, err = null
  try {
    resp = await fetch(`${TARGET_HOST}/api/lens-insight`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ state, county, mw, stage: 'Site Control', technology: 'Community Solar' }),
    })
    text = await resp.text()
    try { payload = JSON.parse(text) } catch { err = `non-JSON: ${text.slice(0, 200)}` }
  } catch (e) { err = e?.message || String(e) }
  const dur = Date.now() - t0

  const insight = payload?.insight
  const fields = insight ? ['brief','primaryRisk','topOpportunity','immediateAction','stageSpecificGuidance','competitiveContext'].filter(f => typeof insight[f] === 'string' && insight[f].length > 5).length : 0
  const valid = resp?.status === 200 && fields >= 5
  const cached = payload?.cached === true
  const reason = payload?.fallback ? `fallback:${payload.reason || 'unknown'}` : (resp?.status === 200 ? 'ok' : `http_${resp?.status}`)

  results.push({ state, county, mw, httpStatus: resp?.status ?? null, latencyMs: dur, valid, fields, reason, cached, error: err })
  if (!cached && resp?.status === 200) runningCost += COST_PER_CALL

  const flag = valid ? '✅' : (resp?.status === 200 ? '⚠️' : '❌')
  console.log(`  [${(i+1).toString().padStart(2)}/${targets.length}] ${flag} ${state}/${county.slice(0, 14).padEnd(14)} mw=${mw} ${dur.toString().padStart(5)}ms HTTP=${resp?.status} fields=${fields}/6 ${reason} ${cached ? '(cache)' : ''}`)
}

// ── Aggregate ──────────────────────────────────────────────────────────────
const valid = results.filter(r => r.valid).length
const successRate = (valid / results.length * 100)
const httpOk = results.filter(r => r.httpStatus === 200)
const lats = httpOk.map(r => r.latencyMs).sort((a, b) => a - b)
const p50 = lats.length ? lats[Math.floor(lats.length * 0.5)] : null
const p95 = lats.length ? lats[Math.floor(lats.length * 0.95)] : null
const cacheHits = results.filter(r => r.cached).length
const fallbacks = results.filter(r => r.reason.startsWith('fallback')).length
const httpFails = results.filter(r => r.httpStatus !== 200 && r.httpStatus !== null)

console.log('\n## Aggregate')
console.log(`  total:               ${results.length}`)
console.log(`  valid:               ${valid} (${successRate.toFixed(1)}%)`)
console.log(`  cache hits:          ${cacheHits}`)
console.log(`  fallbacks:           ${fallbacks}`)
console.log(`  HTTP failures:       ${httpFails.length}`)
console.log(`  latency p50:         ${p50} ms`)
console.log(`  latency p95:         ${p95} ms`)
console.log(`  est cost:            $${runningCost.toFixed(3)}`)

const issues = results.filter(r => !r.valid)
if (issues.length > 0) {
  console.log('\n## Issues')
  for (const r of issues) {
    console.log(`  ${r.state}/${r.county}: HTTP=${r.httpStatus} fields=${r.fields}/6 ${r.reason} ${r.latencyMs}ms`)
  }
}

// ── Persist ────────────────────────────────────────────────────────────────
const outDir = resolve(process.cwd(), '.audit')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outFile = resolve(outDir, `lens-all-states-${stamp}.json`)
writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), target: TARGET_HOST, results, runningCost, summary: { valid, total: results.length, successRate, p50, p95 } }, null, 2))
console.log(`\n## Raw: ${outFile}`)

console.log('═══════════════════════════════════════════════════════════════════')
const passed = successRate >= 90
console.log(passed
  ? ` ✅ PASS — ${successRate.toFixed(1)}% (≥90% threshold)`
  : ` ❌ FAIL — ${successRate.toFixed(1)}% (below 90%)`)
console.log('═══════════════════════════════════════════════════════════════════')
process.exit(passed ? 0 : 1)
