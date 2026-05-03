import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'digest@tractova.com'
const APP_URL = 'https://tractova.com'

const STATUS_RANK  = { active: 3, limited: 2, pending: 1, none: 0 }
const STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }
// V3: status colors aligned with the rest of the product palette
const STATUS_COLOR = { active: '#0F766E', limited: '#D97706', pending: '#6366f1', none: '#DC2626' }
const IX_RANK      = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }

// V3 design tokens — inlined for the email, fonts/colors match the platform.
// EMAIL-CLIENT NOTE: Outlook silently drops @import Google Fonts. We rely on
// real font fallback stacks: Source Serif 4 -> Georgia (graceful serif),
// JetBrains Mono -> Consolas (gracefully monospace on Outlook), Inter -> system.
const BRAND_NAVY = '#0F1A2E'
const TEAL = '#14B8A6'
const TEAL_DEEP = '#0F766E'
const TEAL_LIGHT = '#5EEAD4'
const INK = '#0A1828'
const INK_MUTED = '#5A6B7A'
const PAPER = '#FAFAF7'
const BORDER = '#E2E8F0'
const STATUS_ACTIVE = '#047857'
const STATUS_LIMITED = '#B45309'
const STATUS_NONE = '#B91C1C'

const FONT_SERIF = `'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif`
const FONT_SANS  = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
const FONT_MONO  = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace`

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

function getAlerts(project, stateMap) {
  const current = stateMap[project.state]
  if (!current) return []
  const alerts = []
  const savedRank   = STATUS_RANK[project.cs_status]    ?? 2
  const currentRank = STATUS_RANK[current.csStatus]     ?? 2
  if (currentRank < savedRank) {
    alerts.push(current.csStatus === 'limited'
      ? { level: 'warning', label: 'Capacity Limited' }
      : { level: 'urgent',  label: 'Program Closed'   })
  }
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10) {
    const drop = project.opportunity_score - current.opportunityScore
    alerts.push({ level: 'warning', label: `Score Drop · ↓${drop} pts` })
  }
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'Queue Harder' })
  return alerts
}

// V3 email-safe alert pill: table-based, no flexbox.
// Dot rendered via padding+background trick instead of inline-block flex.
function alertPill(alert) {
  const cfg = alert.level === 'urgent'
    ? { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' }
    : { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' }
  return `<span style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600;font-family:${FONT_SANS};line-height:1;display:inline-block;mso-line-height-rule:exactly;">${alert.label}</span>`
}

// V3 project card — TABLE-based for email-client safety.
// Left teal/red rule via 3px-wide td. Two-column inner table for identity
// (left) and status+score (right). Alerts below in their own row.
function projectCard(project, stateMap) {
  const alerts  = getAlerts(project, stateMap)
  const state   = stateMap[project.state]
  const status  = state?.csStatus ?? project.cs_status ?? 'active'
  const score   = state?.opportunityScore ?? project.opportunity_score ?? '—'
  const hasUrgent = alerts.some(a => a.level === 'urgent')
  const accentColor = hasUrgent ? '#DC2626' : (typeof score === 'number' && score >= 60) ? TEAL_DEEP : '#94A3B8'
  const statusLabel = STATUS_LABEL[status] ?? status
  const statusColor = STATUS_COLOR[status] ?? INK_MUTED
  const meta = [
    (project.state_name ?? project.state ?? '').toUpperCase(),
    (project.county ?? '').toUpperCase(),
    project.mw != null ? `${project.mw} MW` : null,
    (project.stage ?? '').toUpperCase(),
  ].filter(Boolean).join(' · ')

  const alertsRow = alerts.length
    ? `<tr><td colspan="2" style="padding:10px 16px 14px 16px;font-family:${FONT_SANS};">${alerts.map(alertPill).join('&nbsp;&nbsp;')}</td></tr>`
    : ''

  return `
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;margin:0 0 10px 0;">
    <tr>
      <td width="3" style="background:${accentColor};border-top-left-radius:6px;border-bottom-left-radius:6px;line-height:1;font-size:0;">&nbsp;</td>
      <td style="padding:14px 16px 12px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td valign="top" style="padding-right:12px;">
              <p style="margin:0;font-family:${FONT_SERIF};font-size:16px;font-weight:600;color:${INK};letter-spacing:-0.015em;line-height:1.25;">${project.name}</p>
              <p style="margin:4px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.06em;">${meta}</p>
            </td>
            <td valign="top" align="right" width="90" style="white-space:nowrap;">
              <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${statusColor};letter-spacing:0.18em;text-transform:uppercase;">${statusLabel}</p>
              <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.06em;">SCORE <span style="color:${INK};font-weight:700;font-size:15px;letter-spacing:-0.01em;">${score}</span></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${alertsRow}
  </table>`
}

// V3 Wave 1.5: TABLE-based "Markets in Motion" section. Top 3 portfolio
// states ranked by activity (news + data updates) in the past 7 days.
// Returns empty string when no activity, so the calling template can omit
// the section without leaving an empty heading.
function buildMotionSection(projects, stateMap, activity) {
  const portfolioStateIds = [...new Set(projects.map(p => p.state).filter(Boolean))]
  const ranked = portfolioStateIds
    .map(id => {
      const a = activity[id] || { newsCount: 0, updateCount: 0, headline: null, lastChange: null }
      return {
        id,
        name: stateMap[id]?.name || id,
        score: stateMap[id]?.opportunityScore ?? null,
        status: stateMap[id]?.csStatus,
        newsCount: a.newsCount,
        updateCount: a.updateCount,
        total: a.newsCount + a.updateCount,
        headline: a.headline,
        lastChange: a.lastChange,
      }
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  if (ranked.length === 0) return ''

  const rows = ranked.map((s, i) => {
    const meta = [
      s.newsCount ? `${s.newsCount} NEWS` : null,
      s.updateCount ? `${s.updateCount} UPDATE${s.updateCount > 1 ? 'S' : ''}` : null,
    ].filter(Boolean).join('  ·  ')
    const callout = s.headline
      ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-family:${FONT_SANS};font-size:13px;color:${INK};line-height:1.45;">${s.headline}</td></tr>`
      : s.lastChange
        ? `<tr><td colspan="2" style="padding:6px 0 0 0;font-family:${FONT_MONO};font-size:11px;color:${INK_MUTED};letter-spacing:0.04em;">${s.lastChange}</td></tr>`
        : ''
    const isLast = i === ranked.length - 1
    return `
      <tr>
        <td colspan="2" style="padding:0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-bottom:${isLast ? 'none' : `1px solid ${BORDER}`};">
            <tr>
              <td valign="top" style="padding:14px 0 ${callout ? '0' : '14px'} 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td valign="top">
                      <p style="margin:0;font-family:${FONT_SERIF};font-size:17px;font-weight:600;color:${INK};letter-spacing:-0.018em;line-height:1.2;">${s.name}</p>
                      <p style="margin:4px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.18em;font-weight:600;">${meta}</p>
                    </td>
                    ${s.score != null ? `<td valign="top" align="right" width="60" style="white-space:nowrap;">
                      <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${INK_MUTED};letter-spacing:0.20em;text-transform:uppercase;">SCORE</p>
                      <p style="margin:3px 0 0 0;font-family:${FONT_MONO};font-size:20px;font-weight:700;color:${INK};letter-spacing:-0.02em;line-height:1;">${s.score}</p>
                    </td>` : ''}
                  </tr>
                  ${callout}
                </table>
                ${callout ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }).join('')

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px 0;">
      <tr>
        <td style="padding:0 0 8px 0;">
          <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${INK_MUTED};">Markets in Motion · Past 7 Days</p>
          <p style="margin:6px 0 12px 0;font-family:${FONT_SERIF};font-size:20px;font-weight:600;color:${INK};letter-spacing:-0.02em;line-height:1.2;">Where your portfolio shifted</p>
        </td>
      </tr>
      <tr><td style="border-top:1px solid ${BORDER};padding:0;">&nbsp;</td></tr>
      ${rows}
    </table>`
}

function buildDigestHtml(user, projects, stateMap, activity) {
  const hasAlerts    = projects.some(p => getAlerts(p, stateMap).length > 0)
  const flaggedCount = projects.filter(p => getAlerts(p, stateMap).length > 0).length
  const totalMW      = projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
  const stateSet     = new Set(projects.map(p => p.state).filter(Boolean))
  const projectsHtml = projects.map(p => projectCard(p, stateMap)).join('')
  const motionHtml   = buildMotionSection(projects, stateMap, activity || {})
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]

  // Single style block for hover state on the CTA only -- everything else
  // is inline. mso-line-height-rule:exactly forces Outlook to respect line-height.
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Tractova Weekly Briefing</title>
  <!--[if mso]>
  <style type="text/css">
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { -webkit-font-smoothing: antialiased; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT_SANS};color:${INK};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">

  <!-- Hidden preheader for inbox preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};">
    Weekly briefing · ${projects.length} project${projects.length !== 1 ? 's' : ''} tracked${hasAlerts ? `, ${flaggedCount} flagged for attention` : ''}.
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">

          <!-- Top teal accent rail -->
          <tr>
            <td style="background:${TEAL};line-height:3px;font-size:0;height:3px;border-radius:8px 8px 0 0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>

          <!-- Header (navy band) -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEAL_LIGHT};line-height:1;">
                Weekly Briefing · ${today.toUpperCase()}
              </p>
              <p style="margin:0;font-family:${FONT_SERIF};font-size:32px;font-weight:600;color:#FFFFFF;letter-spacing:-0.025em;line-height:1.05;">
                Tractova
              </p>
              <p style="margin:10px 0 0 0;font-family:${FONT_SANS};font-size:13px;color:#94B3CC;line-height:1.4;">
                Your portfolio, monitored for policy changes.
              </p>
            </td>
          </tr>

          <!-- Body container -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 8px 8px;padding:28px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:15px;color:${INK};line-height:1.5;">
                Good morning ${greeting},
              </p>
              <p style="margin:0 0 24px 0;font-family:${FONT_SANS};font-size:14px;color:${INK_MUTED};line-height:1.6;">
                Here's your snapshot of <strong style="color:${INK};font-weight:600;">${projects.length} tracked project${projects.length !== 1 ? 's' : ''}</strong>${hasAlerts ? ` — <strong style="color:#92400E;font-weight:600;">${flaggedCount} flagged for attention</strong>` : ''}.
              </p>

              <!-- Portfolio meta strip (3-cell table, hairline rules) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:0 0 28px 0;">
                <tr>
                  <td valign="top" width="33%" style="padding:14px 16px 14px 0;border-right:1px solid ${BORDER};">
                    <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};line-height:1;">Tracked</p>
                    <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.02em;line-height:1;">${projects.length}</p>
                  </td>
                  <td valign="top" width="34%" style="padding:14px 16px;border-right:1px solid ${BORDER};">
                    <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};line-height:1;">Capacity</p>
                    <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.02em;line-height:1;">${totalMW.toFixed(1)} <span style="font-size:11px;font-weight:500;color:${INK_MUTED};letter-spacing:0;">MW</span></p>
                  </td>
                  <td valign="top" width="33%" style="padding:14px 0 14px 16px;">
                    <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK_MUTED};line-height:1;">States</p>
                    <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.02em;line-height:1;">${stateSet.size}</p>
                  </td>
                </tr>
              </table>

              <!-- Markets in Motion (renders empty when no activity) -->
              ${motionHtml}

              <!-- Portfolio section eyebrow -->
              <p style="margin:0 0 14px 0;font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${INK_MUTED};line-height:1;">Portfolio · ${projects.length} Project${projects.length !== 1 ? 's' : ''}</p>

              ${projectsHtml}

              <!-- CTA (rounded button via VML for Outlook) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_URL}/library" style="height:46px;v-text-anchor:middle;width:200px;" arcsize="18%" stroke="f" fillcolor="${TEAL}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Open Library →</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${APP_URL}/library" style="background:${TEAL};color:#FFFFFF;text-decoration:none;display:inline-block;padding:14px 36px;border-radius:8px;font-family:${FONT_SANS};font-size:14px;font-weight:600;letter-spacing:0.01em;border:1px solid ${TEAL};">
                      Open Library →
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Platform note (paper-tinted, hairline border, mono eyebrow) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0 0;background:${PAPER};border:1px solid ${BORDER};border-radius:6px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${INK_MUTED};line-height:1.55;">
                      <span style="font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK};margin-right:6px;">Note ·</span>
                      Tractova is currently optimized for desktop browsers. A mobile experience is on the roadmap — for now, links open best from a laptop or larger screen.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;border-top:1px solid ${BORDER};">
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:11px;color:${INK_MUTED};line-height:1.55;">
                      You're receiving this because you have a Tractova Pro subscription.
                    </p>
                    <p style="margin:0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.10em;line-height:1.6;">
                      <a href="${APP_URL}/profile" style="color:${TEAL_DEEP};text-decoration:none;font-weight:600;">MANAGE NOTIFICATIONS</a>
                      <span style="color:${BORDER};margin:0 8px;">·</span>
                      <a href="${APP_URL}/library" style="color:${TEAL_DEEP};text-decoration:none;font-weight:600;">VIEW LIBRARY</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Bottom whitespace -->
          <tr><td style="line-height:24px;font-size:0;height:24px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
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
      const baseSubject = `Your weekly Tractova digest — ${projects.length} project${projects.length !== 1 ? 's' : ''}`
      const subject = testMode ? `[TEST] ${baseSubject}` : baseSubject

      await sendEmail(user.email, subject, html)
      results.push({ email: user.email, projects: projects.length })
    }

    return res.status(200).json({ sent: results.length, testMode, results })
  } catch (err) {
    console.error('Digest error:', err)
    return res.status(500).json({ error: err.message })
  }
}
