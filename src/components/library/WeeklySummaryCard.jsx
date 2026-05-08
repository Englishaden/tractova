import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import { TECH_COLORS } from '../../lib/v3Tokens'
import TractovaLoader from '../ui/TractovaLoader'

// ── Weekly Summary Card ──────────────────────────────────────────────────────
// V3: TECH_COLORS now imported from lib/v3Tokens at top of file (kept name to avoid render-call churn).

// V3: per-user-per-day cache so Library load doesn't re-spend tokens.
// Mirrors the per-state news-pulse pattern. Date in key handles 24h TTL.
const _portfolioInsightCache = new Map()

export default function WeeklySummaryCard({ projects, stateProgramMap }) {
  const { user } = useAuth()
  const cacheKey = user ? `${user.id}::${new Date().toISOString().slice(0, 10)}` : null
  const [collapsed, setCollapsed] = useState(false)
  const [aiInsight, setAiInsight] = useState(cacheKey ? (_portfolioInsightCache.get(cacheKey) ?? null) : null)
  const [aiLoading, setAiLoading] = useState(false)

  // Compute per-project scores
  const scored = useMemo(() => projects.map(p => {
    const sp = stateProgramMap[p.state]
    if (!sp) return { ...p, score: 0 }
    const subs = computeSubScores(sp, null, p.stage, p.technology)
    // 2026-05-05 root-cause fix: Object.values(subs) spread `coverage` (the
    // 4th key, an object) as the `weights` argument to computeDisplayScore.
    // `weights.offtake = 'researched'` (string), so the multiplication
    // returned NaN, poisoning every downstream aggregate. Destructure
    // explicitly. Profile.jsx had the same bug — fixed in lockstep.
    return { ...p, score: safeScore(subs.offtake, subs.ix, subs.site) }
  }), [projects, stateProgramMap])

  // Portfolio health score (MW-weighted avg of valid scores).
  //
  // 2026-05-05 fix: when stateProgramMap[p.state] is undefined for a project
  // (state not in curated map, or stateProgramMap still hydrating), the
  // computeSubScores call returns NaN values which poisoned the weighted
  // average and rendered "NaN" in the Portfolio Health chip. Filter to
  // finite scores before aggregation; fall back to 0 when nothing valid.
  const healthScore = useMemo(() => {
    const valid = scored.filter(p => Number.isFinite(p.score))
    if (!valid.length) return 0
    const totalMW = valid.reduce((s, p) => s + (parseFloat(p.mw) || 1), 0)
    if (totalMW === 0) return 0
    const weighted = valid.reduce((s, p) => s + ((parseFloat(p.mw) || 1) * p.score), 0)
    return Math.round(weighted / totalMW)
  }, [scored])

  // MW by technology
  const techBreakdown = useMemo(() => {
    const map = {}
    scored.forEach(p => {
      const tech = p.technology || 'Community Solar'
      map[tech] = (map[tech] || 0) + (parseFloat(p.mw) || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [scored])
  const totalMW = techBreakdown.reduce((s, [, mw]) => s + mw, 0)

  // V3: Risk concentration — % of portfolio MW exposed to single state/program/tech
  const concentration = useMemo(() => {
    if (!scored.length) return null
    const total = scored.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
    if (total === 0) return null
    const groupBy = (keyFn) => {
      const map = {}
      scored.forEach(p => {
        const k = keyFn(p) || 'Unknown'
        map[k] = (map[k] || 0) + (parseFloat(p.mw) || 0)
      })
      const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0]
      return top ? { name: top[0], pct: Math.round((top[1] / total) * 100) } : null
    }
    return {
      state:   groupBy(p => p.state),
      program: groupBy(p => stateProgramMap[p.state]?.csProgram),
      tech:    groupBy(p => p.technology || 'Community Solar'),
    }
  }, [scored, stateProgramMap])

  const concColor = (pct) => pct >= 70 ? { text: '#DC2626', bg: '#FEE2E2', label: 'High' }
    : pct >= 40 ? { text: '#B45309', bg: '#FEF3C7', label: 'Moderate' }
    : { text: '#059669', bg: '#D1FAE5', label: 'Diversified' }

  const healthColor = healthScore > 65 ? 'text-teal-800' : healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
  const healthBg = healthScore > 65 ? 'bg-teal-50' : healthScore >= 40 ? 'bg-amber-50' : 'bg-red-50'

  const handleGenerateInsight = async () => {
    setAiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = scored.map(p => ({
        name: p.name, state: p.state, county: p.county, mw: p.mw,
        stage: p.stage, technology: p.technology, score: p.score
      }))
      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: 'portfolio', projects: payload })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.summary) {
          setAiInsight(data)
          if (cacheKey) _portfolioInsightCache.set(cacheKey, data)
        }
      }
    } catch { /* silently fail */ }
    setAiLoading(false)
  }

  // V3: auto-fire portfolio insight on first load per user-per-day. The
  // manual button still works for on-demand regeneration. Skips if portfolio
  // is too small to be meaningful (<2 projects) or if we already have today's
  // cached version. Pro-only -- request returns 403 silently for free users.
  useEffect(() => {
    if (!cacheKey) return
    if (aiInsight) return            // already loaded (from cache or previous run)
    if (aiLoading) return            // in flight
    if (scored.length < 2) return    // not enough portfolio to analyze
    if (!stateProgramMap || !Object.keys(stateProgramMap).length) return
    handleGenerateInsight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, scored.length, Object.keys(stateProgramMap).length])

  // Geographic breakdown
  // 2026-05-05 fix: same NaN-guard pattern as healthScore. Only push finite
  // scores into the per-state scores array so a single bad row doesn't NaN
  // the avgScore for the whole state.
  const geoBreakdown = useMemo(() => {
    const map = {}
    scored.forEach(p => {
      const st = p.state_name || p.state || 'Unknown'
      if (!map[st]) map[st] = { count: 0, mw: 0, avgScore: 0, scores: [] }
      map[st].count++
      map[st].mw += parseFloat(p.mw) || 0
      if (Number.isFinite(p.score)) map[st].scores.push(p.score)
    })
    Object.values(map).forEach(v => {
      v.avgScore = v.scores.length
        ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
        : 0
    })
    return Object.entries(map).sort((a, b) => b[1].mw - a[1].mw)
  }, [scored])

  return (
    <div className="rounded-xl overflow-hidden mb-4 bg-white border border-gray-200 shadow-xs">
      {/* V3: Navy header chrome — institutional treatment matching MetricsBar */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left relative"
        style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
      >
        {/* Top teal accent rail */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.30)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Portfolio Intelligence</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{projects.length} projects · {totalMW.toFixed(1)} MW across {geoBreakdown.length} state{geoBreakdown.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <svg
          className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!collapsed && (
        <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid rgba(15,26,46,0.08)' }}>
          {/* Row 1: Health gauge + Total MW + Risk Concentration (V3: dropped Avg Score + Risk Spread) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Health Score — animated tech panel (mesh + scan + pulse rings).
                Tier colors: teal (strong) / amber (moderate) / red (at risk).
                Background gradient is tier-derived; --health-accent + --health-grid-color
                drive the keyframes in index.css. */}
            {(() => {
              const tier = healthScore > 65 ? 'strong' : healthScore >= 40 ? 'moderate' : 'risk'
              const tierBg = {
                strong:   'radial-gradient(ellipse at center, #ECFDF5 0%, #D1FAE5 100%)',
                moderate: 'radial-gradient(ellipse at center, #FFFBEB 0%, #FEF3C7 100%)',
                risk:     'radial-gradient(ellipse at center, #FEF2F2 0%, #FEE2E2 100%)',
              }[tier]
              const accent = { strong: 'rgba(15,118,110,0.32)', moderate: 'rgba(217,119,6,0.32)', risk: 'rgba(220,38,38,0.32)' }[tier]
              const gridColor = { strong: 'rgba(15,118,110,0.10)', moderate: 'rgba(217,119,6,0.10)', risk: 'rgba(220,38,38,0.10)' }[tier]
              const ringStroke = { strong: '#0F766E', moderate: '#D97706', risk: '#DC2626' }[tier]
              const tierLabel = { strong: 'Strong', moderate: 'Moderate', risk: 'At Risk' }[tier]
              const tierTextColor = { strong: '#059669', moderate: '#B45309', risk: '#DC2626' }[tier]
              return (
                <div
                  className="relative rounded-xl px-4 py-4 flex flex-col items-center justify-center overflow-hidden"
                  style={{ background: tierBg, '--health-accent': accent, '--health-grid-color': gridColor }}
                >
                  <div className="absolute inset-0 health-grid pointer-events-none" aria-hidden="true" />
                  <div className="absolute inset-0 health-scan pointer-events-none" aria-hidden="true" />
                  <p className="relative text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-1">Portfolio Health</p>
                  <div className="relative w-16 h-16">
                    <span className="absolute inset-0 rounded-full health-ring pointer-events-none" aria-hidden="true" />
                    <span className="absolute inset-0 rounded-full health-ring health-ring-2 pointer-events-none" aria-hidden="true" />
                    <span className="absolute inset-0 rounded-full health-ring health-ring-3 pointer-events-none" aria-hidden="true" />
                    <svg viewBox="0 0 36 36" className="relative w-16 h-16 -rotate-90">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={ringStroke} strokeWidth="3" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold font-mono tabular-nums ${healthColor}`}>{healthScore}</span>
                  </div>
                  <p className="relative text-[9px] font-medium mt-1" style={{ color: tierTextColor }}>{tierLabel}</p>
                </div>
              )
            })()}

            {/* KPI: Total MW + project count combined */}
            <div className="rounded-xl px-4 py-4 bg-gray-50 border border-gray-100 flex flex-col justify-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Total Capacity</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-gray-900 leading-none">{totalMW.toFixed(1)}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-1">MW AC across {scored.length} project{scored.length !== 1 ? 's' : ''}</p>
            </div>

            {/* V3: Portfolio Risk Concentration — replaces Avg Score + Risk Spread */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">Risk Concentration</p>
              {concentration ? (
                <div className="space-y-1.5">
                  {[
                    { label: 'Single state',   data: concentration.state },
                    { label: 'Single program', data: concentration.program },
                    { label: 'Single tech',    data: concentration.tech },
                  ].map(({ label, data }) => data && (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${data.pct}%`, background: concColor(data.pct).text }}
                        />
                      </div>
                      <span
                        className="text-[10px] font-bold font-mono tabular-nums w-9 text-right"
                        style={{ color: concColor(data.pct).text }}
                      >
                        {data.pct}%
                      </span>
                    </div>
                  ))}
                  {concentration.state && (
                    <p className="text-[9px] text-gray-400 mt-1.5 leading-tight">
                      Top exposure: {concentration.state.name} ({concentration.state.pct}% of MW)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400">Add projects to compute</p>
              )}
            </div>
          </div>

          {/* Row 2: MW by Technology + Geographic Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MW by Technology — donut-style */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-3">MW by Technology</p>
              {totalMW > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      {(() => {
                        let offset = 0
                        return techBreakdown.map(([tech, mw]) => {
                          const pct = (mw / totalMW) * 100
                          const el = <circle key={tech} cx="18" cy="18" r="14" fill="none" stroke={TECH_COLORS[tech] || '#6B7280'} strokeWidth="4" strokeDasharray={`${pct * 0.88} ${88 - pct * 0.88}`} strokeDashoffset={-offset * 0.88} strokeLinecap="round" />
                          offset += pct
                          return el
                        })
                      })()}
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">{totalMW.toFixed(0)}</span>
                      <span className="text-[8px] text-gray-400">MW</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {techBreakdown.map(([tech, mw]) => (
                      <div key={tech} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <span className="w-2 h-2 rounded-xs shrink-0" style={{ background: TECH_COLORS[tech] || '#6B7280' }} />
                          {tech}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums text-gray-700">{mw.toFixed(1)} MW</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No MW data</p>
              )}
            </div>

            {/* Geographic Breakdown */}
            <div className="rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-3">Geographic Spread</p>
              <div className="space-y-2">
                {geoBreakdown.slice(0, 5).map(([state, data]) => (
                  <div key={state} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-700 w-8 shrink-0">{state}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${totalMW > 0 ? (data.mw / totalMW) * 100 : 0}%`, background: data.avgScore > 65 ? '#0F766E' : data.avgScore >= 40 ? '#D97706' : '#DC2626' }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-gray-500 w-14 text-right shrink-0">{data.mw.toFixed(1)} MW</span>
                    <span className="text-[9px] font-bold tabular-nums w-6 text-right shrink-0" style={{ color: data.avgScore > 65 ? '#0F766E' : data.avgScore >= 40 ? '#B45309' : '#DC2626' }}>{data.avgScore}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: AI Insight */}
          <div className="rounded-xl border border-gray-100 overflow-hidden" style={{ background: 'linear-gradient(135deg, #F0FDF9, #ECFDF5)' }}>
            {aiInsight ? (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F766E, #10B981)' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">AI Portfolio Insight</p>
                </div>
                <p className="text-xs leading-relaxed text-gray-700">{aiInsight.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiInsight.topRecommendation && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-teal-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-100 shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-teal-700 mb-0.5">Top Recommendation</p>
                        <p className="text-[11px] leading-relaxed text-gray-700">{aiInsight.topRecommendation}</p>
                      </div>
                    </div>
                  )}
                  {aiInsight.riskAssessment && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/80 border border-amber-100">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-100 shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Risk Assessment</p>
                        <p className="text-[11px] leading-relaxed text-gray-700">{aiInsight.riskAssessment}</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGenerateInsight}
                  className="text-[10px] font-medium text-teal-600 hover:text-teal-800 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            ) : aiLoading ? (
              <div className="px-4 py-8 flex items-center justify-center">
                <TractovaLoader
                  size={64}
                  label="Generating Portfolio Insight"
                  sublabel="Analyzing scoring · IX risk · concentration"
                />
              </div>
            ) : (
              <button
                onClick={handleGenerateInsight}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-4 text-xs font-semibold text-teal-800 hover:bg-teal-50/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F766E, #10B981)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                Generate AI Portfolio Insight
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
