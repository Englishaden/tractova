import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { supabase } from '../lib/supabase'
import { getStateProgramMap } from '../lib/programData'
import { computeSubScores, computeDisplayScore } from '../lib/scoreEngine'
import { Toggle, Input, Button } from '../components/ui'
import { STAGE_COLORS, TECH_COLORS } from '../lib/v3Tokens'

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name || name === '—') return '?'
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)}mo ago`
}

// V3: STAGE_COLORS + TECH_COLORS now imported from src/lib/v3Tokens.js

// ── Manage Billing ───────────────────────────────────────────────────────────
function ManageBillingButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handlePortal = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in again')
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Something went wrong')
      window.location.href = json.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <button
        onClick={handlePortal}
        disabled={loading}
        className="text-sm font-medium disabled:opacity-50 transition-colors"
        style={{ color: '#0F766E' }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#0A1828' }}
        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.color = '#0F766E' }}
      >
        {loading ? 'Loading...' : 'Manage subscription →'}
      </button>
    </div>
  )
}

function AlertPreferences({ userId }) {
  const [prefs, setPrefs] = useState({ digest: true, alerts: true, positive: true, slack: false })
  const [slackUrl, setSlackUrl] = useState('')
  const [slackUrlDirty, setSlackUrlDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('profiles')
      .select('alert_digest, alert_urgent, alert_positive, alert_slack, slack_webhook_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            digest: data.alert_digest ?? true,
            alerts: data.alert_urgent ?? true,
            positive: data.alert_positive ?? true,
            slack: data.alert_slack ?? false,
          })
          setSlackUrl(data.slack_webhook_url || '')
        }
        setLoaded(true)
      })
  }, [userId])

  // Schema-cache-resilient update: if a column hasn't been migrated yet,
  // strip the offending field and retry. Loop caps at 5.
  const safeUpdate = async (payload) => {
    let attempt = { ...payload }
    for (let i = 0; i < 5; i++) {
      const { error } = await supabase.from('profiles').update(attempt).eq('id', userId)
      if (!error) return { ok: true }
      const m = error.message?.match(/['"]([a-z_]+)['"].*column|column.*['"]?([a-z_]+)['"]?.*(?:not exist|of relation)/i)
      const missing = m && (m[1] || m[2])
      if (missing && Object.prototype.hasOwnProperty.call(attempt, missing)) {
        delete attempt[missing]
        continue
      }
      return { ok: false, error }
    }
    return { ok: false, error: new Error('retry cap') }
  }

  const toggle = async (field) => {
    const next = { ...prefs, [field]: !prefs[field] }
    setPrefs(next)
    setSaving(true)
    await safeUpdate({
      alert_digest: next.digest,
      alert_urgent: next.alerts,
      alert_positive: next.positive,
      alert_slack: next.slack,
    })
    setSaving(false)
  }

  const saveSlackUrl = async () => {
    setSaving(true)
    await safeUpdate({ slack_webhook_url: slackUrl.trim() || null })
    setSlackUrlDirty(false)
    setSaving(false)
  }

  if (!loaded) return null

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Notifications</p>
        {saving && <span className="text-[10px] text-gray-400">Saving…</span>}
      </div>
      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-sm font-medium text-gray-800">Weekly digest</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Portfolio summary + market updates every Monday</p>
          </div>
          <Toggle on={prefs.digest} onChange={() => toggle('digest')} ariaLabel="Weekly digest" />
        </label>
        <label className="flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-sm font-medium text-gray-800">Urgent alerts</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Immediate email when a project's market conditions worsen</p>
          </div>
          <Toggle on={prefs.alerts} onChange={() => toggle('alerts')} ariaLabel="Urgent alerts" />
        </label>
        <label className="flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-sm font-medium text-gray-800">Opportunity alerts</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Capacity additions, new program launches, and score improvements ≥10 pts that benefit your portfolio</p>
          </div>
          <Toggle on={prefs.positive} onChange={() => toggle('positive')} ariaLabel="Opportunity alerts" />
        </label>
      </div>

      {/* V3 Wave 1.3: Slack delivery — opt-in, requires user-provided webhook URL */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="font-mono text-[9px] uppercase tracking-[0.20em] font-bold text-ink-muted mb-3">
          Slack Delivery
        </p>
        <label className="flex items-center justify-between cursor-pointer group mb-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Slack alerts</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Push policy alerts to a Slack channel via incoming webhook</p>
          </div>
          <Toggle on={prefs.slack} onChange={() => toggle('slack')} ariaLabel="Slack alerts" />
        </label>
        {prefs.slack && (
          <div>
            <Input
              type="url"
              value={slackUrl}
              onChange={(val) => { setSlackUrl(val); setSlackUrlDirty(true) }}
              placeholder="https://hooks.slack.com/services/..."
              paper
              inputClassName="text-xs font-mono"
            />
            <div className="flex items-center justify-between mt-1.5 gap-3">
              <p className="text-[10px] text-gray-400">
                Create one in your Slack workspace at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">api.slack.com/apps</a> → Incoming Webhooks.
              </p>
              {slackUrlDirty && (
                <Button variant="accent" size="sm" onClick={saveSlackUrl} loading={saving} className="flex-shrink-0">
                  Save URL
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Portfolio Stats (Pro only) ────────────────────────────────────────────────
function PortfolioStats({ projects, stateProgramMap }) {
  const scored = useMemo(() => projects.map(p => {
    const sp = stateProgramMap[p.state]
    if (!sp) return { ...p, score: 0 }
    const subs = computeSubScores(sp, null, p.stage, p.technology)
    return { ...p, score: computeDisplayScore(...Object.values(subs)) }
  }), [projects, stateProgramMap])

  const totalMW = useMemo(() =>
    projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0), [projects])

  const healthScore = useMemo(() => {
    if (!scored.length) return 0
    const wMW = scored.reduce((s, p) => s + (parseFloat(p.mw) || 1), 0)
    return Math.round(scored.reduce((s, p) => s + ((parseFloat(p.mw) || 1) * p.score), 0) / wMW)
  }, [scored])

  const stageData = useMemo(() => {
    const map = {}
    projects.forEach(p => {
      const s = p.stage || 'Unknown'
      map[s] = (map[s] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [projects])

  const techData = useMemo(() => {
    const map = {}
    projects.forEach(p => {
      const t = p.technology || 'Community Solar'
      map[t] = (map[t] || 0) + (parseFloat(p.mw) || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [projects])
  const techTotal = techData.reduce((s, [, mw]) => s + mw, 0)

  const riskCounts = useMemo(() => {
    let strong = 0, moderate = 0, atRisk = 0
    scored.forEach(p => { if (p.score > 65) strong++; else if (p.score >= 40) moderate++; else atRisk++ })
    return { strong, moderate, atRisk }
  }, [scored])

  const healthColor = healthScore > 65 ? '#0F6E56' : healthScore >= 40 ? '#D97706' : '#DC2626'
  const healthBg = healthScore > 65 ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : healthScore >= 40 ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'

  if (!projects.length) return null

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Portfolio Overview</p>

      {/* Health + KPIs row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Health gauge */}
        <div className="rounded-xl px-4 py-4 flex flex-col items-center justify-center" style={{ background: healthBg }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Health</p>
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E7EB" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={healthColor} strokeWidth="3" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums" style={{ color: healthColor }}>{healthScore}</span>
          </div>
        </div>

        {/* Total MW */}
        <div className="rounded-xl px-4 py-4 bg-white border border-gray-100 flex flex-col justify-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Capacity</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{totalMW >= 100 ? Math.round(totalMW) : totalMW.toFixed(1)}</p>
          <p className="text-[10px] text-gray-400 font-medium">MW AC</p>
        </div>

        {/* Projects + risk split */}
        <div className="rounded-xl px-4 py-4 bg-white border border-gray-100 flex flex-col justify-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Projects</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{projects.length}</p>
          <div className="flex items-center gap-1 mt-1">
            {riskCounts.strong > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title={`${riskCounts.strong} Strong`} />}
            {riskCounts.moderate > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title={`${riskCounts.moderate} Moderate`} />}
            {riskCounts.atRisk > 0 && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={`${riskCounts.atRisk} At Risk`} />}
            <span className="text-[9px] text-gray-400">
              {[
                riskCounts.strong > 0 && `${riskCounts.strong} strong`,
                riskCounts.atRisk > 0 && `${riskCounts.atRisk} at risk`,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </div>

      {/* Stage distribution mini-bar */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Stage Distribution</p>
        <div className="flex items-end gap-1.5 h-10">
          {stageData.map(([stage, count]) => (
            <div key={stage} className="group relative flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(4, (count / Math.max(...stageData.map(([, c]) => c))) * 36)}px`,
                  background: STAGE_COLORS[stage] || '#9CA3AF',
                }}
              />
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[9px] bg-gray-900 text-white px-1.5 py-0.5 rounded pointer-events-none z-10">{stage} ({count})</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {stageData.map(([stage, count]) => (
            <span key={stage} className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: STAGE_COLORS[stage] || '#9CA3AF' }} />
              {stage.replace(' (Notice to Proceed)', '')} {count}
            </span>
          ))}
        </div>
      </div>

      {/* Tech breakdown bar */}
      {techTotal > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">MW by Technology</p>
          <div className="flex h-2.5 rounded-full overflow-hidden">
            {techData.map(([tech, mw]) => (
              <div
                key={tech}
                style={{ width: `${(mw / techTotal) * 100}%`, background: TECH_COLORS[tech] || '#6B7280' }}
                className="first:rounded-l-full last:rounded-r-full"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {techData.map(([tech, mw]) => (
              <span key={tech} className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: TECH_COLORS[tech] || '#6B7280' }} />
                {tech} · {mw.toFixed(1)} MW
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Profile ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const { isPro, tier, status } = useSubscription()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [allProjects, setAllProjects] = useState([])
  const [stateProgramMap, setStateProgramMap] = useState({})

  useEffect(() => {
    if (!user) return
    // Fetch all projects for portfolio stats
    supabase.from('projects')
      .select('id, name, state, state_name, county, mw, stage, technology, opportunity_score, saved_at')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .then(({ data }) => setAllProjects(data || []))

    if (isPro) {
      getStateProgramMap().then(setStateProgramMap).catch(console.error)
    }
  }, [user, isPro])

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-gray-500">
          <Link to="/signin" className="text-primary hover:underline">Sign in</Link> to view your profile.
        </p>
      </div>
    )
  }

  const fullName    = user.user_metadata?.full_name || '—'
  const email       = user.email
  const initials    = getInitials(fullName)
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const recentProjects = allProjects.slice(0, 5)

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
        <div className="mt-6 max-w-3xl">

          {/* V3: Profile banner — brand navy with teal accent rail (matches Library banner) */}
          <div className="rounded-xl overflow-hidden mb-6 relative" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
            <div className="px-6 py-6 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)', boxShadow: '0 4px 12px rgba(20,184,166,0.3)' }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-white truncate">{fullName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(15,110,86,0.3)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Pro
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Free
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Member since {memberSince}</span>
                </div>
                {allProjects.length > 0 && (
                  <p className="text-xs mt-2 font-mono" style={{ color: 'rgba(52,211,153,0.7)' }}>
                    {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} tracked
                    {allProjects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0) > 0 && (
                      <> · {allProjects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0).toFixed(1)} MW total</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Admin access — surfaced near the top so it's reachable without
              scrolling. Only renders for the admin user. */}
          {email === 'aden.walker67@gmail.com' && (
            <Link
              to="/admin"
              className="mb-5 flex items-center justify-between bg-white border border-gray-200 rounded-lg px-6 py-3 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">Data Admin</p>
                <p className="text-[10px] text-gray-400">Edit live market intelligence data</p>
              </div>
              <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Open →</span>
            </Link>
          )}

          {/* V3: Two-column layout on desktop. Left = account / subscription / alerts.
              Right = portfolio stats / recent activity. Stacks on mobile. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* Account card */}
              <div className="bg-white border border-gray-200 rounded-lg px-6 py-2">
                <div className="py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                  <p className="text-sm text-gray-900">{email}</p>
                </div>
                <div className="py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Projects saved</p>
                  <p className="text-sm text-gray-900 font-mono tabular-nums">{allProjects.length || '—'}</p>
                </div>
              </div>

              {/* Subscription card */}
              <div className="bg-white border border-gray-200 rounded-lg px-6 py-2">
                <div className="py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Plan</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPro ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary-50 border border-primary-200 rounded-full text-xs font-semibold text-primary">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Pro
                          </span>
                          <span className="text-sm text-gray-500 font-mono tabular-nums">$9.99 / month</span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-semibold text-gray-500">Free</span>
                      )}
                    </div>
                    {isPro ? <ManageBillingButton /> : (
                      <Link to="/search" className="text-sm font-medium text-primary hover:text-primary-700 transition-colors">
                        Upgrade to Pro →
                      </Link>
                    )}
                  </div>
                </div>
                {status && (
                  <div className="py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
                    <p className="text-sm text-gray-900 capitalize">{status.replace('_', ' ')}</p>
                  </div>
                )}
              </div>

              {/* Alert preferences (Pro only) */}
              {isPro && <AlertPreferences userId={user.id} />}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {/* Portfolio Stats (Pro) */}
              {isPro && allProjects.length >= 2 && (
                <PortfolioStats projects={allProjects} stateProgramMap={stateProgramMap} />
              )}

              {/* Recent activity */}
              {recentProjects.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg px-6 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</p>
                  <div className="space-y-2.5">
                    {recentProjects.map(p => (
                      <div key={p.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 font-mono" style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}>
                            {p.state || '—'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 font-medium truncate">{p.name || `${p.state} ${p.county || ''}`}</p>
                            <p className="text-[10px] text-gray-400">{[p.county && `${p.county} Co.`, p.stage].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums font-mono">{timeAgo(p.saved_at)}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/library" className="block mt-3 pt-3 border-t border-gray-100 text-xs font-medium text-primary hover:text-primary-700 transition-colors">
                    View all projects →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back to dashboard</Link>
            <button
              onClick={async () => {
                setSigningOut(true)
                await supabase.auth.signOut()
                navigate('/')
              }}
              disabled={signingOut}
              className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
