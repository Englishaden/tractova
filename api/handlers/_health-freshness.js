/**
 * Freshness — admin Mission Control dashboard payload (default action)
 * Action: '' (default) — freshness RPC + cron telemetry + drift + cs_status audit
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Freshness (default) ─────────────────────────────────────────────────────
export default async function handleFreshness(req, res) {
  // Mission Control augmentation — same probes the bearer-token health-summary
  // endpoint runs, surfaced inline so the admin Data Health tab can render
  // a single-screen executive snapshot. Cheap parallel queries + tiny
  // aggregation; backwards compatible (missionControl is additive).
  const [
    freshnessResult,
    cronRunsResult,
    dataUpdatesResult,
    countyTotalRes,
    nwiPopulatedRes,
    ixFreshnessRes,
    scenarioCountRes,
    cancellationCountRes,
    statePrograms_DriftRes,
  ] = await Promise.all([
    supabaseAdmin.rpc('get_data_freshness'),
    supabaseAdmin
      .from('cron_runs')
      .select('*')
      .order('finished_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('data_updates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(30),
    supabaseAdmin.from('county_acs_data').select('county_fips', { count: 'exact', head: true }),
    supabaseAdmin
      .from('county_geospatial_data')
      .select('county_fips', { count: 'exact', head: true })
      .not('wetland_coverage_pct', 'is', null),
    supabaseAdmin.from('ix_queue_data').select('iso, fetched_at'),
    supabaseAdmin.from('scenario_snapshots').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('cancellation_feedback').select('id', { count: 'exact', head: true }),
    // Mission Control "curation drift" — every state_program row's age signal.
    // We compute drift in JS rather than SQL because last_verified can be null
    // and we want to fall back to updated_at consistently.
    supabaseAdmin
      .from('state_programs')
      .select('id, name, cs_status, last_verified, updated_at, capacity_mw, enrollment_rate_mw_per_month'),
  ])

  // NWI coverage
  const totalCounties = countyTotalRes.count || 0
  const nwiPopulated = nwiPopulatedRes.count || 0
  const nwiPct = totalCounties > 0 ? +(nwiPopulated / totalCounties * 100).toFixed(1) : null

  // IX freshness per ISO — worst-case fetched_at across utilities
  const ixByIso = {}
  for (const row of (ixFreshnessRes.data || [])) {
    if (!row.fetched_at) continue
    const ts = new Date(row.fetched_at).getTime()
    if (!ixByIso[row.iso] || ts < ixByIso[row.iso].oldestTs) {
      ixByIso[row.iso] = { oldestTs: ts, oldestFetchedAt: row.fetched_at }
    }
  }
  const now = Date.now()
  const ixFreshness = Object.entries(ixByIso)
    .map(([iso, v]) => ({
      iso,
      oldestFetchedAt: v.oldestFetchedAt,
      ageDays: Math.floor((now - v.oldestTs) / (1000 * 60 * 60 * 24)),
      stale: (now - v.oldestTs) > 7 * 24 * 60 * 60 * 1000,
    }))
    .sort((a, b) => b.ageDays - a.ageDays)

  // state_programs curation drift — flag any active CS state whose
  // max(last_verified, updated_at) is older than the warn threshold. The audit
  // identified state_programs.capacity_mw drift as the highest-impact hand-
  // curated value (it drives Runway and the Feasibility Index). Surfacing
  // staleness in the admin Mission Control row forces visibility without
  // auto-changing anything. Tunable via the constants below.
  const DRIFT_WARN_DAYS = 30   // amber
  const DRIFT_URGENT_DAYS = 60 // red
  const drift = (statePrograms_DriftRes.data || []).map((s) => {
    const v = s.last_verified ? new Date(s.last_verified).getTime() : 0
    const u = s.updated_at ? new Date(s.updated_at).getTime() : 0
    const latest = Math.max(v, u)
    if (!latest) return null
    const ageDays = Math.floor((now - latest) / (1000 * 60 * 60 * 24))
    return {
      state_id: s.id,
      name: s.name,
      cs_status: s.cs_status,
      age_days: ageDays,
      latest_at: new Date(latest).toISOString(),
      severity: ageDays >= DRIFT_URGENT_DAYS ? 'urgent' : ageDays >= DRIFT_WARN_DAYS ? 'warn' : 'ok',
      // Surface whether the row has the Runway-driving fields populated. A
      // state with no capacity_mw or no enrollment_rate is silently breaking
      // Runway; the admin should see that even if the row was recently
      // "verified" with empty data.
      has_capacity: s.capacity_mw != null && s.capacity_mw > 0,
      has_enrollment_rate: s.enrollment_rate_mw_per_month != null && s.enrollment_rate_mw_per_month > 0,
    }
  }).filter(Boolean)
  // Only return non-ok entries (warn + urgent). Sorted descending by age.
  // Active CS states first (they're the user-facing surface) then others.
  const driftToShow = drift
    .filter((d) => d.severity !== 'ok')
    .sort((a, b) => {
      const aActive = a.cs_status === 'active' ? 0 : 1
      const bActive = b.cs_status === 'active' ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      return b.age_days - a.age_days
    })

  // ── cs_status accuracy audit ────────────────────────────────────────────
  // Joins state_programs.cs_status against per-state operating MW from
  // cs_projects (NREL Sharing the Sun seed). Flags states where the
  // curated label doesn't match operational reality. See
  // scripts/audit-cs-status-vs-deployment.mjs for the full logic + heuristics.
  const csStatusAudit = await runCsStatusAudit(statePrograms_DriftRes.data || [])

  return res.status(200).json({
    freshness: freshnessResult.data,
    cronRuns: cronRunsResult.data || [],
    dataUpdates: dataUpdatesResult.data || [],
    missionControl: {
      nwi_coverage: { populated: nwiPopulated, total: totalCounties, pct: nwiPct },
      ix_freshness: ixFreshness,
      scenario_snapshots_count: scenarioCountRes.count || 0,
      cancellation_feedback_count: cancellationCountRes.count || 0,
      state_programs_drift: driftToShow,
      state_programs_drift_thresholds: { warn_days: DRIFT_WARN_DAYS, urgent_days: DRIFT_URGENT_DAYS },
      cs_status_audit: csStatusAudit,
    },
  })
}

// ── cs_status accuracy audit helper ─────────────────────────────────────────
const CS_AUDIT_DEAD_MW       = 5
const CS_AUDIT_STRONG_MW     = 500
const CS_AUDIT_MISSING_MW    = 50
const CS_AUDIT_RECENT_YEARS  = 5

async function runCsStatusAudit(programs) {
  // Paginate cs_projects (default page size 1000; total ~4,280).
  const projects = []
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from('cs_projects')
        .select('state, system_size_mw_ac, vintage_year')
        .range(from, from + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      projects.push(...data)
      if (data.length < 1000) break
    }
  } catch (e) {
    // cs_projects may not be seeded yet (migration 050 applied but seed not run).
    // Return empty audit — UI can hide the card gracefully.
    return { available: false, error: e.message, findings: [] }
  }
  if (projects.length === 0) {
    return { available: false, reason: 'cs_projects empty (seed not run)', findings: [] }
  }

  const programMap = new Map((programs || []).map(p => [p.id, p]))
  const currentYear = projects.reduce((m, p) => Math.max(m, p.vintage_year || 0), 0)
  const recentFloor = currentYear - CS_AUDIT_RECENT_YEARS

  const byState = new Map()
  for (const p of projects) {
    const st = p.state
    if (!byState.has(st)) byState.set(st, { count: 0, totalMw: 0, recentCount: 0, recentMw: 0, latestYear: 0 })
    const b = byState.get(st)
    b.count++
    const mw = Number(p.system_size_mw_ac) || 0
    b.totalMw += mw
    if (p.vintage_year && p.vintage_year > b.latestYear) b.latestYear = p.vintage_year
    if (p.vintage_year && p.vintage_year >= recentFloor) {
      b.recentCount++
      b.recentMw += mw
    }
  }

  const findings = []
  const allStates = new Set([...byState.keys(), ...(programs || []).map(p => p.id)])
  for (const st of allStates) {
    const sp = programMap.get(st)
    const csStatus = sp?.cs_status || 'none'
    const ops = byState.get(st) || { count: 0, totalMw: 0, recentCount: 0, recentMw: 0, latestYear: null }
    const totalMw = Number(ops.totalMw.toFixed(1))

    let flag = null, suggestion = null, severity = null
    if (csStatus === 'active' && totalMw < CS_AUDIT_DEAD_MW) {
      flag = 'DEAD_MARKET'
      suggestion = `Only ${totalMw} MW operational; consider 'limited' or 'none'`
      severity = 'high'
    } else if (csStatus === 'limited' && totalMw > CS_AUDIT_STRONG_MW) {
      flag = 'STRONG_MARKET'
      suggestion = `${totalMw} MW operational across ${ops.count} projects — review whether 'active' fits`
      severity = 'high'
    } else if (csStatus === 'none' && totalMw > CS_AUDIT_MISSING_MW) {
      flag = sp ? 'MISSING_STATUS' : 'MISSING_FROM_CURATION'
      suggestion = sp
        ? `cs_status='none' but ${totalMw} MW operational — state has real CS deployment`
        : `Not in state_programs; ${totalMw} MW operational — add to curation queue`
      severity = totalMw > 500 ? 'high' : 'medium'
    } else if (csStatus === 'active' && totalMw < 50 && ops.recentCount === 0) {
      flag = 'STALE_MARKET'
      suggestion = `No installs in last ${CS_AUDIT_RECENT_YEARS} years (latest ${ops.latestYear || '—'}); market may be dormant`
      severity = 'medium'
    }

    if (flag) {
      findings.push({
        state: st,
        name: sp?.name || st,
        cs_status: csStatus,
        in_state_programs: !!sp,
        total_projects: ops.count,
        total_operational_mw: totalMw,
        recent_projects: ops.recentCount,
        recent_mw: Number(ops.recentMw.toFixed(1)),
        latest_install_year: ops.latestYear || null,
        capacity_mw_curated: sp?.capacity_mw ?? null,
        flag, severity, suggestion,
      })
    }
  }

  // High-severity first, then by operational MW desc.
  findings.sort((a, b) => {
    const r = (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)
    if (r !== 0) return r
    return b.total_operational_mw - a.total_operational_mw
  })

  return {
    available: true,
    total_states_seen: allStates.size,
    cs_projects_count: projects.length,
    latest_vintage: currentYear,
    thresholds: {
      dead_mw: CS_AUDIT_DEAD_MW,
      strong_mw: CS_AUDIT_STRONG_MW,
      missing_mw: CS_AUDIT_MISSING_MW,
      recent_years: CS_AUDIT_RECENT_YEARS,
    },
    findings,
  }
}
