import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

// Fields that can be promoted from staging to live
const PROMOTABLE_FIELDS = [
  'cs_status', 'cs_program', 'capacity_mw', 'lmi_required', 'lmi_percent',
  'ix_difficulty', 'ix_notes', 'program_notes', 'enrollment_rate_mw_per_month',
]

async function authenticateAdmin(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return null
  return user
}

export default async function handler(req, res) {
  const user = await authenticateAdmin(req)
  if (!user) return res.status(403).json({ error: 'Forbidden' })

  // GET — list pending staging records
  if (req.method === 'GET') {
    const status = req.query.status || 'pending'
    const { data, error } = await supabaseAdmin
      .from('state_programs_staging')
      .select('*')
      .eq('review_status', status)
      .order('submitted_at', { ascending: false })
      .limit(50)

    if (error) return res.status(500).json({ error: error.message })

    // For each staging record, fetch the live version for diff comparison
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
        // New state — all non-null fields are "new"
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

  // POST — approve or reject a staging record
  if (req.method === 'POST') {
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

    // Build update object from non-null staging fields
    const updates = {}
    for (const field of PROMOTABLE_FIELDS) {
      if (staged[field] != null) updates[field] = staged[field]
    }
    updates.data_source = staged.data_source || 'staging-promoted'
    updates.last_verified = new Date().toISOString()
    updates.updated_by = 'admin-staging'

    // Fetch current live values for audit log
    const { data: live } = await supabaseAdmin
      .from('state_programs')
      .select('*')
      .eq('id', id)
      .single()

    // Upsert to live table
    const { error: upsertErr } = await supabaseAdmin
      .from('state_programs')
      .upsert({ id, name: staged.name, ...updates }, { onConflict: 'id' })

    if (upsertErr) {
      return res.status(500).json({ error: `Promote failed: ${upsertErr.message}` })
    }

    // Mark staging record as approved
    await supabaseAdmin
      .from('state_programs_staging')
      .update({ review_status: 'approved' })
      .eq('id', id)
      .eq('submitted_at', submitted_at)

    // Log changes to data_updates
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

  return res.status(405).end('Method Not Allowed')
}
