/**
 * Lens API audit — n=32 matrix across state × tech for the Pre-Onboarding
 * full-site audit. Hits PROD (https://www.tractova.com) since /api/* isn't
 * proxied by Vite in local dev. Read-only — only cost is Anthropic tokens.
 *
 * What it does:
 *   1. Loads .env.local, signs in as TEST_USER via Supabase, captures JWT.
 *   2. Iterates a curated 32-call matrix:
 *      - Tier 1: 5 states × 4 tech types  = 20
 *      - Tier 2: 5 states × 2 tech types  = 10
 *      - Edge:   2 states (cs_status none/pending) × 1 tech = 2
 *   3. Varies MW per call (4.50–6.06 MW in 0.13 increments) to dodge the
 *      6-hour Supabase response cache (cache key includes rounded MW).
 *   4. POST /api/lens-insight per call, captures status/latency/shape.
 *   5. Aggregates: success rate, p50/p95 latency, by-state, by-tech,
 *      fallback breakdown, cache hit rate.
 *   6. Optional: 5 sensitivity + 1 portfolio + 1 compare to probe the
 *      other action paths (skipped if --verdict-only flag passed).
 *
 * Usage:
 *   node scripts/audit-lens-matrix.mjs                  # full audit
 *   node scripts/audit-lens-matrix.mjs --verdict-only   # skip extras
 *   node scripts/audit-lens-matrix.mjs --host=http://localhost:5173  # local
 *
 * Cost guard: hard $5 cap. Each call estimated at $0.04 (Sonnet 4.6,
 * ~5K input × $3/MTok + ~1.2K output × $15/MTok). Cached calls cost $0.
 * Aborts mid-run if running estimate exceeds cap.
 *
 * Exit code: 0 if success rate >= 90%, 1 otherwise.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Env loading (matches scripts/probe-*.mjs pattern) ──────────────────────
const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (process.env[k] === undefined) process.env[k] = v
}

// ── Args ───────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .map(a => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true])
)
const TARGET_HOST  = args.host || 'https://www.tractova.com'
const VERDICT_ONLY = !!args['verdict-only']
const COST_CAP_USD = 5.00
const COST_PER_CALL = 0.04          // Sonnet 4.6 verdict est.
const COST_PER_SENS = 0.012         // 200 max-out
const COST_PER_PORT = 0.025         // 600 max-out
const COST_PER_CMP  = 0.020         // 500 max-out

// ── Matrix ─────────────────────────────────────────────────────────────────
const COUNTIES = {
  CA: 'Los Angeles', IL: 'Cook',         MA: 'Hampshire',  NY: 'Albany',     TX: 'Harris',
  NJ: 'Burlington',  MD: 'Anne Arundel', PA: 'Allegheny',  CO: 'Adams',      AZ: 'Maricopa',
  AL: 'Jefferson',   MI: 'Wayne',
}
const TIER_1 = ['CA','IL','MA','NY','TX']
const TIER_2 = ['NJ','MD','PA','CO','AZ']
const EDGE   = ['AL','MI']
const TIER_1_TECH = ['Community Solar','BESS','C&I Solar','Hybrid']
const TIER_2_TECH = ['Community Solar','BESS']
const EDGE_TECH   = { AL: 'Community Solar', MI: 'Community Solar' }
const STAGE = 'Site Control'

const matrix = []
for (const s of TIER_1) for (const t of TIER_1_TECH) matrix.push({ state: s, technology: t, tier: 'tier1' })
for (const s of TIER_2) for (const t of TIER_2_TECH) matrix.push({ state: s, technology: t, tier: 'tier2' })
for (const s of EDGE)                                matrix.push({ state: s, technology: EDGE_TECH[s], tier: 'edge' })
matrix.forEach((row, i) => { row.mw = +(4.50 + (i % 13) * 0.13).toFixed(2) })

// ── Sign in ────────────────────────────────────────────────────────────────
const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supaAnon = process.env.VITE_SUPABASE_ANON_KEY
if (!supaUrl || !supaAnon) { console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'); process.exit(1) }
const supa = createClient(supaUrl, supaAnon, { auth: { persistSession: false } })

const email = process.env.TEST_USER_EMAIL
const pw    = process.env.TEST_USER_PASSWORD
if (!email || !pw) { console.error('Missing TEST_USER_EMAIL or TEST_USER_PASSWORD'); process.exit(1) }

console.log('═══════════════════════════════════════════════════════════════════')
console.log(' Lens API matrix audit')
console.log(`   target: ${TARGET_HOST}`)
console.log(`   matrix: ${matrix.length} verdict calls (${TIER_1.length}×${TIER_1_TECH.length} + ${TIER_2.length}×${TIER_2_TECH.length} + ${EDGE.length} edge)`)
console.log(`   extras: ${VERDICT_ONLY ? 'skipped (--verdict-only)' : '5 sensitivity + 1 portfolio + 1 compare'}`)
console.log(`   budget: $${COST_CAP_USD.toFixed(2)} hard cap`)
console.log('═══════════════════════════════════════════════════════════════════\n')

console.log(`Signing in as ${email}...`)
const { data: signInData, error: signInErr } = await supa.auth.signInWithPassword({ email, password: pw })
if (signInErr || !signInData?.session?.access_token) {
  console.error(`Sign-in failed: ${signInErr?.message || 'no session'}`)
  process.exit(1)
}
const accessToken = signInData.session.access_token
console.log('  ✓ JWT captured\n')

// ── Helpers ────────────────────────────────────────────────────────────────
async function lensCall(body, action = null) {
  const t0 = Date.now()
  const fullBody = action ? { action, ...body } : body
  let resp, text, payload, err = null
  try {
    resp = await fetch(`${TARGET_HOST}/api/lens-insight`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify(fullBody),
    })
    text = await resp.text()
    try { payload = JSON.parse(text) } catch { err = `non-JSON: ${text.slice(0, 200)}` }
  } catch (e) { err = e?.message || String(e) }
  return {
    httpStatus: resp?.status ?? null,
    latencyMs:  Date.now() - t0,
    payload,
    error:      err,
    rawText:    text?.slice(0, 500) || null,
  }
}

function validateVerdictShape(payload) {
  if (!payload) return { valid: false, fieldsPresent: 0, reason: 'no-payload' }
  if (payload.fallback) return { valid: false, fieldsPresent: 0, reason: `fallback:${payload.reason || 'unknown'}` }
  const insight = payload.insight
  if (!insight) return { valid: false, fieldsPresent: 0, reason: 'no-insight-block' }
  const expected = ['brief','primaryRisk','topOpportunity','immediateAction','stageSpecificGuidance','competitiveContext']
  const fieldsPresent = expected.filter(f => typeof insight[f] === 'string' && insight[f].trim().length > 5).length
  return { valid: fieldsPresent >= 5, fieldsPresent, reason: fieldsPresent >= 5 ? 'ok' : `only-${fieldsPresent}-fields` }
}

function fmt(n, d = 0) { return n != null ? Number(n).toFixed(d) : '—' }

// ── Run verdict matrix ─────────────────────────────────────────────────────
console.log('## Verdict matrix')
const verdictResults = []
let runningCost = 0
for (let i = 0; i < matrix.length; i++) {
  const row = matrix[i]
  if (runningCost >= COST_CAP_USD) {
    console.log(`\n  ⚠️  Cost cap $${COST_CAP_USD} reached after ${verdictResults.length} calls — aborting matrix`)
    break
  }
  const body = {
    state:      row.state,
    county:     COUNTIES[row.state] || 'Default',
    mw:         row.mw,
    stage:      STAGE,
    technology: row.technology,
  }
  const r = await lensCall(body)
  const shape = validateVerdictShape(r.payload)
  const cached = r.payload?.cached === true
  if (!cached && r.httpStatus === 200) runningCost += COST_PER_CALL
  verdictResults.push({ ...row, ...r, ...shape, cached, body })
  const techShort = row.technology.replace('Community ', 'CS ').slice(0, 8).padEnd(8)
  const status = r.httpStatus === 200 ? '✅' : '❌'
  const cacheTag = cached ? '(cache)' : ''
  console.log(`  [${(i+1).toString().padStart(2)}/${matrix.length}] ${status} ${row.state}/${techShort} mw=${row.mw} ${r.latencyMs}ms HTTP=${r.httpStatus} fields=${shape.fieldsPresent}/6 ${shape.reason} ${cacheTag}`)
}

// ── Aggregate ──────────────────────────────────────────────────────────────
function summarize(results) {
  const valid = results.filter(r => r.valid)
  const httpOk = results.filter(r => r.httpStatus === 200)
  const successRate = results.length ? (valid.length / results.length * 100) : 0
  const lats = httpOk.map(r => r.latencyMs).sort((a, b) => a - b)
  const p50 = lats.length ? lats[Math.floor(lats.length * 0.50)] : null
  const p95 = lats.length ? lats[Math.floor(lats.length * 0.95)] : null
  const cacheHits = results.filter(r => r.cached).length
  const fallbacks = results.filter(r => r.payload?.fallback).map(r => r.payload?.reason || 'unknown')
  const fallbackCounts = {}
  for (const f of fallbacks) fallbackCounts[f] = (fallbackCounts[f] || 0) + 1
  const httpFails = results.filter(r => r.httpStatus !== 200 && r.httpStatus !== null)
  const httpFailCounts = {}
  for (const r of httpFails) {
    const k = `HTTP ${r.httpStatus}`
    httpFailCounts[k] = (httpFailCounts[k] || 0) + 1
  }
  const exceptions = results.filter(r => r.httpStatus === null && r.error)
  return { valid: valid.length, total: results.length, successRate, p50, p95, cacheHits, fallbackCounts, httpFailCounts, exceptions }
}

const summary = summarize(verdictResults)

console.log('\n## Aggregate')
console.log(`  total calls:         ${summary.total}`)
console.log(`  valid (≥5/6 fields): ${summary.valid} (${summary.successRate.toFixed(1)}%)`)
console.log(`  cache hits:          ${summary.cacheHits} (${verdictResults.length ? (summary.cacheHits/verdictResults.length*100).toFixed(1) : 0}%)`)
console.log(`  latency p50:         ${fmt(summary.p50)} ms`)
console.log(`  latency p95:         ${fmt(summary.p95)} ms`)
console.log(`  est cost:            $${runningCost.toFixed(3)}`)

if (Object.keys(summary.fallbackCounts).length > 0) {
  console.log('\n  fallbacks:')
  for (const [reason, n] of Object.entries(summary.fallbackCounts)) console.log(`    ${reason.padEnd(30)} ${n}`)
}
if (Object.keys(summary.httpFailCounts).length > 0) {
  console.log('\n  HTTP failures:')
  for (const [code, n] of Object.entries(summary.httpFailCounts)) console.log(`    ${code.padEnd(30)} ${n}`)
}
if (summary.exceptions.length > 0) {
  console.log('\n  exceptions:')
  for (const r of summary.exceptions.slice(0, 5)) console.log(`    ${r.state}/${r.technology}: ${r.error?.slice(0, 100)}`)
}

console.log('\n## By state')
const byState = {}
for (const r of verdictResults) {
  if (!byState[r.state]) byState[r.state] = []
  byState[r.state].push(r)
}
for (const [state, rs] of Object.entries(byState)) {
  const valid = rs.filter(r => r.valid).length
  const lats = rs.filter(r => r.httpStatus === 200).map(r => r.latencyMs)
  const meanLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0
  console.log(`  ${state}: ${valid}/${rs.length} valid, mean=${fmt(meanLat)}ms`)
}

console.log('\n## By technology')
const byTech = {}
for (const r of verdictResults) {
  if (!byTech[r.technology]) byTech[r.technology] = []
  byTech[r.technology].push(r)
}
for (const [tech, rs] of Object.entries(byTech)) {
  const valid = rs.filter(r => r.valid).length
  console.log(`  ${tech.padEnd(18)} ${valid}/${rs.length} valid`)
}

// ── Optional extras: sensitivity + portfolio + compare ─────────────────────
let extrasResults = { sensitivity: [], portfolio: null, compare: null }
if (!VERDICT_ONLY && runningCost < COST_CAP_USD) {
  console.log('\n## Extras')

  // 5 sensitivity calls — pick the first 5 verdict rows
  console.log('  sensitivity (5):')
  for (const v of verdictResults.slice(0, 5)) {
    if (runningCost >= COST_CAP_USD) break
    const r = await lensCall({
      state: v.state, county: v.body.county, mw: v.body.mw, stage: STAGE, technology: v.technology,
      scenario: 'IX queue 2x slower', override: { ix: -10 }, baseScore: 60, newScore: 55,
    }, 'sensitivity')
    if (r.httpStatus === 200) runningCost += COST_PER_SENS
    const ratLen = r.payload?.rationale?.length || 0
    extrasResults.sensitivity.push({ ...v, ...r, ratLen })
    console.log(`    ${v.state}/${v.technology.slice(0,4)} ${r.latencyMs}ms HTTP=${r.httpStatus} rationale_len=${ratLen}`)
  }

  // 1 portfolio call — fake projects
  if (runningCost < COST_CAP_USD) {
    console.log('  portfolio (1):')
    const projects = verdictResults.slice(0, 4).map(v => ({
      name: `${v.state}-${v.technology}-test`, state: v.state, county: v.body.county,
      mw: v.mw, stage: STAGE, score: 60, ixDifficulty: 'moderate', csStatus: 'active',
    }))
    const r = await lensCall({ projects }, 'portfolio')
    if (r.httpStatus === 200) runningCost += COST_PER_PORT
    extrasResults.portfolio = { ...r, projectCount: projects.length, summaryLen: r.payload?.summary?.length || 0 }
    console.log(`    n=${projects.length} ${r.latencyMs}ms HTTP=${r.httpStatus} summary_len=${extrasResults.portfolio.summaryLen}`)
  }

  // 1 compare call
  if (runningCost < COST_CAP_USD) {
    console.log('  compare (1):')
    const projects = verdictResults.slice(0, 3).map(v => ({
      name: `${v.state}-cmp`, state: v.state, county: v.body.county,
      mw: v.mw, stage: STAGE, score: 60, ixDifficulty: 'moderate', csStatus: 'active',
    }))
    const r = await lensCall({ projects }, 'compare')
    if (r.httpStatus === 200) runningCost += COST_PER_CMP
    extrasResults.compare = { ...r, projectCount: projects.length, comparisonLen: r.payload?.comparison?.length || 0 }
    console.log(`    n=${projects.length} ${r.latencyMs}ms HTTP=${r.httpStatus} comparison_len=${extrasResults.compare.comparisonLen}`)
  }
}

// ── Persist raw results for the findings doc ───────────────────────────────
const outDir = resolve(process.cwd(), '.audit')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outFile = resolve(outDir, `lens-matrix-${stamp}.json`)
writeFileSync(outFile, JSON.stringify({
  ranAt:        new Date().toISOString(),
  targetHost:   TARGET_HOST,
  matrix,
  verdictResults,
  extrasResults,
  summary,
  runningCost,
}, null, 2))

console.log(`\n## Total cost (estimated): $${runningCost.toFixed(3)}`)
console.log(`## Raw results: ${outFile}`)
console.log('═══════════════════════════════════════════════════════════════════')

const passed = summary.successRate >= 90
console.log(passed
  ? ` ✅ PASS — ${summary.successRate.toFixed(1)}% success rate (≥90% threshold)`
  : ` ❌ FAIL — ${summary.successRate.toFixed(1)}% success rate (below 90% threshold)`)
console.log('═══════════════════════════════════════════════════════════════════')

process.exit(passed ? 0 : 1)
