import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'digest@tractova.com'
const APP_URL = 'https://tractova.com'

const STATUS_RANK = { active: 3, limited: 2, pending: 1, none: 0 }
const STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }
const STATUS_COLOR = { active: '#059669', limited: '#d97706', pending: '#6366f1', none: '#dc2626' }

// Detect alerts for a project against current program data from statePrograms
// We inline a minimal version here since this runs server-side (no JSX imports)
const STATE_STATUS = {
  IL: { csStatus: 'active',  opportunityScore: 78,  ixDifficulty: 'moderate' },
  MN: { csStatus: 'active',  opportunityScore: 72,  ixDifficulty: 'moderate' },
  NY: { csStatus: 'active',  opportunityScore: 85,  ixDifficulty: 'hard'     },
  MA: { csStatus: 'limited', opportunityScore: 68,  ixDifficulty: 'hard'     },
  MD: { csStatus: 'active',  opportunityScore: 74,  ixDifficulty: 'moderate' },
  CO: { csStatus: 'active',  opportunityScore: 70,  ixDifficulty: 'moderate' },
  NJ: { csStatus: 'active',  opportunityScore: 66,  ixDifficulty: 'hard'     },
  ME: { csStatus: 'active',  opportunityScore: 62,  ixDifficulty: 'easy'     },
  OR: { csStatus: 'active',  opportunityScore: 65,  ixDifficulty: 'moderate' },
  WA: { csStatus: 'pending', opportunityScore: 45,  ixDifficulty: 'moderate' },
  VA: { csStatus: 'active',  opportunityScore: 71,  ixDifficulty: 'moderate' },
  CT: { csStatus: 'active',  opportunityScore: 67,  ixDifficulty: 'moderate' },
  RI: { csStatus: 'active',  opportunityScore: 60,  ixDifficulty: 'easy'     },
  NM: { csStatus: 'active',  opportunityScore: 63,  ixDifficulty: 'easy'     },
  HI: { csStatus: 'limited', opportunityScore: 55,  ixDifficulty: 'hard'     },
  CA: { csStatus: 'limited', opportunityScore: 58,  ixDifficulty: 'very_hard'},
  FL: { csStatus: 'none',    opportunityScore: 20,  ixDifficulty: 'hard'     },
  MI: { csStatus: 'active',  opportunityScore: 69,  ixDifficulty: 'moderate' },
}

const IX_RANK = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }

function getAlerts(project) {
  const current = STATE_STATUS[project.state]
  if (!current) return []
  const alerts = []
  const savedRank   = STATUS_RANK[project.cs_status]    ?? 2
  const currentRank = STATUS_RANK[current.csStatus]     ?? 2
  if (currentRank < savedRank) {
    alerts.push(current.csStatus === 'limited'
      ? { level: 'warning', label: 'Capacity Limited' }
      : { level: 'urgent',  label: 'Program Closed'   })
  }
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10)
    alerts.push({ level: 'warning', label: 'Score Drop' })
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'Queue Harder' })
  return alerts
}

function alertPill(alert) {
  const bg    = alert.level === 'urgent' ? '#fef2f2' : '#fffbeb'
  const color = alert.level === 'urgent' ? '#b91c1c' : '#92400e'
  const dot   = alert.level === 'urgent' ? '#ef4444' : '#f59e0b'
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${color};border:1px solid ${color}33;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:600;">
    <span style="width:6px;height:6px;border-radius:50%;background:${dot};display:inline-block;"></span>${alert.label}
  </span>`
}

function projectCard(project) {
  const alerts  = getAlerts(project)
  const state   = STATE_STATUS[project.state]
  const status  = state?.csStatus ?? project.cs_status ?? 'active'
  const score   = state?.opportunityScore ?? project.opportunity_score ?? '—'
  const alertsHtml = alerts.length
    ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${alerts.map(alertPill).join('')}</div>`
    : ''

  return `
  <div style="background:#fff;border:1px solid ${alerts.some(a => a.level === 'urgent') ? '#fca5a5' : '#e5e7eb'};border-radius:10px;padding:16px 20px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p style="margin:0;font-weight:700;font-size:15px;color:#0f172a;">${project.name}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${project.state_name ?? project.state} · ${project.county ?? ''} · ${project.mw ?? '—'} MW · ${project.stage ?? '—'}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:11px;color:${STATUS_COLOR[status] ?? '#6b7280'};font-weight:600;">${STATUS_LABEL[status] ?? status}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Score: <strong style="color:#0f172a;">${score}</strong></p>
      </div>
    </div>
    ${alertsHtml}
  </div>`
}

function buildDigestHtml(user, projects) {
  const hasAlerts   = projects.some(p => getAlerts(p).length > 0)
  const projectsHtml = projects.map(projectCard).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">

    <!-- Header -->
    <div style="background:#063629;border-radius:12px 12px 0 0;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">tractova</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6ee7b7;">Weekly Project Digest</p>
    </div>

    <!-- Body -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:15px;color:#0f172a;">Hi ${user.email?.split('@')[0] ?? 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;">Here's your weekly snapshot of ${projects.length} saved project${projects.length !== 1 ? 's' : ''}${hasAlerts ? ' — <strong style="color:#b45309;">some have alerts that need your attention</strong>' : ''}.</p>

      ${projectsHtml}

      <div style="margin-top:24px;text-align:center;">
        <a href="${APP_URL}/library" style="display:inline-block;background:#063629;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">Open My Projects →</a>
      </div>

      <p style="margin:28px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
        You're receiving this because you have a Tractova Pro subscription.<br>
        <a href="${APP_URL}/profile" style="color:#94a3b8;">Manage account</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  // Allow manual trigger via POST, or scheduled GET from Vercel cron
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  // Cron secret guard — skip if no secret configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch all Pro users
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier, subscription_status')
      .eq('subscription_tier', 'pro')
      .in('subscription_status', ['active', 'trialing'])

    if (profileErr) throw profileErr

    const results = []

    for (const profile of profiles ?? []) {
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

      const html = buildDigestHtml(user, projects)
      const subject = `Your weekly Tractova digest — ${projects.length} project${projects.length !== 1 ? 's' : ''}`

      await sendEmail(user.email, subject, html)
      results.push({ email: user.email, projects: projects.length })
    }

    return res.status(200).json({ sent: results.length, results })
  } catch (err) {
    console.error('Digest error:', err)
    return res.status(500).json({ error: err.message })
  }
}
