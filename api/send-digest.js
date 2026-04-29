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

// V3 design tokens (inlined for the email — fonts/colors must match the platform)
const BRAND_NAVY = '#0F1A2E'
const BRAND_NAVY_DARK = '#0A132A'
const TEAL = '#14B8A6'
const TEAL_DEEP = '#0F766E'
const TEAL_LIGHT = '#5EEAD4'
const INK = '#0A1828'
const INK_MUTED = '#5A6B7A'
const PAPER = '#FAFAF7'

// Source Serif 4 / JetBrains Mono / Inter via Google Fonts CSS — many email
// clients ignore <link rel="stylesheet"> but Gmail and Apple Mail support
// <style> with @import. Fallback stack handles the rest.
const FONT_SERIF = `'Source Serif 4', 'Source Serif Pro', Georgia, serif`
const FONT_SANS  = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
const FONT_MONO  = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`

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
  if (project.opportunity_score != null && current.opportunityScore < project.opportunity_score - 10)
    alerts.push({ level: 'warning', label: 'Score Drop' })
  if (project.ix_difficulty && (IX_RANK[current.ixDifficulty] ?? 0) > (IX_RANK[project.ix_difficulty] ?? 0))
    alerts.push({ level: 'warning', label: 'Queue Harder' })
  return alerts
}

function alertPill(alert) {
  const cfg = alert.level === 'urgent'
    ? { bg: '#FEE2E2', color: '#991B1B', dot: '#DC2626' }
    : { bg: '#FEF3C7', color: '#92400E', dot: '#D97706' }
  return `<span style="display:inline-flex;align-items:center;gap:5px;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}33;border-radius:9999px;padding:3px 10px;font-size:11px;font-weight:600;font-family:${FONT_SANS};">
    <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot};display:inline-block;"></span>${alert.label}
  </span>`
}

// V3 project card — institutional research-note pattern: serif name, mono meta,
// hairline rule between identity and metrics, status pill + score on the right.
function projectCard(project, stateMap) {
  const alerts  = getAlerts(project, stateMap)
  const state   = stateMap[project.state]
  const status  = state?.csStatus ?? project.cs_status ?? 'active'
  const score   = state?.opportunityScore ?? project.opportunity_score ?? '—'
  const hasUrgent = alerts.some(a => a.level === 'urgent')
  const borderColor = hasUrgent ? '#FCA5A5' : '#E5E7EB'
  const accentColor = hasUrgent ? '#DC2626' : score >= 70 ? TEAL_DEEP : score >= 50 ? '#D97706' : '#DC2626'
  const alertsHtml = alerts.length
    ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">${alerts.map(alertPill).join('')}</div>`
    : ''

  return `
  <div style="background:#FFFFFF;border:1px solid ${borderColor};border-left:3px solid ${accentColor};border-radius:8px;padding:16px 20px;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:1;min-width:0;">
        <p style="margin:0;font-weight:600;font-size:16px;color:${INK};font-family:${FONT_SERIF};letter-spacing:-0.015em;line-height:1.25;">${project.name}</p>
        <p style="margin:4px 0 0;font-size:11px;color:${INK_MUTED};font-family:${FONT_MONO};letter-spacing:0.04em;">${(project.state_name ?? project.state ?? '').toUpperCase()} · ${(project.county ?? '').toUpperCase()} · ${project.mw ?? '—'} MW · ${(project.stage ?? '—').toUpperCase()}</p>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <p style="margin:0;font-size:10px;color:${STATUS_COLOR[status] ?? INK_MUTED};font-weight:700;font-family:${FONT_MONO};text-transform:uppercase;letter-spacing:0.16em;">${STATUS_LABEL[status] ?? status}</p>
        <p style="margin:6px 0 0;font-size:11px;color:${INK_MUTED};font-family:${FONT_MONO};">Idx <strong style="color:${INK};font-weight:700;font-size:14px;">${score}</strong></p>
      </div>
    </div>
    ${alertsHtml}
  </div>`
}

function buildDigestHtml(user, projects, stateMap) {
  const hasAlerts   = projects.some(p => getAlerts(p, stateMap).length > 0)
  const totalMW     = projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
  const stateSet    = new Set(projects.map(p => p.state).filter(Boolean))
  const projectsHtml = projects.map(p => projectCard(p, stateMap)).join('')
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

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
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT_SANS};-webkit-font-smoothing:antialiased;">
  <div style="max-width:640px;margin:32px auto;padding:0 16px;">

    <!-- V3 header: brand navy with top teal accent rail -->
    <div style="background:linear-gradient(135deg,${BRAND_NAVY} 0%,${BRAND_NAVY_DARK} 100%);border-radius:10px 10px 0 0;padding:28px 32px;border-top:2px solid ${TEAL};">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${TEAL_LIGHT};font-family:${FONT_MONO};">
        Weekly Briefing · ${today}
      </p>
      <p style="margin:0;font-size:28px;font-weight:600;color:#FFFFFF;letter-spacing:-0.02em;font-family:${FONT_SERIF};line-height:1.1;">
        Tractova
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.55);font-family:${FONT_SANS};">
        Your portfolio, monitored for policy changes.
      </p>
    </div>

    <!-- Body -->
    <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:28px 32px;">

      <!-- Greeting -->
      <p style="margin:0 0 6px;font-size:15px;color:${INK};font-family:${FONT_SANS};">
        Good morning ${user.email?.split('@')[0] ?? 'there'},
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:${INK_MUTED};line-height:1.5;font-family:${FONT_SANS};">
        Here's your snapshot of ${projects.length} tracked project${projects.length !== 1 ? 's' : ''}${hasAlerts ? ` — <strong style="color:#92400E;">${projects.filter(p => getAlerts(p, stateMap).length > 0).length} flagged for attention</strong>` : ''}.
      </p>

      <!-- Portfolio meta strip -->
      <div style="display:table;width:100%;border-collapse:collapse;margin:0 0 24px;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;">
        <div style="display:table-row;">
          <div style="display:table-cell;padding:14px 16px 14px 0;border-right:1px solid #E2E8F0;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:${INK_MUTED};font-family:${FONT_MONO};">Tracked</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${INK};font-family:${FONT_MONO};letter-spacing:-0.01em;">${projects.length}</p>
          </div>
          <div style="display:table-cell;padding:14px 16px;border-right:1px solid #E2E8F0;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:${INK_MUTED};font-family:${FONT_MONO};">Capacity</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${INK};font-family:${FONT_MONO};letter-spacing:-0.01em;">${totalMW.toFixed(1)} <span style="font-size:11px;font-weight:500;color:${INK_MUTED};">MW</span></p>
          </div>
          <div style="display:table-cell;padding:14px 0 14px 16px;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:${INK_MUTED};font-family:${FONT_MONO};">States</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${INK};font-family:${FONT_MONO};letter-spacing:-0.01em;">${stateSet.size}</p>
          </div>
        </div>
      </div>

      <!-- Section eyebrow -->
      <p style="margin:0 0 12px;font-size:9px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${INK_MUTED};font-family:${FONT_MONO};">
        Portfolio
      </p>

      ${projectsHtml}

      <!-- CTA -->
      <div style="margin-top:28px;text-align:center;">
        <a href="${APP_URL}/library" style="display:inline-block;background:${TEAL};color:#FFFFFF;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;font-family:${FONT_SANS};box-shadow:0 4px 12px rgba(20,184,166,0.25);">
          Open Library →
        </a>
      </div>

      <!-- Footer -->
      <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:${INK_MUTED};text-align:center;font-family:${FONT_SANS};line-height:1.6;">
        You're receiving this because you have a Tractova Pro subscription.<br>
        <a href="${APP_URL}/profile" style="color:${TEAL_DEEP};text-decoration:none;font-weight:500;">Manage notifications</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/library" style="color:${TEAL_DEEP};text-decoration:none;font-weight:500;">View Library</a>
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
  const isVercelCron       = req.headers['x-vercel-cron'] === '1'
  const isManualWithSecret = process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  if (!isVercelCron && !isManualWithSecret) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Load live state data — replaces the former hardcoded STATE_STATUS object
    const { data: stateRows, error: stateErr } = await supabaseAdmin
      .from('state_programs')
      .select('id, name, cs_status, capacity_mw, lmi_percent, ix_difficulty')
    if (stateErr) throw stateErr
    const stateMap = buildStateMap(stateRows ?? [])

    // Fetch all Pro users
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier, subscription_status, alert_digest')
      .eq('subscription_tier', 'pro')
      .in('subscription_status', ['active', 'trialing'])

    if (profileErr) throw profileErr

    const results = []

    for (const profile of profiles ?? []) {
      // Respect digest preference — default on if column not yet set
      if (profile.alert_digest === false) continue

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

      const html = buildDigestHtml(user, projects, stateMap)
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
