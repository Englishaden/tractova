/**
 * Export — JSON snapshot of selected admin tables for backup/audit
 * Action: 'export'
 */
import { supabaseAdmin } from '../lib/_supabaseAdmin.js'

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

export default async function handleExport(req, res, user) {
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
