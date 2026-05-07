import { createClient } from '@supabase/supabase-js'
import { STATUS_LABEL, buildStateMap } from './lib/_alertClassifier.js'
import { buildDigestHtml, buildDigestText } from './templates/_digestEmail.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'digest@tractova.com'

// reply_to routes user replies to hello@tractova.com (Namecheap forwarding →
// Aden's Gmail). Without this, replies bounce on the unattended digest@
// from-address. Site-walk Session 5 / I3.
const REPLY_TO_EMAIL = 'hello@tractova.com'

// List-Unsubscribe headers unlock Gmail's one-click "Unsubscribe" UI in the
// inbox header, plus mark the message as transactional/preference-driven for
// spam-filter scoring. Both header values are required for one-click flow:
//   - mailto: lets users unsubscribe via email (handled by hello@ inbox)
//   - https: lets clients show the inline button → /profile to flip prefs
const LIST_UNSUBSCRIBE_HEADER = '<mailto:hello@tractova.com?subject=Unsubscribe%20from%20Tractova%20Digest>, <https://tractova.com/profile>'

async function sendEmail(to, subject, html, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      reply_to: REPLY_TO_EMAIL,
      to,
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': LIST_UNSUBSCRIBE_HEADER,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
  return res.json()
}

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  // Three valid auth paths:
  //   1. Vercel cron header                        -> full run, all Pro users
  //   2. Bearer CRON_SECRET (manual cron trigger)  -> full run, all Pro users
  //   3. Authenticated admin user via Supabase JWT -> TEST MODE, sends only
  //                                                   to the admin email
  const isVercelCron       = req.headers['x-vercel-cron'] === '1'
  const isManualWithSecret = process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`

  let testMode = false
  let testUserId = null

  if (!isVercelCron && !isManualWithSecret) {
    // Try admin JWT (test path)
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    testMode = true
    testUserId = user.id
  }

  try {
    // Load live state data — replaces the former hardcoded STATE_STATUS object
    const { data: stateRows, error: stateErr } = await supabaseAdmin
      .from('state_programs')
      .select('id, name, cs_status, capacity_mw, lmi_percent, ix_difficulty')
    if (stateErr) throw stateErr
    const stateMap = buildStateMap(stateRows ?? [])

    // V3 Wave 1.5: pre-fetch the past 7 days of activity once, indexed by state.
    // Each user's digest filters this to their portfolio. Best-effort -- if any
    // table query fails, motion section just renders empty.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const activity = {}  // { [stateId]: { newsCount, updateCount, headline, lastChange } }
    try {
      const [newsRes, updRes] = await Promise.all([
        supabaseAdmin.from('news_feed')
          .select('headline, tags, state_ids, date, type')
          .gte('date', sevenDaysAgo.slice(0, 10))
          .order('date', { ascending: false }),
        supabaseAdmin.from('data_updates')
          .select('row_id, table_name, field, old_value, new_value, created_at')
          .eq('table_name', 'state_programs')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false }),
      ])
      // Bucket news by state. Tags or state_ids may carry the state ID.
      for (const item of newsRes.data ?? []) {
        const stateIds = Array.isArray(item.state_ids) ? item.state_ids
          : Array.isArray(item.tags) ? item.tags.filter(t => typeof t === 'string' && t.length === 2 && t === t.toUpperCase())
          : []
        for (const sid of stateIds) {
          if (!activity[sid]) activity[sid] = { newsCount: 0, updateCount: 0, headline: null, lastChange: null }
          activity[sid].newsCount++
          if (!activity[sid].headline) activity[sid].headline = item.headline
        }
      }
      // Bucket data_updates by state. row_id for state_programs is just the state code.
      // Field + value formatters keep raw DB enums (cs_status=limited, ix_difficulty=very_hard)
      // out of user-visible copy.
      const FIELD_LABELS = {
        cs_status: 'Status',
        ix_difficulty: 'IX difficulty',
        capacity_mw: 'Program capacity',
        lmi_percent: 'LMI requirement',
        rec_price: 'REC price',
      }
      const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very hard' }
      const formatChangeValue = (field, value) => {
        if (value == null || value === '') return '—'
        if (field === 'cs_status') return STATUS_LABEL[value] ?? value
        if (field === 'ix_difficulty') return IX_LABEL[value] ?? value
        if (field === 'capacity_mw') return `${value} MW`
        if (field === 'lmi_percent') return `${value}%`
        return value
      }
      for (const upd of updRes.data ?? []) {
        const sid = upd.row_id
        if (!sid) continue
        if (!activity[sid]) activity[sid] = { newsCount: 0, updateCount: 0, headline: null, lastChange: null }
        activity[sid].updateCount++
        if (!activity[sid].lastChange) {
          const field = upd.field || ''
          const fieldLabel = FIELD_LABELS[field] ?? field.replace(/_/g, ' ')
          const from = formatChangeValue(field, upd.old_value)
          const to   = formatChangeValue(field, upd.new_value)
          activity[sid].lastChange = `${fieldLabel}: ${from} → ${to}`
        }
      }
    } catch (motionErr) {
      console.warn('[send-digest] motion fetch failed (section will be empty):', motionErr.message)
    }

    // Fetch profiles. In test mode, ONLY the admin's profile.
    let profilesQuery = supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier, subscription_status, alert_digest')
    if (testMode) {
      profilesQuery = profilesQuery.eq('id', testUserId)
    } else {
      profilesQuery = profilesQuery
        .eq('subscription_tier', 'pro')
        .in('subscription_status', ['active', 'trialing'])
    }
    const { data: profiles, error: profileErr } = await profilesQuery

    if (profileErr) throw profileErr

    const results = []

    for (const profile of profiles ?? []) {
      // Respect digest preference — default on if column not yet set.
      // In test mode, IGNORE the preference (otherwise we can't test
      // when we've turned ourselves off).
      if (!testMode && profile.alert_digest === false) continue

      // Get user email from auth
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      if (userErr || !user?.email) continue

      // Fetch their saved projects
      const { data: projects, error: projErr } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('user_id', profile.id)
        .order('saved_at', { ascending: false })

      if (projErr || !projects?.length) continue

      const html = buildDigestHtml(user, projects, stateMap, activity)
      const text = buildDigestText(user, projects, stateMap)
      const baseSubject = `Your weekly Tractova digest — ${projects.length} project${projects.length !== 1 ? 's' : ''}`
      const subject = testMode ? `[TEST] ${baseSubject}` : baseSubject

      await sendEmail(user.email, subject, html, text)
      results.push({ email: user.email, projects: projects.length })
    }

    return res.status(200).json({ sent: results.length, testMode, results })
  } catch (err) {
    console.error('Digest error:', err)
    return res.status(500).json({ error: err.message })
  }
}
