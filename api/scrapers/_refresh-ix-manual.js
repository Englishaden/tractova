/**
 * Manual IX-queue ingest handler (Phase 4a) — upserts admin-uploaded
 * interconnection-queue CSV rows into ix_queue_data for the gated states
 * (NJ ACE, ME CMP, MN Xcel, HI HECO, OR OASIS) that have no machine feed.
 *
 * Routed via refresh-data?source=ix_manual (admin-gated, POST body carries the
 * CSV text) so it needs NO new top-level api file — the Vercel Hobby fn cap is
 * at 12/12. Parsing is _ixManual.parseIxManualCsv (TEXT only — never a workbook,
 * per CLAUDE.md §9). Rows are data_source:'manual'; the IX SCORE stays on the
 * curated ixDifficulty baseline (live queue rows are CONTEXT, ixLiveAdjustment=0),
 * so a manual upload enriches the queue display without silently moving a score.
 *
 * Upsert grain matches the cron: onConflict (state_id, utility_name,
 * metering_type) — re-uploading a state replaces its rows in place.
 */
import { supabaseAdmin } from './_scraperBase.js'
import { parseIxManualCsv } from './_ixManual.js'
import { logAdminAction } from '../_admin-auth.js'

export default async function refreshIxManual(body, actor) {
  const csv = body?.csv
  if (typeof csv !== 'string' || !csv.trim()) {
    return { ok: false, error: 'ix_manual expects a POST body { csv: "<text>" } — no CSV received' }
  }
  if (csv.length > 2_000_000) {   // ~2 MB cap — a county/utility queue CSV is tiny
    return { ok: false, error: `CSV too large (${csv.length} bytes); manual IX uploads are expected to be small` }
  }

  const { rows, errors, headerCols } = parseIxManualCsv(csv)
  if (rows.length === 0) {
    return { ok: false, error: 'No valid rows parsed', parse_errors: errors.slice(0, 50), header_seen: headerCols }
  }

  const nowIso = new Date().toISOString()
  const upsertRows = rows.map(r => ({ ...r, fetched_at: nowIso }))

  const { error } = await supabaseAdmin
    .from('ix_queue_data')
    .upsert(upsertRows, { onConflict: 'state_id,utility_name,metering_type' })
  if (error) return { ok: false, error: `upsert failed: ${error.message}`, rows_attempted: upsertRows.length }

  const states = [...new Set(rows.map(r => r.state_id))].sort()

  // F-06: this is a service-role write, so the migration-085 DB trigger can't
  // see the admin actor — log it app-side where the identity is known.
  await logAdminAction(supabaseAdmin, actor, {
    action: 'upsert',
    targetTable: 'ix_queue_data',
    targetId: states.join(','),
    details: { rows_upserted: upsertRows.length, states, source: 'ix_manual' },
  })

  return {
    ok: true,
    rows_upserted: upsertRows.length,
    states,
    metering_types: [...new Set(rows.map(r => r.metering_type))].sort(),
    // Surface (non-fatal) row-drop warnings so the admin sees what didn't ingest.
    parse_warnings: errors.length ? errors.slice(0, 50) : undefined,
  }
}
