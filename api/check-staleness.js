import { supabaseAdmin } from './lib/_supabaseAdmin.js'
import { axiomLog } from './lib/_axiomLog.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'alerts@tractova.com'
const ADMIN_EMAIL = 'aden.walker67@gmail.com'
const APP_URL = 'https://tractova.com'

// Staleness thresholds in days — yellow = needs attention, red = overdue
const THRESHOLDS = {
  state_programs:      { field: 'newest_verified', staleField: 'stale_count', yellow: 90, red: 180, label: 'State Programs' },
  ix_queue_data:       { field: 'newest_fetch',    staleField: 'stale_count', yellow: 14, red: 30,  label: 'IX Queue Data' },
  substations:         { field: 'last_updated',    staleField: null,          yellow: 60, red: 180, label: 'Substations' },
  county_intelligence: { field: 'oldest_verified', staleField: 'stale_count', yellow: 90, red: 180, label: 'County Intelligence' },
  revenue_rates:       { field: 'last_updated',    staleField: null,          yellow: 90, red: 180, label: 'Revenue Rates' },
  news_feed:           { field: 'latest_item',     staleField: null,          yellow: 14, red: 30,  label: 'News Feed' },
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function buildEmailHtml(issues) {
  const rows = issues.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:500;color:#374151;">${i.table}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:${i.severity === 'red' ? '#dc2626' : '#d97706'};">${i.severity === 'red' ? 'Overdue' : 'Needs Attention'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${i.detail}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0F766E;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:16px;font-weight:700;">Tractova Data Staleness Alert</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">${issues.length} table${issues.length > 1 ? 's' : ''} need${issues.length === 1 ? 's' : ''} attention</p>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Table</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Status</th>
            <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Detail</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
        <a href="${APP_URL}/admin" style="color:#0F766E;font-weight:600;">Open Data Admin →</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isBearerAuth = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  if (!isVercelCron && !isBearerAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = new Date()
  const results = { issues: [], tablesChecked: 0 }

  try {
    const { data: freshness, error } = await supabaseAdmin.rpc('get_data_freshness')
    if (error) throw error

    // Check each table against thresholds
    for (const [key, cfg] of Object.entries(THRESHOLDS)) {
      const tableData = freshness?.[key]
      if (!tableData) continue
      results.tablesChecked++

      const dateVal = tableData[cfg.field]
      const days = daysSince(dateVal)

      if (days != null && days > cfg.red) {
        results.issues.push({ table: cfg.label, severity: 'red', detail: `Last updated ${days} days ago (threshold: ${cfg.red}d)` })
      } else if (days != null && days > cfg.yellow) {
        results.issues.push({ table: cfg.label, severity: 'yellow', detail: `Last updated ${days} days ago (threshold: ${cfg.yellow}d)` })
      } else if (days == null) {
        results.issues.push({ table: cfg.label, severity: 'red', detail: 'No data timestamp available' })
      }

      // Check for stale individual rows
      if (cfg.staleField && tableData[cfg.staleField] > 0) {
        results.issues.push({ table: cfg.label, severity: 'yellow', detail: `${tableData[cfg.staleField]} individual stale row(s)` })
      }
    }

    // Send email if there are issues
    if (results.issues.length > 0 && RESEND_API_KEY) {
      const redCount = results.issues.filter(i => i.severity === 'red').length
      const subject = redCount > 0
        ? `[Tractova] ${redCount} data source${redCount > 1 ? 's' : ''} overdue for refresh`
        : `[Tractova] ${results.issues.length} data source${results.issues.length > 1 ? 's' : ''} need attention`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          reply_to: 'hello@tractova.com',
          to: ADMIN_EMAIL,
          subject,
          html: buildEmailHtml(results.issues),
        }),
      })
      results.emailSent = true
    } else if (results.issues.length > 0) {
      results.emailSent = false
      results.reason = 'No RESEND_API_KEY configured'
    } else {
      results.emailSent = false
      results.reason = 'All data is fresh'
    }
  } catch (err) {
    results.error = err.message
    console.error('Staleness check failed:', err)
    axiomLog('error', 'check-staleness threw', {
      route: 'api/check-staleness',
      error: err.message,
      stack: err.stack?.slice(0, 2000),
    })
  }

  // ── Data Retention Cleanup ──────────────────────────────────────────────────
  // Piggyback on weekly staleness check to prune old records.
  // data_updates: keep 1 year, cron_runs: keep 6 months.
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString()
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString()

    const { count: deletedUpdates } = await supabaseAdmin
      .from('data_updates')
      .delete({ count: 'exact' })
      .lt('updated_at', oneYearAgo)

    const { count: deletedRuns } = await supabaseAdmin
      .from('cron_runs')
      .delete({ count: 'exact' })
      .lt('created_at', sixMonthsAgo)

    results.retention = {
      data_updates_pruned: deletedUpdates ?? 0,
      cron_runs_pruned: deletedRuns ?? 0,
    }
  } catch (err) {
    results.retentionError = err.message
    console.error('Retention cleanup failed:', err.message)
  }

  // Log cron run
  try {
    await supabaseAdmin.from('cron_runs').insert({
      cron_name: 'staleness-check',
      status: results.error ? 'failed' : results.issues.length > 0 ? 'partial' : 'success',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      summary: results,
    })
  } catch (err) {
    console.error('Failed to log cron run:', err.message)
  }

  return res.status(200).json(results)
}
