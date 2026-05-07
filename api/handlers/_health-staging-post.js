/**
 * Staging POST — approve/reject staged state_programs edits, promote to live
 * Action: 'staging' (POST)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PROMOTABLE_FIELDS = [
  'cs_status', 'cs_program', 'capacity_mw', 'lmi_required', 'lmi_percent',
  'ix_difficulty', 'ix_notes', 'program_notes', 'enrollment_rate_mw_per_month',
]

export default async function handleStagingPost(req, res) {
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
      try {
        await supabaseAdmin.from('data_updates').insert({
          table_name: 'state_programs',
          row_id: id,
          field,
          old_value: live[field] != null ? String(live[field]) : null,
          new_value: String(staged[field]),
          updated_by: `staging:${staged.submitted_by || 'unknown'}`,
        })
      } catch { /* best-effort logging */ }
    }
  }

  return res.status(200).json({ status: 'approved', id, fieldsUpdated: Object.keys(updates).length })
}
