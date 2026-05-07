/**
 * Alert email templates — HTML + plain-text builders for the standard
 * urgent / policy alert (program-closed, capacity-limited, score-drop,
 * IX-harder classes).
 *
 * Co-locates the HTML and text variants so the inline copy stays in sync
 * across both. The text variant is the multipart/alternative fallback —
 * required for deliverability (multipart beats HTML-only on spam scoring)
 * and accessibility (screen readers, plain-text-preferring clients).
 *
 * Mirrors the helper-module convention used by api/lib/_aiCacheLayer.js:
 * ESM imports, JSDoc-style file header, leading underscore in the
 * filename. Named exports only.
 *
 * `alertDetailRow` is private to this file — used only by buildAlertHtml.
 */
import {
  BRAND_NAVY,
  TEAL,
  TEAL_DEEP,
  AMBER,
  AMBER_LIGHT,
  URGENT,
  INK,
  INK_MUTED,
  PAPER,
  BORDER,
  FONT_SERIF,
  FONT_SANS,
  FONT_MONO,
  APP_URL,
} from './_emailTheme.js'

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
export function buildAlertHtml(user, project, alerts) {
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

// Plain-text fallback for the urgent + policy alert email. Same payload
// shape as the HTML — alert detail rows, project meta, CTA link. Improves
// deliverability (multipart/alternative beats HTML-only on spam scoring)
// and accessibility (screen readers, plain-text-preferring clients).
export function buildAlertText(user, project, alerts) {
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
