import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

// Tables to export with their display names
const TABLES = [
  { name: 'state_programs', label: 'State Programs' },
  { name: 'county_intelligence', label: 'County Intelligence' },
  { name: 'revenue_rates', label: 'Revenue Rates' },
  { name: 'revenue_stacks', label: 'Revenue Stacks' },
  { name: 'ix_queue_data', label: 'IX Queue Data' },
  { name: 'substations', label: 'Substations' },
  { name: 'news_feed', label: 'News Feed' },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed')

  // Auth: JWT + admin email
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Optional: export a single table
  const tableFilter = req.query.table

  const tablesToExport = tableFilter
    ? TABLES.filter(t => t.name === tableFilter)
    : TABLES

  if (tablesToExport.length === 0) {
    return res.status(400).json({ error: `Unknown table: ${tableFilter}`, available: TABLES.map(t => t.name) })
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
        .order('id', { ascending: true })
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

  // Set filename header for browser downloads
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = tableFilter
    ? `tractova-${tableFilter}-${dateStr}.json`
    : `tractova-backup-${dateStr}.json`

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')

  return res.status(200).json(snapshot)
}
