/**
 * Digest email templates — HTML + plain-text builders for the weekly
 * Tractova briefing sent every Sunday morning.
 *
 * Co-locates the HTML and text variants so the inline copy stays in sync
 * across both. The text variant is the multipart/alternative fallback —
 * required for deliverability (multipart beats HTML-only on spam scoring)
 * and accessibility (screen readers, plain-text-preferring clients).
 *
 * Mirrors the helper-module convention used by api/templates/_alertEmail.js:
 * ESM imports, JSDoc-style file header, leading underscore in the
 * filename. Named exports only.
 *
 * Private helpers (alertPill, projectCard, buildMotionSection, getAlerts,
 * STATUS_COLOR) are scoped to this file — they're digest-specific. Note
 * that getAlerts here is intentionally distinct from getUrgentAlerts in
 * api/lib/_alertClassifier.js: the digest version emits {level, kind, label}
 * tuples (with kind: 'status' | 'score_drop' | 'queue') so projectCard can
 * render score-drop inline with the SCORE cell instead of as a separate
 * pill row, while the urgent-alert classifier emits {level, label, detail,
 * delta?} for the email-detail-row layout.
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
import {
  STATUS_RANK,
  STATUS_LABEL,
  IX_RANK,
} from '../lib/_alertClassifier.js'

// V3: status colors aligned with the rest of the product palette
const STATUS_COLOR = { active: '#0F766E', limited: '#D97706', pending: '#6366f1', none: '#DC2626' }

function getAlerts(project, stateMap) {
  const current = stateMap[project.state]
  if (!current) return []
  const alerts = []
  const savedRank   = STATUS_RANK[project.cs_status]    ?? 2
  const currentRank = STATUS_RANK[current.csStatus]     ?? 2
  if (currentRank < savedRank) {
    alerts.push(current.csStatus === 'limited'
      ? { level: 'warning', kind: 'status',     label: 'Capacity Limited' }
      : { level: 'urgent',  kind: 'status',     label: 'Program Closed'   })
  }
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10) {
    const drop = project.opportunity_score - current.opportunityScore
    // kind:'score_drop' so projectCard can render the delta inline with the
    // SCORE cell instead of as a standalone alerts-row pill — keeps cards
    // visually consistent in height when score-drop is the only alert.
    alerts.push({ level: 'warning', kind: 'score_drop', drop, label: `Score Drop · ↓${drop} pts` })
  }
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', kind: 'queue', label: 'Queue Harder' })
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
// (left) and status+score (right). Score-drop alert renders inline with the
// SCORE cell (no extra row); other alerts (Program Closed, Capacity Limited,
// Queue Harder) get a tight footer row below identity. 2026-05-04 fix:
// score-drop-only cards used to inflate ~60% taller than non-alerted cards
// because the alerts row added a chunky band of whitespace around a single
// pill — Aden flagged this in the original site-walk review and again 2026-05-04.
function projectCard(project, stateMap) {
  const alerts        = getAlerts(project, stateMap)
  const scoreDrop     = alerts.find(a => a.kind === 'score_drop')
  const otherAlerts   = alerts.filter(a => a.kind !== 'score_drop')
  const state         = stateMap[project.state]
  const status        = state?.csStatus ?? project.cs_status ?? 'active'
  const score         = state?.opportunityScore ?? project.opportunity_score ?? '—'
  const hasUrgent     = alerts.some(a => a.level === 'urgent')
  const accentColor   = hasUrgent ? '#DC2626' : (typeof score === 'number' && score >= 60) ? TEAL_DEEP : '#94A3B8'
  const statusLabel   = STATUS_LABEL[status] ?? status
  const statusColor   = STATUS_COLOR[status] ?? INK_MUTED
  const meta = [
    (project.state_name ?? project.state ?? '').toUpperCase(),
    (project.county ?? '').toUpperCase(),
    project.mw != null ? `${project.mw} MW` : null,
    (project.stage ?? '').toUpperCase(),
  ].filter(Boolean).join(' · ')

  // Inline score-drop indicator next to the SCORE number in the right cell.
  // Visual: "SCORE 67  ↓41" with the delta in amber to draw the eye.
  const scoreDropInline = scoreDrop
    ? ` <span style="color:#92400E;font-weight:700;font-size:11px;letter-spacing:0;margin-left:4px;">↓${scoreDrop.drop}</span>`
    : ''

  // Alerts row only renders when there are non-score-drop alerts. Tightened
  // padding (was 10/14, now 8/10) so a single-pill row doesn't read as a
  // big band of whitespace.
  const alertsRow = otherAlerts.length
    ? `<tr><td colspan="2" style="padding:8px 16px 10px 16px;font-family:${FONT_SANS};">${otherAlerts.map(alertPill).join('&nbsp;&nbsp;')}</td></tr>`
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
            <td valign="top" align="right" width="110" style="white-space:nowrap;">
              <p style="margin:0;font-family:${FONT_MONO};font-size:9px;font-weight:700;color:${statusColor};letter-spacing:0.18em;text-transform:uppercase;">${statusLabel}</p>
              <p style="margin:6px 0 0 0;font-family:${FONT_MONO};font-size:10px;color:${INK_MUTED};letter-spacing:0.06em;">SCORE <span style="color:${INK};font-weight:700;font-size:15px;letter-spacing:-0.01em;">${score}</span>${scoreDropInline}</p>
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

export function buildDigestHtml(user, projects, stateMap, activity) {
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

              <!-- Greeting (time-neutral — recipients open across timezones) -->
              <p style="margin:0 0 6px 0;font-family:${FONT_SANS};font-size:15px;color:${INK};line-height:1.5;">
                Hi ${greeting},
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

// Plain-text fallback generator. Resend will send HTML-only if `text` is
// omitted, which (a) renders raw markup for accessibility tools and plain-
// text-preferring clients, (b) hits spam-filter penalties for missing
// multipart/alternative. Mirrors the HTML's information hierarchy without
// the styling. Site-walk Session 5 / G4.
export function buildDigestText(user, projects, stateMap) {
  const greeting = (user.email?.split('@')[0] ?? 'there').split('.')[0]
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const totalMW = projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
  const stateSet = new Set(projects.map(p => p.state).filter(Boolean))
  const flaggedCount = projects.filter(p => getAlerts(p, stateMap).length > 0).length

  const projectLines = projects.map(p => {
    const state = stateMap[p.state]
    const status = state?.csStatus ?? p.cs_status ?? 'active'
    const score = state?.opportunityScore ?? p.opportunity_score ?? '—'
    const meta = [
      p.state_name ?? p.state,
      p.county,
      p.mw != null ? `${p.mw} MW` : null,
      p.stage,
    ].filter(Boolean).join(' · ')
    const alerts = getAlerts(p, stateMap)
    const alertText = alerts.length
      ? alerts.map(a => `    [${a.level === 'urgent' ? 'URGENT' : 'WARNING'}] ${a.label}`).join('\n')
      : null
    return [
      `  ${p.name}`,
      `  ${meta}`,
      `  Status: ${STATUS_LABEL[status] ?? status}    Score: ${score}`,
      alertText,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return [
    `TRACTOVA WEEKLY BRIEFING — ${today}`,
    '',
    `Hi ${greeting},`,
    '',
    `Your weekly Tractova digest covers ${projects.length} tracked project${projects.length !== 1 ? 's' : ''}${flaggedCount > 0 ? ` — ${flaggedCount} flagged for attention` : ''}.`,
    '',
    'PORTFOLIO',
    `  Tracked:   ${projects.length}`,
    `  Capacity:  ${totalMW.toFixed(1)} MW`,
    `  States:    ${stateSet.size}`,
    '',
    'PROJECTS',
    projectLines,
    '',
    `Open Library: ${APP_URL}/library`,
    '',
    '---',
    "You're receiving this because you have a Tractova Pro subscription.",
    `Manage notifications: ${APP_URL}/profile`,
    `Unsubscribe: reply to this email or visit ${APP_URL}/profile`,
  ].join('\n')
}
