import { isAdminFromBearer } from './_admin-auth.js'
import handleExport from './handlers/_health-export.js'
import handleStagingGet from './handlers/_health-staging-get.js'
import handleStagingPost from './handlers/_health-staging-post.js'
import handleHealthSummary from './handlers/_health-summary.js'
import handleFreshness from './handlers/_health-freshness.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'

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
