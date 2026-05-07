import { isAdminFromBearer } from './_admin-auth.js'
import { checkRateLimit, logRateLimited } from './_rate-limit.js'
import { APP_URL } from './templates/_emailTheme.js'
import {
  STATUS_LABEL,
  buildStateMap,
  getUrgentAlerts,
} from './lib/_alertClassifier.js'
import { buildAlertHtml, buildAlertText } from './templates/_alertEmail.js'
import {
  buildOpportunityAlertHtml,
  buildOpportunityText,
} from './templates/_opportunityEmail.js'
import { supabaseAdmin } from './lib/_supabaseAdmin.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'alerts@tractova.com'

// reply_to routes user replies to hello@tractova.com (Namecheap forwarding →
// Aden's Gmail). Without this, replies bounce on the unattended alerts@
// from-address. Site-walk Session 5 / I3.
const REPLY_TO_EMAIL = 'hello@tractova.com'

// List-Unsubscribe headers per RFC 8058. Gmail/Outlook/Apple Mail surface a
// one-click "Unsubscribe" UI when both mailto + https variants are present
// + the One-Click POST header. Hits hello@ inbox for mail unsubscribes.
const LIST_UNSUBSCRIBE_HEADER = '<mailto:hello@tractova.com?subject=Unsubscribe%20from%20Tractova%20Alerts>, <https://tractova.com/profile>'

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
  let testChannel = 'email'    // 'email' | 'slack'
  let testType    = 'alert'    // 'alert' | 'opportunity'
  if (!isVercelCron && !isManualWithSecret) {
    // C1 fix 2026-05-05: role-based admin check via profiles.role (057).
    const adminCheck = await isAdminFromBearer(supabaseAdmin, req.headers.authorization)
    if (!adminCheck.ok) return res.status(401).json({ error: 'Unauthorized' })
    testMode = true
    testUserId = adminCheck.user.id
    // Test-mode rate limit — bound admin-triggered alert spam to 5/hour
    // per admin. Cron mode (CRON_SECRET / x-vercel-cron) is unaffected.
    // Stops a curious admin (or compromised admin JWT) from accidentally
    // burning Resend credits or paging real Pro users.
    const rl = await checkRateLimit(supabaseAdmin, adminCheck.user.id, {
      action: 'alert-test',
      windowMs: 60 * 60 * 1000,
      maxCalls: 5,
    })
    if (!rl.ok) return res.status(429).json(rl.response)
    logRateLimited(supabaseAdmin, adminCheck.user.id, 'alert-test')
    // Channel + type selectors via query string OR JSON body
    const url = new URL(req.url, `https://${req.headers.host}`)
    const qChannel = url.searchParams.get('channel')
    const qType    = url.searchParams.get('type')
    let bChannel = null, bType = null
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      bChannel = body?.channel
      bType = body?.type
    } catch {}
    testChannel = (qChannel || bChannel || 'email') === 'slack' ? 'slack' : 'email'
    testType    = (qType    || bType    || 'alert') === 'opportunity' ? 'opportunity' : 'alert'
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
        // Opportunity-test path: skip alert detection entirely and synthesize
        // a positive-event email instead.
        if (testMode && testType === 'opportunity') {
          const opp = {
            label: '[TEST] Program Capacity Expansion',
            detail: `Illinois Shines added 250MW of capacity to the next REC block for ${stateMap[project.state]?.name || project.state}. Your project "${project.name}" sits inside the eligible window — submitting an enrollment package this month maximizes likelihood of placement.`,
            mechanism: 'Capacity expansion increases enrollment likelihood and shifts your project earlier in the queue.',
            delta: '+15 pts',
          }
          if (wantsEmail) {
            const subject = `[TEST] Market opportunity for "${project.name}"`
            const html = buildOpportunityAlertHtml(user, project, opp)
            const text = buildOpportunityText(user, project, opp)
            try {
              await sendEmail(user.email, subject, html, text)
              results.push({ email: user.email, project: project.name, type: 'opportunity' })
            } catch (err) {
              return res.status(500).json({ error: `Email send failed: ${err.message}` })
            }
          }
          if (wantsSlack) {
            try {
              const userName = user.user_metadata?.full_name || user.email?.split('@')[0]
              const blocks = buildSlackBlocks(project, [{ level: 'warning', label: opp.label, detail: opp.detail }], userName)
              await sendSlack(profile.slack_webhook_url, blocks)
              slackResults.sent++
            } catch (err) {
              return res.status(500).json({ error: `Slack send failed: ${err.message}` })
            }
          }
          return res.status(200).json({ sent: results.length, slack: slackResults, testMode, testType, results })
        }

        let alerts = getUrgentAlerts(project, stateMap)
        // In test mode, synthesize a representative alert if the user has no
        // real alerts firing -- otherwise the test silently sends nothing.
        if (testMode && !alerts.length) {
          const liveStatus = stateMap[project.state]?.csStatus || 'active'
          alerts = [{
            level: 'urgent',
            label: '[TEST] Capacity Limited',
            detail: `This is a TEST alert sent from the Admin panel. Your project "${project.name}" has not actually been flagged. The program is currently ${STATUS_LABEL[liveStatus] ?? liveStatus} in ${project.state_name || project.state}.`,
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
          const text = buildAlertText(user, project, alerts)
          try {
            await sendEmail(user.email, subject, html, text)
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
