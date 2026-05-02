// Cron-runs latency monitor — surfaces cron handlers whose p95 duration is
// approaching the parent function's `maxDuration` ceiling, so we catch the
// next 504-class bug structurally before users see a red panel.
//
// Defensive observability. Originally proposed in BUILD_LOG (`dc85c18`) and
// promoted from "P2 backlog" after the AI scenario commentary work shipped
// (2026-05-02). The structural class of bug it catches is the one that
// already bit us once: `refresh-substations` was sequential per-state and
// silently grew toward the 60s gateway ceiling until it tipped over (`bbc9543`
// fix). Latency monitoring would have flagged it weeks earlier.
//
// Approach:
//   - Aggregate `cron_runs` (status='success') over the last N days in JS.
//     Total rows are small (~thousands at most) so the SQL→JS transfer is
//     cheap. No new migration; no new RPC.
//   - Map each `cron_name` to its parent function's `maxDuration` ceiling
//     using a hard-coded prefix map (mirrors `vercel.json`'s `functions`
//     block). When a `cron_name` doesn't match, default to 60s — Hobby's
//     historical baseline before the platform-default bump to 300s.
//   - Bucket each cron by `p95 / ceiling`:
//       severity = 'warn'  when ratio > 0.70 (close to the wall)
//       severity = 'watch' when ratio > 0.50 (worth keeping eyes on)
//       severity = 'ok'    otherwise
//   - Sort the result so 'warn' rows surface first.

const FUNCTION_BUDGETS_MS = {
  // Mirrors vercel.json `functions` block. Update both when adding a new
  // configured function.
  'refresh-data':             300_000,
  'refresh-substations':       60_000,
  'refresh-ix-queue':          60_000,
  'refresh-capacity-factors':  60_000,
  'lens-insight':              60_000,
}

// Default for unconfigured cron handlers (send-digest, send-alerts,
// check-staleness, webhook). 60s is conservative — the actual platform
// default is now 300s under fluid compute, but flagging at 60s gives us
// earlier warning if these handlers grow unexpectedly.
const DEFAULT_CEILING_MS = 60_000

// p95/ceiling thresholds. Tuned so a clean handler (typical p95 well under
// half its budget) reads 'ok'; sequential-fanout-grown-into-the-ceiling
// reads 'warn' weeks before it tips into a 504.
const SEVERITY_THRESHOLDS = {
  warn:  0.70,
  watch: 0.50,
}

// Map a cron_name like "refresh-data:nmtc_lic" or "refresh-substations" to its
// parent function's ceiling. Multi-source handlers (refresh-data:*) all share
// the parent function's budget — they ran in parallel inside the same
// invocation, so any one of them is bounded by the parent's maxDuration.
export function ceilingForCronName(cronName) {
  if (!cronName) return DEFAULT_CEILING_MS
  const head = cronName.split(':')[0]
  return FUNCTION_BUDGETS_MS[head] ?? DEFAULT_CEILING_MS
}

function p95(values) {
  if (!values?.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  // Linear interpolation between the two values bracketing the 95th percentile.
  const rank = 0.95 * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  const frac = rank - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

function severityFor(ratio) {
  if (ratio >= SEVERITY_THRESHOLDS.warn) return 'warn'
  if (ratio >= SEVERITY_THRESHOLDS.watch) return 'watch'
  return 'ok'
}

// Pull cron_runs over the last `daysBack` days (default 30) and bucket by
// cron_name. Caller passes a Supabase client (admin or anon — RLS allows
// admin-only read of cron_runs in production, so this is admin-tab-only).
export async function analyzeCronLatency(supabaseClient, daysBack = 30) {
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString()
  const { data, error } = await supabaseClient
    .from('cron_runs')
    .select('cron_name, duration_ms, finished_at, status')
    .eq('status', 'success')
    .gte('started_at', cutoff)
    .order('started_at', { ascending: false })
    .limit(5000)
  if (error) {
    return { ok: false, error: error.message, rows: [] }
  }
  if (!data?.length) {
    return { ok: true, rows: [], windowDays: daysBack, totalSamples: 0 }
  }
  // Bucket by cron_name.
  const buckets = new Map()
  for (const r of data) {
    if (!r.cron_name || r.duration_ms == null) continue
    let b = buckets.get(r.cron_name)
    if (!b) {
      b = { cron_name: r.cron_name, durations: [], lastFinishedAt: null }
      buckets.set(r.cron_name, b)
    }
    b.durations.push(Number(r.duration_ms))
    if (!b.lastFinishedAt || r.finished_at > b.lastFinishedAt) {
      b.lastFinishedAt = r.finished_at
    }
  }
  const rows = Array.from(buckets.values()).map((b) => {
    const sum = b.durations.reduce((s, x) => s + x, 0)
    const p95Ms = p95(b.durations)
    const maxMs = Math.max(...b.durations)
    const avgMs = sum / b.durations.length
    const ceilingMs = ceilingForCronName(b.cron_name)
    const ratio = p95Ms != null ? p95Ms / ceilingMs : 0
    return {
      cron_name: b.cron_name,
      sample_count: b.durations.length,
      p95_ms: Math.round(p95Ms ?? 0),
      max_ms: Math.round(maxMs),
      avg_ms: Math.round(avgMs),
      ceiling_ms: ceilingMs,
      headroom_pct: Math.round((1 - ratio) * 100),
      ratio,
      severity: severityFor(ratio),
      last_finished_at: b.lastFinishedAt,
    }
  })
  // Sort: warn first, then watch, then ok; within each, descending p95 ratio.
  const order = { warn: 0, watch: 1, ok: 2 }
  rows.sort((a, b) => {
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity]
    return b.ratio - a.ratio
  })
  return {
    ok: true,
    rows,
    windowDays: daysBack,
    totalSamples: data.length,
  }
}
