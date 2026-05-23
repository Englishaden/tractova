import { isAdminFromBearer } from './_admin-auth.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'
import { axiomLog } from './lib/_axiomLog.js'
import { scrapeNyDg } from './scrapers/_refresh-ny-dg.js'
import { scrapeNjDg } from './scrapers/_refresh-nj-dg.js'

// ─────────────────────────────────────────────────────────────────────────────
// IX Queue Refresh Cron
//
// Runs weekly (Sunday 6 AM UTC). Refreshes the distribution-level community-DG
// signal that drives the IX pillar's live CONTEXT.
//
// HISTORY / why this is not the ISO transmission queue: the original design
// scraped ISO queues (PJM/MISO/NYISO/ISO-NE) filtered to <25MW solar. We
// verified empirically (scripts/probe-iso-counts.mjs, 2026-05-22) that ISO
// transmission queues contain almost NO community-scale solar — CS interconnects
// at the DISTRIBUTION level, which ISO queues don't see (IL had 68 solar in the
// MISO queue, ZERO under 25MW). The ISO scrapers were removed.
//
// Current source: NY — NYSERDA Solar Electric Programs (community_distributed_
// generation flag), a redistribution-safe DEPLOYMENT-PIPELINE signal. See
// api/scrapers/_refresh-ny-dg.js. Other states retain curated/seed rows until a
// redistribution-safe distribution feed is wired (NJ BPU / MA DOER are next).
//
// Each scraper is independent — one failure doesn't block the others.
// ─────────────────────────────────────────────────────────────────────────────

// State distribution-DG scrapers. Each returns ready-to-upsert ix_queue_data
// rows (snake_case DB shape) for its state(s), or throws on failure.
const SCRAPERS = [
  { name: 'NY-DG', fn: scrapeNyDg },
  { name: 'NJ-DG', fn: scrapeNjDg },
]

// ── Trend computation ────────────────────────────────────────────────────────

function computeTrend(newCount, oldCount) {
  if (oldCount == null) return 'stable'
  const delta = (newCount - oldCount) / Math.max(oldCount, 1)
  if (delta > 0.10) return 'growing'
  if (delta < -0.10) return 'shrinking'
  return 'stable'
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    return await handlerInner(req, res)
  } catch (err) {
    console.error('[refresh-ix-queue] uncaught:', err)
    await axiomLog('error', 'refresh-ix-queue uncaught', {
      route: 'api/refresh-ix-queue',
      error: err?.message,
      stack: err?.stack?.slice(0, 2000),
    })
    return res.status(500).json({
      error: err?.message || String(err),
      where: 'refresh-ix-queue',
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })
  }
}

async function handlerInner(req, res) {
  // Auth: Vercel cron header, CRON_SECRET bearer, or admin-user JWT.
  const authHeader = req.headers.authorization
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isBearerAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  let isAdminAuth = false
  if (!isVercelCron && !isBearerAuth && authHeader?.startsWith('Bearer ')) {
    const adminCheck = await isAdminFromBearer(supabaseAdmin, authHeader)
    if (adminCheck.ok) isAdminAuth = true
  }

  if (!isVercelCron && !isBearerAuth && !isAdminAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = new Date()
  const results = { success: [], failed: [], updated: 0, unchanged: 0, warnings: [], snapshotsRecorded: 0 }

  // Existing rows for trend comparison (keyed by state:utility).
  const { data: existing } = await supabaseAdmin
    .from('ix_queue_data')
    .select('state_id, utility_name, projects_in_queue')
  const existingMap = {}
  for (const row of (existing || [])) {
    existingMap[`${row.state_id}:${row.utility_name}`] = row.projects_in_queue
  }

  // Run all scrapers in parallel — each is independent.
  const settled = await Promise.allSettled(
    SCRAPERS.map(async (s) => {
      try {
        return { name: s.name, rows: await s.fn() }
      } catch (err) {
        throw { name: s.name, error: err.message }
      }
    })
  )

  const allRows = []
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      // Skip a scraper that returned 0 rows (treat as a soft failure, don't
      // wipe context). Only count it as success when it produced data.
      if (!r.value.rows || r.value.rows.length === 0) {
        results.warnings.push(`${r.value.name} returned 0 rows — skipped`)
        results.failed.push({ scraper: r.value.name, error: '0 rows' })
        continue
      }
      results.success.push(r.value.name)
      allRows.push(...r.value.rows)
    } else {
      results.failed.push({ scraper: r.reason.name, error: r.reason.error })
    }
  }

  // Upsert each row; compute trend; log changes; snapshot for the time series.
  for (const row of allRows) {
    const key = `${row.state_id}:${row.utility_name}`
    const oldCount = existingMap[key]
    const trend = computeTrend(row.projects_in_queue, oldCount)

    // Flag large drops but still write (data honesty over silent skip).
    if (oldCount != null && oldCount > 0 && row.projects_in_queue < oldCount * 0.5) {
      results.warnings.push(`${key}: projects dropped ${Math.round((1 - row.projects_in_queue / oldCount) * 100)}% (${oldCount} → ${row.projects_in_queue})`)
    }

    const upsertRow = { ...row, queue_trend: trend }

    const { error } = await supabaseAdmin
      .from('ix_queue_data')
      .upsert(upsertRow, { onConflict: 'state_id,utility_name' })

    if (error) {
      results.failed.push({ utility: row.utility_name, error: error.message })
      continue
    }
    if (oldCount !== row.projects_in_queue) {
      results.updated++
      await supabaseAdmin.from('data_updates').insert({
        table_name: 'ix_queue_data',
        row_id: key,
        field: 'projects_in_queue',
        old_value: String(oldCount ?? 'null'),
        new_value: String(row.projects_in_queue),
        updated_by: 'ix-queue-scraper',
      })
    } else {
      results.unchanged++
    }

    // Append a snapshot regardless of change (builds the trend time series).
    const { error: snapErr } = await supabaseAdmin.from('ix_queue_snapshots').insert({
      state_id:            row.state_id,
      iso:                 row.iso,
      utility_name:        row.utility_name,
      projects_in_queue:   row.projects_in_queue,
      mw_pending:          row.mw_pending,
      queue_trend:         trend,
      avg_study_months:    row.avg_study_months ?? null,
      withdrawal_pct:      row.withdrawal_pct ?? null,
      avg_upgrade_cost_mw: row.avg_upgrade_cost_mw ?? null,
      data_source:         row.data_source,
    })
    if (snapErr) {
      console.warn(`[ix-queue] snapshot insert failed for ${key}:`, snapErr.message)
    } else {
      results.snapshotsRecorded++
    }
  }

  // Log cron run for observability.
  try {
    await supabaseAdmin.from('cron_runs').insert({
      cron_name: 'ix-queue-refresh',
      status: results.failed.length > 0 ? 'partial' : 'success',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      summary: results,
    })
  } catch (err) {
    console.error('Failed to log cron run:', err.message)
  }

  return res.status(200).json({
    message: 'IX queue refresh complete',
    ...results,
    timestamp: new Date().toISOString(),
  })
}
