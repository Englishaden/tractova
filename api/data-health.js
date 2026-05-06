import { createClient } from '@supabase/supabase-js'
import { isAdminFromBearer } from './_admin-auth.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Auth ────────────────────────────────────────────────────────────────────
// 2026-05-05 (C1): role-based check via profiles.role (migration 057) with
// legacy email-match fallback. Replaces the previous hardcoded
// `user.email === 'aden.walker67@gmail.com'` check.
async function authenticateAdmin(req) {
  const adminCheck = await isAdminFromBearer(supabaseAdmin, req.headers.authorization)
  return adminCheck.ok ? adminCheck.user : null
}

// ── Export tables ───────────────────────────────────────────────────────────
const EXPORT_TABLES = [
  { name: 'state_programs', label: 'State Programs' },
  { name: 'county_intelligence', label: 'County Intelligence' },
  { name: 'revenue_rates', label: 'Revenue Rates' },
  { name: 'revenue_stacks', label: 'Revenue Stacks' },
  { name: 'ix_queue_data', label: 'IX Queue Data' },
  { name: 'substations', label: 'Substations' },
  { name: 'news_feed', label: 'News Feed' },
]

async function handleExport(req, res, user) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')

  const tableFilter = req.query.table
  const tablesToExport = tableFilter
    ? EXPORT_TABLES.filter(t => t.name === tableFilter)
    : EXPORT_TABLES

  if (tablesToExport.length === 0) {
    return res.status(400).json({ error: `Unknown table: ${tableFilter}`, available: EXPORT_TABLES.map(t => t.name) })
  }

  const snapshot = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
    tables: {},
  }

  const errors = []

  await Promise.all(tablesToExport.map(async ({ name }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from(name)
        .select('*')
        .limit(10000)

      if (error) {
        errors.push(`${name}: ${error.message}`)
      } else {
        snapshot.tables[name] = { row_count: data.length, rows: data }
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }))

  if (errors.length > 0) snapshot.errors = errors

  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = tableFilter
    ? `tractova-${tableFilter}-${dateStr}.json`
    : `tractova-backup-${dateStr}.json`

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')

  return res.status(200).json(snapshot)
}

// ── Staging ─────────────────────────────────────────────────────────────────
const PROMOTABLE_FIELDS = [
  'cs_status', 'cs_program', 'capacity_mw', 'lmi_required', 'lmi_percent',
  'ix_difficulty', 'ix_notes', 'program_notes', 'enrollment_rate_mw_per_month',
]

async function handleStagingGet(req, res) {
  const status = req.query.status || 'pending'
  const { data, error } = await supabaseAdmin
    .from('state_programs_staging')
    .select('*')
    .eq('review_status', status)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })

  const withDiffs = await Promise.all((data || []).map(async (staged) => {
    const { data: live } = await supabaseAdmin
      .from('state_programs')
      .select('*')
      .eq('id', staged.id)
      .single()

    const diffs = []
    if (live) {
      for (const field of PROMOTABLE_FIELDS) {
        if (staged[field] != null && String(staged[field]) !== String(live[field])) {
          diffs.push({ field, old: live[field], new: staged[field] })
        }
      }
    } else {
      for (const field of PROMOTABLE_FIELDS) {
        if (staged[field] != null) {
          diffs.push({ field, old: null, new: staged[field] })
        }
      }
    }

    return { ...staged, diffs, live_name: live?.name || staged.name }
  }))

  return res.status(200).json({ records: withDiffs })
}

async function handleStagingPost(req, res) {
  const { id, submitted_at, action } = req.body || {}
  if (!id || !submitted_at || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Missing id, submitted_at, or action (approve|reject)' })
  }

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('state_programs_staging')
      .update({ review_status: 'rejected' })
      .eq('id', id)
      .eq('submitted_at', submitted_at)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ status: 'rejected', id })
  }

  // Approve — promote staging fields to live state_programs
  const { data: staged, error: fetchErr } = await supabaseAdmin
    .from('state_programs_staging')
    .select('*')
    .eq('id', id)
    .eq('submitted_at', submitted_at)
    .single()

  if (fetchErr || !staged) {
    return res.status(404).json({ error: 'Staging record not found' })
  }

  const updates = {}
  for (const field of PROMOTABLE_FIELDS) {
    if (staged[field] != null) updates[field] = staged[field]
  }
  updates.data_source = staged.data_source || 'staging-promoted'
  updates.last_verified = new Date().toISOString()
  updates.updated_by = 'admin-staging'

  const { data: live } = await supabaseAdmin
    .from('state_programs')
    .select('*')
    .eq('id', id)
    .single()

  const { error: upsertErr } = await supabaseAdmin
    .from('state_programs')
    .upsert({ id, name: staged.name, ...updates }, { onConflict: 'id' })

  if (upsertErr) {
    return res.status(500).json({ error: `Promote failed: ${upsertErr.message}` })
  }

  await supabaseAdmin
    .from('state_programs_staging')
    .update({ review_status: 'approved' })
    .eq('id', id)
    .eq('submitted_at', submitted_at)

  for (const field of PROMOTABLE_FIELDS) {
    if (staged[field] != null && live && String(staged[field]) !== String(live[field])) {
      try {
        await supabaseAdmin.from('data_updates').insert({
          table_name: 'state_programs',
          row_id: id,
          field,
          old_value: live[field] != null ? String(live[field]) : null,
          new_value: String(staged[field]),
          updated_by: `staging:${staged.submitted_by || 'unknown'}`,
        })
      } catch { /* best-effort logging */ }
    }
  }

  return res.status(200).json({ status: 'approved', id, fieldsUpdated: Object.keys(updates).length })
}

// ── Health Summary (bearer-token, machine-readable) ─────────────────────────
// Returns the full set of probes the weekly remote routine needs, in a
// stable JSON shape. No HTML, no localized strings — let the agent format
// for Slack itself. Aggregate counts only; never per-user data.
async function handleHealthSummary(res) {
  // Run all probes in parallel for speed.
  const [
    nwiCoverageRes,
    countyTotalRes,
    ixFreshnessRes,
    cronRunsRes,
    scenarioCountRes,
    cancellationCountRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('county_geospatial_data')
      .select('county_fips', { count: 'exact', head: true })
      .not('wetland_coverage_pct', 'is', null),
    supabaseAdmin
      .from('county_acs_data')
      .select('county_fips', { count: 'exact', head: true }),
    supabaseAdmin
      .from('ix_queue_data')
      .select('iso, fetched_at')
      .order('fetched_at', { ascending: false }),
    supabaseAdmin
      .from('cron_runs')
      .select('cron_name, status, started_at, finished_at, duration_ms')
      .order('started_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('scenario_snapshots')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('cancellation_feedback')
      .select('id', { count: 'exact', head: true }),
  ])

  // ── NWI ──
  const totalCounties = countyTotalRes.count || 0
  const nwiPopulated  = nwiCoverageRes.count || 0
  const nwiPct = totalCounties > 0 ? +(nwiPopulated / totalCounties * 100).toFixed(1) : null

  // ── IX freshness per ISO (worst-case fetched_at within each ISO) ──
  const ixByIso = {}
  for (const row of (ixFreshnessRes.data || [])) {
    if (!row.fetched_at) continue
    const ts = new Date(row.fetched_at).getTime()
    if (!ixByIso[row.iso] || ts < ixByIso[row.iso].oldestTs) {
      ixByIso[row.iso] = { oldestTs: ts, oldestFetchedAt: row.fetched_at }
    }
  }
  const now = Date.now()
  const ixFreshness = Object.entries(ixByIso).map(([iso, v]) => ({
    iso,
    oldestFetchedAt: v.oldestFetchedAt,
    ageDays: Math.floor((now - v.oldestTs) / (1000 * 60 * 60 * 24)),
    stale: (now - v.oldestTs) > 7 * 24 * 60 * 60 * 1000,
  })).sort((a, b) => b.ageDays - a.ageDays)

  // ── Cron telemetry: latest success per cron_name + duration vs ceiling ──
  const FUNCTION_BUDGETS_MS = {
    'refresh-data':              300_000,
    'refresh-substations':       60_000,
    'refresh-ix-queue':          60_000,
    'refresh-capacity-factors':  60_000,
    'monthly-data-refresh':      60_000, // alias used by the substations cron
    'capacity-factor-refresh':   60_000, // alias used by the capacity cron
    'ix-queue-refresh':          60_000,
  }
  const ceilingFor = (name) => {
    if (!name) return 60_000
    return FUNCTION_BUDGETS_MS[name.split(':')[0]] ?? FUNCTION_BUDGETS_MS[name] ?? 60_000
  }

  // Latest success + p95 over last 30 days, per cron_name.
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000
  const byCron = {}
  for (const r of (cronRunsRes.data || [])) {
    if (!r.cron_name) continue
    if (!byCron[r.cron_name]) byCron[r.cron_name] = { successes: [], lastSuccess: null }
    if (r.status === 'success') {
      const startedTs = r.started_at ? new Date(r.started_at).getTime() : 0
      if (startedTs >= cutoff30d && typeof r.duration_ms === 'number') {
        byCron[r.cron_name].successes.push({ duration_ms: r.duration_ms, started_at: r.started_at, finished_at: r.finished_at })
      }
      if (!byCron[r.cron_name].lastSuccess) {
        byCron[r.cron_name].lastSuccess = r // already sorted desc
      }
    }
  }
  const p95 = (arr) => {
    if (!arr?.length) return null
    const sorted = [...arr].map(x => x.duration_ms).sort((a, b) => a - b)
    const rank = 0.95 * (sorted.length - 1)
    const lo = Math.floor(rank), hi = Math.ceil(rank)
    return lo === hi ? sorted[lo] : Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo))
  }

  const expectedCadenceDays = {
    // Roughly how often each cron should run successfully. Used to flag
    // sub-sources that have gone silent past their cadence.
    'refresh-data':                 8,    // weekly
    'refresh-data:lmi':             8,
    'refresh-data:state_programs':  8,
    'refresh-data:county_acs':      8,
    'refresh-data:nmtc_lic':        8,
    'refresh-data:hud_qct_dda':     8,
    'refresh-data:energy_community':8,
    'refresh-data:revenue_stacks':  8,
    'refresh-data:news':            8,
    'refresh-data:geospatial_farmland': 35, // monthly-ish
    'refresh-data:solar_costs':     400,  // annual (LBNL TTS releases each Oct)
    'monthly-data-refresh':         35,   // monthly
    'capacity-factor-refresh':      100,  // quarterly
    'ix-queue-refresh':             8,    // weekly
  }

  const cronSummary = Object.entries(byCron).map(([name, v]) => {
    const lastSuccess = v.lastSuccess
    const lastSuccessTs = lastSuccess?.started_at ? new Date(lastSuccess.started_at).getTime() : null
    const ageDays = lastSuccessTs ? Math.floor((now - lastSuccessTs) / (1000 * 60 * 60 * 24)) : null
    const cadence = expectedCadenceDays[name] ?? null
    const stalePastCadence = (cadence != null && ageDays != null) ? (ageDays > cadence) : null
    const ceilingMs = ceilingFor(name)
    const p95Ms = p95(v.successes)
    return {
      cron_name: name,
      sample_count: v.successes.length,
      p95_ms: p95Ms,
      ceiling_ms: ceilingMs,
      headroom_pct: p95Ms != null ? Math.round((1 - p95Ms / ceilingMs) * 100) : null,
      last_success_started_at: lastSuccess?.started_at || null,
      last_success_duration_ms: lastSuccess?.duration_ms ?? null,
      age_days: ageDays,
      expected_cadence_days: cadence,
      stale_past_cadence: stalePastCadence,
    }
  }).sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))

  // ── Spotlight: monthly-data-refresh latest run vs 60s ceiling ──
  // Called out specifically because the latency monitor flagged it pre-fix.
  const monthlySubst = cronSummary.find((c) => c.cron_name === 'monthly-data-refresh') || null

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    nwi_coverage: {
      populated: nwiPopulated,
      total: totalCounties,
      pct: nwiPct,
    },
    ix_freshness: ixFreshness,
    cron_summary: cronSummary,
    monthly_data_refresh: monthlySubst,
    usage_signals: {
      scenario_snapshots_count: scenarioCountRes.count || 0,
      cancellation_feedback_count: cancellationCountRes.count || 0,
    },
  })
}

// ── Freshness (default) ─────────────────────────────────────────────────────
async function handleFreshness(req, res) {
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

// ── Router ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action

  // BEARER-TOKEN-GATED: machine-readable system-health summary for the
  // weekly Anthropic-cloud routine. Returns aggregate counts/timestamps —
  // no PII, no per-user data — but gated by HEALTH_CHECK_TOKEN so we don't
  // leak operational telemetry to the public web. The token is a long-
  // lived Vercel env var; rotate by setting a new value in Vercel and the
  // routine prompt simultaneously.
  if (action === 'health-summary') {
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')
    const expected = process.env.HEALTH_CHECK_TOKEN
    if (!expected) {
      return res.status(503).json({ error: 'Health summary endpoint not configured (HEALTH_CHECK_TOKEN missing)' })
    }
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ') || auth.slice(7) !== expected) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    try {
      return await handleHealthSummary(res)
    } catch (err) {
      console.error('[data-health health-summary] failed:', err)
      return res.status(500).json({ error: 'Internal server error', detail: err?.message })
    }
  }

  // PUBLIC path: latest successful cron_runs.finished_at — single timestamp,
  // no sensitive data, used by the global Footer to render an honest "Data
  // refreshed N ago" caption. Bypasses admin auth because this is one
  // aggregate value the whole product (anon + signed-in) needs to see.
  if (action === 'last-refresh') {
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')
    res.setHeader('Cache-Control', 'public, max-age=60')
    try {
      const { data, error } = await supabaseAdmin
        .from('cron_runs')
        .select('finished_at')
        .eq('status', 'success')
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
      if (error) throw error
      const finishedAt = data?.[0]?.finished_at || null
      return res.status(200).json({ finishedAt })
    } catch (err) {
      console.error('[data-health last-refresh] failed:', err)
      return res.status(500).json({ error: 'Internal server error', finishedAt: null })
    }
  }

  // All other actions require admin auth.
  const user = await authenticateAdmin(req)
  if (!user) return res.status(403).json({ error: 'Forbidden' })

  try {
    if (action === 'export') return await handleExport(req, res, user)

    if (action === 'staging') {
      if (req.method === 'GET') return await handleStagingGet(req, res)
      if (req.method === 'POST') return await handleStagingPost(req, res)
      return res.status(405).end('Method Not Allowed')
    }

    // Default: freshness dashboard data
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')
    return await handleFreshness(req, res)
  } catch (err) {
    console.error('Data health handler failed:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
