/**
 * Opportunity email templates — HTML + plain-text builders for the
 * V3 §8.2 "market opportunity / upside detected" email class.
 *
 * Distinct from the urgent/policy alert template (api/templates/_alertEmail.js)
 * because the visual semantics flip positive: TEAL accent rail (vs. red/amber),
 * "MARKET OPPORTUNITY" eyebrow (vs. "URGENT"), ↑ delta indicator. The card
 * layout is bespoke too — no shared alertDetailRow helper.
 *
 * Mirrors the helper-module convention used by api/lib/_aiCacheLayer.js:
 * ESM imports, JSDoc-style file header, leading underscore in the
 * filename. Named exports only.
 */
import {
  BRAND_NAVY,
  TEAL,
  TEAL_DEEP,
  TEAL_LIGHT,
  INK,
  INK_MUTED,
  PAPER,
  BORDER,
  FONT_SERIF,
  FONT_SANS,
  FONT_MONO,
  APP_URL,
} from './_emailTheme.js'

// V3 §8.2 Opportunity alert template — TEAL accent rail (positive semantic),
// "MARKET OPPORTUNITY" eyebrow, ↑ delta indicator.
export function buildOpportunityAlertHtml(user, project, opportunity) {
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

// Plain-text fallback for the opportunity alert (the upside-detected email).
export function buildOpportunityText(user, project, opportunity) {
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
