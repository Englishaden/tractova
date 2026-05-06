import { createClient } from '@supabase/supabase-js'
import { isAdminFromBearer } from './_admin-auth.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'alerts@tractova.com'
const APP_URL = 'https://tractova.com'

// V3 design tokens — matched with send-digest.js for cross-template consistency
const BRAND_NAVY = '#0F1A2E'
const TEAL = '#14B8A6'
const TEAL_DEEP = '#0F766E'
const TEAL_LIGHT = '#5EEAD4'
const AMBER = '#D97706'
const AMBER_LIGHT = '#FCD34D'
const URGENT = '#DC2626'
const INK = '#0A1828'
const INK_MUTED = '#5A6B7A'
const PAPER = '#FAFAF7'
const BORDER = '#E2E8F0'

const FONT_SERIF = `'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif`
const FONT_SANS  = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
const FONT_MONO  = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace`

const STATUS_RANK  = { active: 3, limited: 2, pending: 1, none: 0 }
const STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'Closed' }
const IX_RANK      = { easy: 0, moderate: 1, hard: 2, very_hard: 3 }
const IX_LABEL     = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very hard' }

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
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10) {
    const drop = project.opportunity_score - current.opportunityScore
    alerts.push({
      level: 'warning',
      label: 'Opportunity Score Drop',
      delta: { from: project.opportunity_score, to: current.opportunityScore, change: -drop },
      detail: `Feasibility Index dropped from ${project.opportunity_score} to ${current.opportunityScore} for "${project.name}".`,
    })
  }
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'IX Queue Harder', detail: `Interconnection difficulty increased from ${IX_LABEL[project.ix_difficulty] ?? project.ix_difficulty} to ${IX_LABEL[current.ixDifficulty] ?? current.ixDifficulty}.` })
  return alerts
}

// V3 email-safe alert detail row — table-based, no flexbox.
// When alert.delta is present (score-drop class), render a big delta number
// in the right gutter so the magnitude reads at a glance.
function alertDetailRow(a) {
  const isUrgent = a.level === 'urgent'
  const tone = isUrgent
    ? { bg: '#FEE2E2', tone: '#991B1B', rule: URGENT, label: 'URGENT' }
    : { bg: '#FEF3C7', tone: '#92400E', rule: AMBER, label: 'WARNING' }
  const deltaCell = a.delta
    ? `<td valign="top" align="right" width="84" style="white-space:nowrap;padding-left:12px;">
        <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${tone.tone};letter-spacing:0.20em;text-transform:uppercase;line-height:1;">${a.delta.change > 0 ? '↑' : '↓'} ${Math.abs(a.delta.change)} pts</p>
        <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:11px;color:${INK_MUTED};letter-spacing:0.04em;line-height:1;">${a.delta.from} → <span style="color:${INK};font-weight:700;">${a.delta.to}</span></p>
      </td>`
    : ''
  return `
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;margin:0 0 10px 0;">
    <tr>
      <td width="3" style="background:${tone.rule};line-height:1;font-size:0;border-top-left-radius:6px;border-bottom-left-radius:6px;">&nbsp;</td>
      <td style="padding:14px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td valign="top">
              <p style="margin:0 0 6px 0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${tone.tone};letter-spacing:0.22em;text-transform:uppercase;line-height:1;">${tone.label} · ${a.label}</p>
              <p style="margin:0;font-family:${FONT_SANS};font-size:13px;color:${INK};line-height:1.5;">${a.detail}</p>
            </td>
            ${deltaCell}
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

// Email-safe full alert email.
function buildAlertHtml(user, project, alerts) {
  const alertRows = alerts.map(alertDetailRow).join('')
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]
  const hasUrgent = alerts.some(a => a.level === 'urgent')
  const accentRail = hasUrgent ? URGENT : AMBER
  const eyebrowColor = hasUrgent ? '#FCA5A5' : AMBER_LIGHT
  const eyebrowText = hasUrgent ? 'Urgent · Action Required' : 'Policy Alert · Action Required'
  const projectMeta = [
    (project.state_name ?? project.state ?? '').toUpperCase(),
    (project.county ?? '').toUpperCase(),
    project.mw != null ? `${project.mw} MW` : null,
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Tractova Policy Alert</title>
  <!--[if mso]>
  <style type="text/css">
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT_SANS};color:${INK};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};">
    Policy alert for ${project.name} — ${alerts[0]?.label || 'review required'}.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">

          <!-- Top accent rail (amber for warning, red for urgent) -->
          <tr>
            <td style="background:${accentRail};line-height:3px;font-size:0;height:3px;border-radius:8px 8px 0 0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${eyebrowColor};line-height:1;">
                ◆ ${eyebrowText.toUpperCase()}
              </p>
              <p style="margin:0;font-family:${FONT_SERIF};font-size:30px;font-weight:600;color:#FFFFFF;letter-spacing:-0.025em;line-height:1.05;">
                Tractova
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 8px 8px;padding:28px 32px;">

              <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:15px;color:${INK};line-height:1.5;">Hi ${greeting},</p>
              <p style="margin:0 0 24px 0;font-family:${FONT_SANS};font-size:14px;color:${INK_MUTED};line-height:1.6;">
                There ${alerts.length === 1 ? 'is an update' : 'are updates'} affecting one of your saved projects that may impact your underwriting.
              </p>

              <!-- Project identity card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;margin:0 0 20px 0;">
                <tr>
                  <td width="3" style="background:${accentRail};line-height:1;font-size:0;border-top-left-radius:6px;border-bottom-left-radius:6px;">&nbsp;</td>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-family:${FONT_SERIF};font-size:18px;font-weight:600;color:${INK};letter-spacing:-0.018em;line-height:1.25;">${project.name}</p>
                    <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.06em;">${projectMeta}</p>
                  </td>
                </tr>
              </table>

              <!-- Alert rows -->
              ${alertRows}

              <!-- CTA -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_URL}/library" style="height:46px;v-text-anchor:middle;width:200px;" arcsize="18%" stroke="f" fillcolor="${TEAL}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Review Project →</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${APP_URL}/library" style="background:${TEAL};color:#FFFFFF;text-decoration:none;display:inline-block;padding:14px 36px;border-radius:8px;font-family:${FONT_SANS};font-size:14px;font-weight:600;letter-spacing:0.01em;border:1px solid ${TEAL};">
                      Review Project →
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Platform note -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0 0;background:${PAPER};border:1px solid ${BORDER};border-radius:6px;">
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
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;border-top:1px solid ${BORDER};">
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:11px;color:${INK_MUTED};line-height:1.55;">
                      You're receiving this because you have a Tractova Pro subscription.
                    </p>
                    <p style="margin:0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.10em;line-height:1.6;">
                      <a href="${APP_URL}/profile" style="color:${TEAL_DEEP};text-decoration:none;font-weight:600;">MANAGE NOTIFICATIONS</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr><td style="line-height:24px;font-size:0;height:24px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// V3 §8.2 Opportunity alert template — TEAL accent rail (positive semantic),
// "MARKET OPPORTUNITY" eyebrow, ↑ delta indicator.
function buildOpportunityAlertHtml(user, project, opportunity) {
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]
  const projectMeta = [
    (project.state_name ?? project.state ?? '').toUpperCase(),
    (project.county ?? '').toUpperCase(),
    project.mw != null ? `${project.mw} MW` : null,
  ].filter(Boolean).join(' · ')
  const delta = opportunity?.delta ?? '+upside'
  const detail = opportunity?.detail ?? 'A favorable market shift was detected in one of your tracked states.'
  const mechanism = opportunity?.mechanism ?? null

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <title>Tractova Market Opportunity</title>
  <!--[if mso]>
  <style type="text/css">table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT_SANS};color:${INK};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER};">
    Market opportunity in ${project.state_name ?? project.state} — ${opportunity?.label ?? 'review the upside'}.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">

          <!-- Top teal accent rail (positive semantic) -->
          <tr>
            <td style="background:${TEAL};line-height:3px;font-size:0;height:3px;border-radius:8px 8px 0 0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:28px 32px;">
              <p style="margin:0 0 8px 0;font-family:${FONT_MONO};font-size:10px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEAL_LIGHT};line-height:1;">
                ◆ Market Opportunity · Upside Detected
              </p>
              <p style="margin:0;font-family:${FONT_SERIF};font-size:30px;font-weight:600;color:#FFFFFF;letter-spacing:-0.025em;line-height:1.05;">
                Tractova
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:1px solid ${BORDER};border-radius:0 0 8px 8px;padding:28px 32px;">

              <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:15px;color:${INK};line-height:1.5;">Hi ${greeting},</p>
              <p style="margin:0 0 24px 0;font-family:${FONT_SANS};font-size:14px;color:${INK_MUTED};line-height:1.6;">
                A market shift in your portfolio creates new upside on a tracked project.
              </p>

              <!-- Project identity card with TEAL rule -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;margin:0 0 16px 0;">
                <tr>
                  <td width="3" style="background:${TEAL_DEEP};line-height:1;font-size:0;border-top-left-radius:6px;border-bottom-left-radius:6px;">&nbsp;</td>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-family:${FONT_SERIF};font-size:18px;font-weight:600;color:${INK};letter-spacing:-0.018em;line-height:1.25;">${project.name}</p>
                    <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.06em;">${projectMeta}</p>
                  </td>
                </tr>
              </table>

              <!-- Opportunity card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;margin:0 0 16px 0;">
                <tr>
                  <td width="3" style="background:${TEAL};line-height:1;font-size:0;border-top-left-radius:6px;border-bottom-left-radius:6px;">&nbsp;</td>
                  <td style="padding:16px 18px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="top" style="padding-right:12px;">
                          <p style="margin:0 0 6px 0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${TEAL_DEEP};letter-spacing:0.22em;text-transform:uppercase;line-height:1;">Upside · ${opportunity?.label ?? 'Capacity Expansion'}</p>
                          <p style="margin:0;font-family:${FONT_SANS};font-size:14px;color:${INK};line-height:1.55;">${detail}</p>
                          ${mechanism ? `<p style="margin:8px 0 0 0;font-family:${FONT_SANS};font-size:12px;color:${INK_MUTED};line-height:1.5;font-style:italic;">${mechanism}</p>` : ''}
                        </td>
                        <td valign="top" align="right" width="80" style="white-space:nowrap;">
                          <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${INK_MUTED};letter-spacing:0.20em;text-transform:uppercase;">DELTA</p>
                          <p style="margin:4px 0 0 0;font-family:${FONT_MONO};font-size:18px;font-weight:700;color:${TEAL_DEEP};letter-spacing:-0.01em;line-height:1;">↑ ${delta}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_URL}/library" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="18%" stroke="f" fillcolor="${TEAL}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Review Opportunity →</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${APP_URL}/library" style="background:${TEAL};color:#FFFFFF;text-decoration:none;display:inline-block;padding:14px 36px;border-radius:8px;font-family:${FONT_SANS};font-size:14px;font-weight:600;letter-spacing:0.01em;border:1px solid ${TEAL};">
                      Review Opportunity →
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Platform note -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0 0;background:${PAPER};border:1px solid ${BORDER};border-radius:6px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${INK_MUTED};line-height:1.55;">
                      <span style="font-family:${FONT_MONO};font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK};margin-right:6px;">Note ·</span>
                      Tractova is currently optimized for desktop browsers. A mobile experience is on the roadmap — for now, links open best from a laptop or larger screen.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;border-top:1px solid ${BORDER};">
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:11px;color:${INK_MUTED};line-height:1.55;">
                      You're receiving this because you opted into opportunity alerts.
                    </p>
                    <p style="margin:0;font-family:${FONT_MONO};font-size:10px;letter-spacing:0.10em;line-height:1.6;">
                      <a href="${APP_URL}/profile" style="color:${TEAL_DEEP};text-decoration:none;font-weight:600;">MANAGE NOTIFICATIONS</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr><td style="line-height:24px;font-size:0;height:24px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// reply_to routes user replies to hello@tractova.com (Namecheap forwarding →
// Aden's Gmail). Without this, replies bounce on the unattended alerts@
// from-address. Site-walk Session 5 / I3.
const REPLY_TO_EMAIL = 'hello@tractova.com'

// List-Unsubscribe headers per RFC 8058. Gmail/Outlook/Apple Mail surface a
// one-click "Unsubscribe" UI when both mailto + https variants are present
// + the One-Click POST header. Hits hello@ inbox for mail unsubscribes.
const LIST_UNSUBSCRIBE_HEADER = '<mailto:hello@tractova.com?subject=Unsubscribe%20from%20Tractova%20Alerts>, <https://tractova.com/profile>'

// Plain-text fallback for the urgent + policy alert email. Same payload
// shape as the HTML — alert detail rows, project meta, CTA link. Improves
// deliverability (multipart/alternative beats HTML-only on spam scoring)
// and accessibility (screen readers, plain-text-preferring clients).
function buildAlertText(user, project, alerts) {
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]
  const meta = [
    project.state_name ?? project.state,
    project.county,
    project.mw != null ? `${project.mw} MW` : null,
  ].filter(Boolean).join(' · ')
  const hasUrgent = alerts.some(a => a.level === 'urgent')

  const alertLines = alerts.map(a => {
    const tag = a.level === 'urgent' ? 'URGENT' : 'WARNING'
    const deltaLine = a.delta ? `\n    Delta: ${a.delta.from} → ${a.delta.to} (${a.delta.change > 0 ? '+' : ''}${a.delta.change} pts)` : ''
    return `[${tag}] ${a.label}\n  ${a.detail}${deltaLine}`
  }).join('\n\n')

  return [
    hasUrgent ? 'TRACTOVA — URGENT POLICY ALERT' : 'TRACTOVA — POLICY ALERT',
    '',
    `Hi ${greeting},`,
    '',
    `There ${alerts.length === 1 ? 'is an update' : 'are updates'} affecting one of your saved projects that may impact your underwriting.`,
    '',
    `PROJECT: ${project.name}`,
    `         ${meta}`,
    '',
    alertLines,
    '',
    `Review project: ${APP_URL}/library`,
    '',
    '---',
    "You're receiving this because you have a Tractova Pro subscription.",
    `Manage notifications: ${APP_URL}/profile`,
    `Unsubscribe: reply to this email or visit ${APP_URL}/profile`,
  ].join('\n')
}

// Plain-text fallback for the opportunity alert (the upside-detected email).
function buildOpportunityText(user, project, opportunity) {
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]
  const meta = [
    project.state_name ?? project.state,
    project.county,
    project.mw != null ? `${project.mw} MW` : null,
  ].filter(Boolean).join(' · ')
  const delta = opportunity?.delta ?? '+upside'
  const detail = opportunity?.detail ?? 'A favorable market shift was detected in one of your tracked states.'
  const mechanism = opportunity?.mechanism ? `\n\n${opportunity.mechanism}` : ''

  return [
    'TRACTOVA — MARKET OPPORTUNITY',
    '',
    `Hi ${greeting},`,
    '',
    'A market shift in your portfolio creates new upside on a tracked project.',
    '',
    `PROJECT: ${project.name}`,
    `         ${meta}`,
    '',
    `UPSIDE: ${opportunity?.label ?? 'Capacity Expansion'}    Delta: ${delta}`,
    detail + mechanism,
    '',
    `Review opportunity: ${APP_URL}/library`,
    '',
    '---',
    "You're receiving this because you opted into opportunity alerts.",
    `Manage notifications: ${APP_URL}/profile`,
    `Unsubscribe: reply to this email or visit ${APP_URL}/profile`,
  ].join('\n')
}

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
