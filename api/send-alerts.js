import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'alerts@tractova.com'
const APP_URL = 'https://tractova.com'

const STATUS_RANK = { active: 3, limited: 2, pending: 1, none: 0 }

const STATE_STATUS = {
  IL: { csStatus: 'active',  opportunityScore: 78,  ixDifficulty: 'moderate', name: 'Illinois'      },
  MN: { csStatus: 'active',  opportunityScore: 72,  ixDifficulty: 'moderate', name: 'Minnesota'     },
  NY: { csStatus: 'active',  opportunityScore: 85,  ixDifficulty: 'hard',     name: 'New York'      },
  MA: { csStatus: 'limited', opportunityScore: 68,  ixDifficulty: 'hard',     name: 'Massachusetts' },
  MD: { csStatus: 'active',  opportunityScore: 74,  ixDifficulty: 'moderate', name: 'Maryland'      },
  CO: { csStatus: 'active',  opportunityScore: 70,  ixDifficulty: 'moderate', name: 'Colorado'      },
  NJ: { csStatus: 'active',  opportunityScore: 66,  ixDifficulty: 'hard',     name: 'New Jersey'    },
  ME: { csStatus: 'active',  opportunityScore: 62,  ixDifficulty: 'easy',     name: 'Maine'         },
  OR: { csStatus: 'active',  opportunityScore: 65,  ixDifficulty: 'moderate', name: 'Oregon'        },
  WA: { csStatus: 'pending', opportunityScore: 45,  ixDifficulty: 'moderate', name: 'Washington'    },
  VA: { csStatus: 'active',  opportunityScore: 71,  ixDifficulty: 'moderate', name: 'Virginia'      },
  CT: { csStatus: 'active',  opportunityScore: 67,  ixDifficulty: 'moderate', name: 'Connecticut'   },
  RI: { csStatus: 'active',  opportunityScore: 60,  ixDifficulty: 'easy',     name: 'Rhode Island'  },
  NM: { csStatus: 'active',  opportunityScore: 63,  ixDifficulty: 'easy',     name: 'New Mexico'    },
  HI: { csStatus: 'limited', opportunityScore: 55,  ixDifficulty: 'hard',     name: 'Hawaii'        },
  CA: { csStatus: 'limited', opportunityScore: 58,  ixDifficulty: 'very_hard',name: 'California'    },
  FL: { csStatus: 'none',    opportunityScore: 20,  ixDifficulty: 'hard',     name: 'Florida'       },
  MI: { csStatus: 'active',  opportunityScore: 69,  ixDifficulty: 'moderate', name: 'Michigan'      },
}

const IX_RANK = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }

function getUrgentAlerts(project) {
  const current = STATE_STATUS[project.state]
  if (!current) return []
  const alerts = []
  const savedRank   = STATUS_RANK[project.cs_status] ?? 2
  const currentRank = STATUS_RANK[current.csStatus]  ?? 2
  if (currentRank < savedRank) {
    alerts.push(current.csStatus === 'limited'
      ? { level: 'warning', label: 'Capacity Limited', detail: `The ${current.name} community solar program has moved to limited capacity.` }
      : { level: 'urgent',  label: 'Program Closed',   detail: `The ${current.name} community solar program is no longer active.` })
  }
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10)
    alerts.push({ level: 'warning', label: 'Opportunity Score Drop', detail: `Score dropped from ${project.opportunity_score} to ${current.opportunityScore}.` })
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'IX Queue Harder', detail: `Interconnection difficulty increased from ${project.ix_difficulty} to ${current.ixDifficulty}.` })
  return alerts
}

function buildAlertHtml(user, project, alerts) {
  const alertRows = alerts.map(a => {
    const isUrgent = a.level === 'urgent'
    const bg    = isUrgent ? '#fef2f2' : '#fffbeb'
    const color = isUrgent ? '#991b1b' : '#92400e'
    const icon  = isUrgent ? '🔴' : '⚠️'
    return `
    <div style="background:${bg};border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <p style="margin:0;font-weight:700;font-size:13px;color:${color};">${icon} ${a.label}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#374151;">${a.detail}</p>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">

    <div style="background:#063629;border-radius:12px 12px 0 0;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">tractova</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6ee7b7;">Policy Alert</p>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:15px;color:#0f172a;">Hi ${user.email?.split('@')[0] ?? 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;">There are updates affecting one of your saved projects that may impact your underwriting.</p>

      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-weight:700;font-size:15px;color:#0f172a;">${project.name}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${project.state_name ?? project.state} · ${project.county ?? ''} · ${project.mw ?? '—'} MW</p>
      </div>

      ${alertRows}

      <div style="margin-top:24px;text-align:center;">
        <a href="${APP_URL}/library" style="display:inline-block;background:#063629;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">Review Project →</a>
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
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, subscription_tier, subscription_status')
      .eq('subscription_tier', 'pro')
      .in('subscription_status', ['active', 'trialing'])

    if (profileErr) throw profileErr

    const results = []

    for (const profile of profiles ?? []) {
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      if (userErr || !user?.email) continue

      const { data: projects, error: projErr } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('user_id', profile.id)

      if (projErr || !projects?.length) continue

      for (const project of projects) {
        const alerts = getUrgentAlerts(project)
        if (!alerts.length) continue

        const hasUrgent = alerts.some(a => a.level === 'urgent')
        const subject = hasUrgent
          ? `Action required: Program alert for "${project.name}"`
          : `Policy update for your project "${project.name}"`

        const html = buildAlertHtml(user, project, alerts)
        await sendEmail(user.email, subject, html)
        results.push({ email: user.email, project: project.name, alerts: alerts.map(a => a.label) })
      }
    }

    return res.status(200).json({ sent: results.length, results })
  } catch (err) {
    console.error('Alerts error:', err)
    return res.status(500).json({ error: err.message })
  }
}
