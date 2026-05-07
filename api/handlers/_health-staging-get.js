/**
 * Staging GET — list pending/approved/rejected staging records with diffs
 * Action: 'staging' (GET)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Staging ─────────────────────────────────────────────────────────────────
const PROMOTABLE_FIELDS = [
  'cs_status', 'cs_program', 'capacity_mw', 'lmi_required', 'lmi_percent',
  'ix_difficulty', 'ix_notes', 'program_notes', 'enrollment_rate_mw_per_month',
]

export default async function handleStagingGet(req, res) {
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
