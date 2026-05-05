/**
 * Option 2 — Audit `state_programs.cs_status` against actual CS deployment
 * from `cs_projects` (NREL Sharing the Sun ~4,280 operating projects).
 *
 * Question this answers: "Which states have curated cs_status that doesn't
 * match the operational reality?" Output is a flagged list + severity
 * suggestions so Aden can triage.
 *
 *   Usage:  node scripts/audit-cs-status-vs-deployment.mjs
 *           node scripts/audit-cs-status-vs-deployment.mjs --json   # machine-readable for /admin surfacing
 *
 * Heuristic flags (tunable):
 *   cs_status='active'  && operational_mw < 5   → DEAD MARKET (active label is misleading)
 *   cs_status='limited' && operational_mw > 500 → STRONG MARKET (limited label understates)
 *   cs_status='none'    && operational_mw > 50  → MISSING (state needs curation)
 *   cs_status='active'  && operational_mw > 500 → reality-check OK (no flag)
 *   cs_status='limited' && operational_mw < 50  → reality-check OK (no flag)
 *
 * The thresholds (5 / 50 / 500 MW) are deliberately wide — we want to flag
 * obvious mismatches, not every 50-MW edge case. Tune after first run.
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

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const args = process.argv.slice(2)
const JSON_OUTPUT = args.includes('--json')

// ── Thresholds ────────────────────────────────────────────────────────────
const DEAD_MARKET_MW           = 5      // cs_status='active' but operational MW below this → flag
const STRONG_MARKET_MW         = 500    // cs_status='limited' but above this → flag
const MISSING_CURATION_MW      = 50     // cs_status='none' (or no row) but above this → flag
const RECENT_ACTIVITY_YEARS    = 5      // years to count "recent" installs

// ── Pull data ─────────────────────────────────────────────────────────────
// cs_projects has ~4,280 rows; Supabase default page is 1000. Paginate
// explicitly to avoid silent truncation.
async function fetchAllProjects() {
  const all = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin.from('cs_projects')
      .select('state, system_size_mw_ac, vintage_year')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}

let projects, programs
try {
  const [p, programsRes] = await Promise.all([
    fetchAllProjects(),
    admin.from('state_programs').select('id, name, cs_status, capacity_mw, last_verified'),
  ])
  if (programsRes.error) throw new Error(programsRes.error.message)
  projects = p
  programs = programsRes.data || []
} catch (e) {
  console.error(`fetch failed: ${e.message}`)
  process.exit(1)
}
const programMap = new Map(programs.map(p => [p.id, p]))

// ── Per-state aggregation from cs_projects ────────────────────────────────
const currentYear = Math.max(...projects.map(p => p.vintage_year || 0))
const recentYearFloor = currentYear - RECENT_ACTIVITY_YEARS

const byState = new Map()
for (const p of projects) {
  const st = p.state
  if (!byState.has(st)) byState.set(st, { count: 0, totalMw: 0, recentCount: 0, recentMw: 0, latestYear: 0 })
  const b = byState.get(st)
  b.count++
  const mw = Number(p.system_size_mw_ac) || 0
  b.totalMw += mw
  if (p.vintage_year && p.vintage_year > b.latestYear) b.latestYear = p.vintage_year
  if (p.vintage_year && p.vintage_year >= recentYearFloor) {
    b.recentCount++
    b.recentMw += mw
  }
}

// ── Collect every state present in either dataset ─────────────────────────
const allStates = new Set([
  ...byState.keys(),
  ...programs.map(p => p.id),
])

// ── Audit each state ──────────────────────────────────────────────────────
const findings = []
for (const st of allStates) {
  const sp = programMap.get(st)
  const csStatus = sp?.cs_status || 'none'  // 'none' if state isn't in state_programs at all
  const ops = byState.get(st) || { count: 0, totalMw: 0, recentCount: 0, recentMw: 0, latestYear: null }
  const totalMw = Number(ops.totalMw.toFixed(1))
  const recentMw = Number(ops.recentMw.toFixed(1))

  let flag = null
  let suggestion = null
  let severity = null

  if (csStatus === 'active' && totalMw < DEAD_MARKET_MW) {
    flag = 'DEAD_MARKET'
    suggestion = `cs_status='active' but only ${totalMw} MW operational across ${ops.count} project(s). Likely should be 'limited' or 'none'.`
    severity = 'high'
  } else if (csStatus === 'limited' && totalMw > STRONG_MARKET_MW) {
    flag = 'STRONG_MARKET'
    suggestion = `cs_status='limited' but ${totalMw} MW operational across ${ops.count} projects. Market is active despite the 'limited' label — review whether 'active' fits.`
    severity = 'high'
  } else if (csStatus === 'none' && totalMw > MISSING_CURATION_MW) {
    flag = sp ? 'MISSING_STATUS' : 'MISSING_FROM_CURATION'
    suggestion = sp
      ? `cs_status='none' but ${totalMw} MW operational across ${ops.count} projects. State has real CS deployment that the curated label denies.`
      : `State not in state_programs but has ${totalMw} MW operational across ${ops.count} projects. Add to curation queue.`
    severity = totalMw > 500 ? 'high' : 'medium'
  } else if (csStatus === 'active' && totalMw < 50 && ops.recentCount === 0) {
    flag = 'STALE_MARKET'
    suggestion = `cs_status='active' but no installs in last ${RECENT_ACTIVITY_YEARS} years (latest ${ops.latestYear || '—'}). Market may be dormant.`
    severity = 'medium'
  }

  findings.push({
    state: st,
    name: sp?.name || st,
    cs_status: csStatus,
    in_state_programs: !!sp,
    total_projects: ops.count,
    total_operational_mw: totalMw,
    recent_projects: ops.recentCount,
    recent_mw: recentMw,
    latest_install_year: ops.latestYear || null,
    capacity_mw_curated: sp?.capacity_mw ?? null,
    flag,
    severity,
    suggestion,
  })
}

// Sort: flagged first by severity, then by total_mw desc within each
const sevRank = { high: 0, medium: 1, null: 2 }
findings.sort((a, b) => {
  const r = sevRank[a.severity ?? null] - sevRank[b.severity ?? null]
  if (r !== 0) return r
  return b.total_operational_mw - a.total_operational_mw
})

// ── Output ────────────────────────────────────────────────────────────────
if (JSON_OUTPUT) {
  console.log(JSON.stringify({
    thresholds: { DEAD_MARKET_MW, STRONG_MARKET_MW, MISSING_CURATION_MW, RECENT_ACTIVITY_YEARS },
    total_states_seen: allStates.size,
    flagged_count: findings.filter(f => f.flag).length,
    findings,
  }, null, 2))
  process.exit(0)
}

const flagged = findings.filter(f => f.flag)
const ok      = findings.filter(f => !f.flag && f.in_state_programs && f.cs_status !== 'none')

console.log(`\n══════════════════════════════════════════════════════════════════════════`)
console.log(`  cs_status accuracy audit · ${new Date().toISOString().slice(0, 10)}`)
console.log(`══════════════════════════════════════════════════════════════════════════`)
console.log(`Total states seen: ${allStates.size}`)
console.log(`In state_programs: ${programs.length}`)
console.log(`In cs_projects:    ${byState.size}`)
console.log(`Latest vintage in cs_projects: ${currentYear}`)
console.log(`Thresholds: DEAD<${DEAD_MARKET_MW}MW · STRONG>${STRONG_MARKET_MW}MW · MISSING>${MISSING_CURATION_MW}MW`)
console.log()

if (flagged.length === 0) {
  console.log(`✓ No discrepancies flagged. Curated cs_status matches operational reality across all states.`)
} else {
  console.log(`⚠  ${flagged.length} flagged state${flagged.length !== 1 ? 's' : ''}:\n`)
  for (const f of flagged) {
    const sevTag = f.severity === 'high' ? '🔴 HIGH ' : '🟡 MED  '
    const flagTag = f.flag.padEnd(22)
    console.log(`${sevTag} ${f.state}  cs_status='${f.cs_status}'  ${flagTag}  ${f.total_projects} projects · ${f.total_operational_mw} MW operational`)
    console.log(`         ${f.suggestion}`)
    if (f.recent_projects > 0) console.log(`         Recent (last ${RECENT_ACTIVITY_YEARS} yrs): ${f.recent_projects} projects · ${f.recent_mw} MW`)
    if (f.capacity_mw_curated != null) console.log(`         Curated capacity_mw: ${f.capacity_mw_curated} MW`)
    console.log()
  }
}

console.log(`──── Reality-check OK (curated label matches deployment) ────`)
for (const f of ok) {
  console.log(`  ${f.state}  ${f.cs_status.padEnd(8)}  ${f.total_projects.toString().padStart(4)} proj · ${f.total_operational_mw.toString().padStart(8)} MW operational`)
}
console.log()
