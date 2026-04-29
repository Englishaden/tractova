import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'alerts@tractova.com'
const APP_URL = 'https://tractova.com'

const STATUS_RANK = { active: 3, limited: 2, pending: 1, none: 0 }
const IX_RANK     = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }

// Deterministic feasibility score — mirrors programData.js formula exactly.
// Inlined here so this serverless function has no client-side import dependency.
function computeFeasibilityScore(row) {
  const base     = { active: 65, limited: 40, pending: 18, none: 5 }[row.cs_status] ?? 5
  const mw       = row.capacity_mw ?? 0
  const capacity = mw > 1000 ? 12 : mw > 500 ? 8 : mw > 100 ? 4 : mw > 0 ? 2 : 0
  const lmi      = row.lmi_percent ?? 0
  const lmiP     = lmi >= 40 ? -14 : lmi >= 25 ? -7 : lmi >= 10 ? -3 : 0
  const ix       = { easy: 12, moderate: 3, hard: -10, very_hard: -22 }[row.ix_difficulty] ?? 3
  return Math.min(95, Math.max(1, base + capacity + lmiP + ix))
}

// Build state map from live Supabase rows
function buildStateMap(rows) {
  return Object.fromEntries(rows.map(r => [r.id, {
    csStatus:         r.cs_status,
    opportunityScore: computeFeasibilityScore(r),
    ixDifficulty:     r.ix_difficulty,
    name:             r.name,
  }]))
}

function getUrgentAlerts(project, stateMap) {
  const current = stateMap[project.state]
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

  // V3 brand tokens (matches send-digest.js)
  const FONT_SERIF = `'Source Serif 4', 'Source Serif Pro', Georgia, serif`
  const FONT_SANS  = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  const FONT_MONO  = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    body { margin: 0; padding: 0; }
  </style>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:${FONT_SANS};-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:32px auto;padding:0 16px;">

    <!-- V3 header: navy with teal rail + amber-tinted "Policy Alert" eyebrow (semantic) -->
    <div style="background:linear-gradient(135deg,#0F1A2E 0%,#0A132A 100%);border-radius:10px 10px 0 0;padding:28px 32px;border-top:2px solid #F59E0B;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#FCD34D;font-family:${FONT_MONO};">
        ◆ Policy Alert · Action Required
      </p>
      <p style="margin:0;font-size:26px;font-weight:600;color:#FFFFFF;letter-spacing:-0.02em;font-family:${FONT_SERIF};line-height:1.1;">
        Tractova
      </p>
    </div>

    <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:28px 32px;">
      <p style="margin:0 0 6px;font-size:15px;color:#0A1828;font-family:${FONT_SANS};">Good morning ${user.email?.split('@')[0] ?? 'there'},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5A6B7A;line-height:1.5;font-family:${FONT_SANS};">There are updates affecting one of your saved projects that may impact your underwriting.</p>

      <!-- Project identity card -->
      <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-left:3px solid #D97706;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-weight:600;font-size:18px;color:#0A1828;font-family:${FONT_SERIF};letter-spacing:-0.015em;line-height:1.2;">${project.name}</p>
        <p style="margin:6px 0 0;font-size:11px;color:#5A6B7A;font-family:${FONT_MONO};letter-spacing:0.04em;">${(project.state_name ?? project.state ?? '').toUpperCase()} · ${(project.county ?? '').toUpperCase()} · ${project.mw ?? '—'} MW</p>
      </div>

      ${alertRows}

      <div style="margin-top:24px;text-align:center;">
        <a href="${APP_URL}/library" style="display:inline-block;background:#14B8A6;color:#FFFFFF;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;font-family:${FONT_SANS};box-shadow:0 4px 12px rgba(20,184,166,0.25);">
          Review Project →
        </a>
      </div>

      <!-- Platform note -->
      <p style="margin:20px 0 0;padding:12px 14px;background:#FAFAF7;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;color:#5A6B7A;font-family:${FONT_SANS};line-height:1.5;">
        <span style="font-family:${FONT_MONO};font-weight:700;letter-spacing:0.16em;text-transform:uppercase;font-size:9px;color:#0A1828;">Note ·</span>
        Tractova is currently optimized for desktop browsers. A mobile experience is on the roadmap — for now, links open best from a laptop or larger screen.
      </p>

      <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#5A6B7A;text-align:center;font-family:${FONT_SANS};line-height:1.6;">
        You're receiving this because you have a Tractova Pro subscription.<br>
        <a href="${APP_URL}/profile" style="color:#0F766E;text-decoration:none;font-weight:500;">Manage notifications</a>
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

// V3 Wave 1.3: Slack incoming-webhook delivery using Block Kit format.
// Best-effort -- Slack failures don't fail the alert. We catch and log.
function buildSlackBlocks(project, alerts, userName) {
  const hasUrgent = alerts.some(a => a.level === 'urgent')
  const headerEmoji = hasUrgent ? ':rotating_light:' : ':warning:'
  const headerText = hasUrgent
    ? `Action Required — ${project.name}`
    : `Policy Alert — ${project.name}`

  const meta = [
    project.state_name ?? project.state,
    project.county,
    project.mw ? `${project.mw} MW` : null,
    project.stage,
  ].filter(Boolean).join(' · ')

  const alertLines = alerts
    .map(a => `• *${a.label}* — ${a.detail || a.level}`)
    .join('\n')

  return {
    text: `${headerEmoji} ${headerText}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${headerEmoji} ${headerText}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `*${meta}*` }],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: alertLines },
      },
      {
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: 'Review in Library →' },
          url: `${APP_URL}/library`,
          style: hasUrgent ? 'danger' : 'primary',
        }],
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Tractova · sent to ${userName || 'subscriber'} · <${APP_URL}/profile|Manage notifications>`,
        }],
      },
    ],
  }
}

async function sendSlack(webhookUrl, payload) {
  // 8s timeout so a hung Slack endpoint can't stall the cron
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Slack ${res.status}: ${err.slice(0, 200)}`)
    }
    return true
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  // Three valid auth paths (matches send-digest):
  //   1. Vercel cron header
  //   2. Bearer CRON_SECRET
  //   3. Admin JWT -> TEST MODE (synthesizes a sample alert for the admin's
  //      first project; ignores alert_urgent preference; bypasses the
  //      "no real alerts -> skip" guard so we always get a deliverable)
  const isVercelCron     = req.headers['x-vercel-cron'] === '1'
  const isManualWithSecret = process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`

  let testMode = false
  let testUserId = null
  let testChannel = 'email'  // 'email' | 'slack'
  if (!isVercelCron && !isManualWithSecret) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    testMode = true
    testUserId = user.id
    // Channel selector via query string OR JSON body
    const url = new URL(req.url, `https://${req.headers.host}`)
    const qChannel = url.searchParams.get('channel')
    let bChannel = null
    try { bChannel = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)?.channel } catch {}
    testChannel = (qChannel || bChannel || 'email') === 'slack' ? 'slack' : 'email'
  }

  try {
    // Load live state data — replaces the former hardcoded STATE_STATUS object
    const { data: stateRows, error: stateErr } = await supabaseAdmin
      .from('state_programs')
      .select('id, name, cs_status, capacity_mw, lmi_percent, ix_difficulty')
    if (stateErr) throw stateErr
    const stateMap = buildStateMap(stateRows ?? [])

    // V3 Wave 1.3: pull slack_webhook_url + alert_slack alongside email prefs.
    // Schema-cache-resilient: if migration 013 hasn't run, those columns
    // come back as undefined and we silently skip Slack delivery.
    const profileColumns = 'id, subscription_tier, subscription_status, alert_urgent, slack_webhook_url, alert_slack'
    let profilesData, profileErr
    const buildQuery = (cols) => {
      let q = supabaseAdmin.from('profiles').select(cols)
      if (testMode) {
        q = q.eq('id', testUserId)
      } else {
        q = q.eq('subscription_tier', 'pro').in('subscription_status', ['active', 'trialing'])
      }
      return q
    }
    try {
      const result = await buildQuery(profileColumns)
      profilesData = result.data
      profileErr = result.error
    } catch (e) {
      profileErr = e
    }
    // Fallback if Slack columns not yet migrated
    if (profileErr && /slack_webhook_url|alert_slack/.test(profileErr.message || '')) {
      const fallback = await buildQuery('id, subscription_tier, subscription_status, alert_urgent')
      profilesData = fallback.data
      profileErr = fallback.error
    }
    if (profileErr) throw profileErr

    const results = []
    const slackResults = { sent: 0, failed: 0 }

    for (const profile of profilesData ?? []) {
      // In test mode, ignore the user's preferences and bypass channel gating.
      const wantsEmail = testMode ? testChannel === 'email' : profile.alert_urgent !== false
      const wantsSlack = testMode
        ? (testChannel === 'slack' && profile.slack_webhook_url)
        : (profile.alert_slack === true && profile.slack_webhook_url)
      if (!wantsEmail && !wantsSlack) {
        if (testMode && testChannel === 'slack' && !profile.slack_webhook_url) {
          return res.status(400).json({ error: 'No Slack webhook URL configured. Save one in Profile -> Slack delivery first.' })
        }
        continue
      }

      const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      if (userErr || !user?.email) continue

      const { data: projects, error: projErr } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('user_id', profile.id)

      if (projErr || !projects?.length) continue

      for (const project of projects) {
        let alerts = getUrgentAlerts(project, stateMap)
        // In test mode, synthesize a representative alert if the user has no
        // real alerts firing -- otherwise the test silently sends nothing.
        if (testMode && !alerts.length) {
          alerts = [{
            level: 'urgent',
            label: '[TEST] Capacity Limited',
            detail: `This is a TEST alert sent from the Admin panel. Your project "${project.name}" has not actually been flagged. The program is currently ${stateMap[project.state]?.csStatus || 'active'} in ${project.state_name || project.state}.`,
          }]
        }
        if (!alerts.length) continue

        const hasUrgent = alerts.some(a => a.level === 'urgent')

        // Email delivery
        if (wantsEmail) {
          const baseSubject = hasUrgent
            ? `Action required: Program alert for "${project.name}"`
            : `Policy update for your project "${project.name}"`
          const subject = testMode ? `[TEST] ${baseSubject}` : baseSubject
          const html = buildAlertHtml(user, project, alerts)
          try {
            await sendEmail(user.email, subject, html)
            results.push({ email: user.email, project: project.name, alerts: alerts.map(a => a.label) })
          } catch (err) {
            console.error(`[send-alerts] email failed for ${user.email}:`, err.message)
            if (testMode) {
              return res.status(500).json({ error: `Email send failed: ${err.message}` })
            }
          }
        }

        // Slack delivery — best effort, don't let failures stop email
        if (wantsSlack) {
          try {
            const userName = user.user_metadata?.full_name || user.email?.split('@')[0]
            const payload = buildSlackBlocks(project, alerts, userName)
            await sendSlack(profile.slack_webhook_url, payload)
            slackResults.sent++
          } catch (err) {
            slackResults.failed++
            console.error(`[send-alerts] slack failed for ${profile.id}:`, err.message)
            if (testMode) {
              return res.status(500).json({ error: `Slack send failed: ${err.message}` })
            }
          }
        }

        // In test mode we only need ONE delivery to verify the flow works.
        if (testMode) {
          return res.status(200).json({
            sent: results.length, slack: slackResults, testMode, channel: testChannel, results,
          })
        }
      }
    }

    return res.status(200).json({ sent: results.length, slack: slackResults, testMode, results })
  } catch (err) {
    console.error('Alerts error:', err)
    return res.status(500).json({ error: err.message })
  }
}
