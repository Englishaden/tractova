import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

// ── Auth ────────────────────────────────────────────────────────────────────
async function authenticateAdmin(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return null
  return user
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
      await supabaseAdmin.from('data_updates').insert({
        table_name: 'state_programs',
        row_id: id,
        field,
        old_value: live[field] != null ? String(live[field]) : null,
        new_value: String(staged[field]),
        updated_by: `staging:${staged.submitted_by || 'unknown'}`,
      }).catch(() => {})
    }
  }

  return res.status(200).json({ status: 'approved', id, fieldsUpdated: Object.keys(updates).length })
}

// ── Freshness (default) ─────────────────────────────────────────────────────
async function handleFreshness(req, res) {
  const [freshnessResult, cronRunsResult, dataUpdatesResult] = await Promise.all([
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
  ])

  return res.status(200).json({
    freshness: freshnessResult.data,
    cronRuns: cronRunsResult.data || [],
    dataUpdates: dataUpdatesResult.data || [],
  })
}

// ── Router ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const user = await authenticateAdmin(req)
  if (!user) return res.status(403).json({ error: 'Forbidden' })

  const action = req.query.action

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
