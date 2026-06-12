import { isAdminFromBearer } from './_admin-auth.js'
import { timingSafeEqualStr } from './_safeCompare.js'
import handleExport from './handlers/_health-export.js'
import handleStagingGet from './handlers/_health-staging-get.js'
import handleStagingPost from './handlers/_health-staging-post.js'
import handleHealthSummary from './handlers/_health-summary.js'
import handleFreshness from './handlers/_health-freshness.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'

// Weekly-cadence data-pillar crons that feed the public "Data refreshed" caption
// (A5 fix). The caption = the OLDEST latest-success among these, so a stalled
// weekly pillar drags it down honestly. Deliberately EXCLUDES long-cadence crons
// (capacity-factor-refresh quarterly, refresh-data:solar_costs annual,
// refresh-data:nmtc_lic static/~yearly, monthly-data-refresh) — their long gaps
// are normal, not staleness — and
// non-data crons (staleness-check, send-digest, send-alerts). Keep in sync with
// the active weekly crons in vercel.json + the THRESHOLDS in check-staleness.js.
const FRESHNESS_PILLAR_CRONS = [
  'ix-queue-refresh',
  'refresh-data:energy_community',
  'refresh-data:hud_qct_dda',
  'refresh-data:geospatial_farmland',
  'refresh-data:lmi',
  'refresh-data:county_acs',
  'refresh-data:news',
  'refresh-data:policy_scan',
  'refresh-data:hosting_capacity',
]

// ── Auth ────────────────────────────────────────────────────────────────────
// 2026-05-05 (C1): role-based check via profiles.role (migration 057) with
// legacy email-match fallback. Replaces the previous hardcoded
// `user.email === 'aden.walker67@gmail.com'` check.
async function authenticateAdmin(req) {
  const adminCheck = await isAdminFromBearer(supabaseAdmin, req.headers.authorization)
  return adminCheck.ok ? adminCheck.user : null
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
    if (!auth?.startsWith('Bearer ') || !timingSafeEqualStr(auth.slice(7), expected)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    try {
      return await handleHealthSummary(res)
    } catch (err) {
      console.error('[data-health health-summary] failed:', err)
      return res.status(500).json({ error: 'Internal server error' })  // F-15: drop detail (raw err.message)
    }
  }

  // PUBLIC path: the "Data refreshed N ago" caption shown on the Footer /
  // Dashboard / Library. Bypasses admin auth because it's one aggregate value
  // the whole product (anon + signed-in) needs.
  //
  // 2026-06 audit (A5): this was MAX(finished_at) across ALL crons, so it read
  // "today" the moment ANY cron succeeded — even while a specific pillar's
  // weekly refresh silently failed for weeks. It now returns the OLDEST
  // latest-success among the WEEKLY-cadence data pillars (the weakest current
  // link), so a stalled pillar correctly drags the caption back and trips the
  // surfaces' >14-day stale flag. Intentionally-infrequent crons (capacity
  // factors quarterly, solar costs annual, substations monthly) and non-data
  // crons (staleness-check, send-*) are excluded from the headline and monitored
  // separately by check-staleness with cadence-matched thresholds.
  if (action === 'last-refresh') {
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')
    // no-store: this is a freshness SIGNAL — it must reflect an admin refresh
    // immediately, not lag behind a CDN/browser cache window.
    res.setHeader('Cache-Control', 'no-store')
    try {
      const { data, error } = await supabaseAdmin
        .from('cron_runs')
        .select('cron_name, finished_at')
        .eq('status', 'success')
        .in('cron_name', FRESHNESS_PILLAR_CRONS)
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(300)
      if (error) throw error
      // Latest success per pillar cron (rows are finished_at-desc, so first seen
      // per cron_name wins), then the OLDEST of those = the weakest link.
      const latestByCron = {}
      for (const row of (data || [])) {
        if (!latestByCron[row.cron_name]) latestByCron[row.cron_name] = row.finished_at
      }
      const stamps = Object.values(latestByCron)
      let finishedAt = stamps.length ? stamps.reduce((min, t) => (t < min ? t : min)) : null

      // Fallback: if NONE of the pillar crons have ever succeeded (fresh DB, or
      // every pillar failing), fall back to the global latest success so the
      // caption still renders rather than vanishing. check-staleness carries the
      // real per-pillar + failed-cron alerting.
      if (!finishedAt) {
        const { data: anyOk } = await supabaseAdmin
          .from('cron_runs')
          .select('finished_at')
          .eq('status', 'success')
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
        finishedAt = anyOk?.[0]?.finished_at || null
      }
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
