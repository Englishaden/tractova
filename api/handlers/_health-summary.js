/**
 * Health Summary — bearer-token-gated, machine-readable system-health snapshot
 * Action: 'health-summary'
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Health Summary (bearer-token, machine-readable) ─────────────────────────
// Returns the full set of probes the weekly remote routine needs, in a
// stable JSON shape. No HTML, no localized strings — let the agent format
// for Slack itself. Aggregate counts only; never per-user data.
export default async function handleHealthSummary(res) {
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
