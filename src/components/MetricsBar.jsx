import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip as RTooltip, Legend } from 'recharts'
import { getDashboardMetrics, getDashboardMetricsHistory, getStatePrograms, getNewsFeed } from '../lib/programData'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import CountUp from './ui/CountUp'
import KPISparkline from './charts/KPISparkline'
import BarListRows from './ui/BarListRows'

// PolicyDualSparkline — two-line trend for the Policy Pulse card. Plots the
// Policy pillar against all other signals (offtake + IX + site) per ISO week
// from the real `policyPulseByPillar` series (news_feed grouped by week +
// pillar). Aden 2026-05-29: the single sparkline read as possibly-fake; this
// shows the actual policy-vs-market split, both grounded in live data.
function PolicyDualSparkline({ series, height = 32, compact = true }) {
  const data = useMemo(() => (series || []).map((w) => ({
    week:   w.week,
    policy: w.policy || 0,
    market: (w.offtake || 0) + (w.ix || 0) + (w.site || 0),
  })), [series])

  if (data.length === 0) return <div style={{ height, width: '100%' }} />

  return (
    <div style={{ width: '100%', height }} aria-label="Policy vs market signal trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: 2 }}>
          {!compact && (
            <YAxis hide={false} tickLine={false} axisLine={false} width={24} allowDecimals={false}
              tick={{ fill: 'var(--text-muted, #6C7A91)', fontSize: 9, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }} />
          )}
          {!compact && (
            <RTooltip
              cursor={{ stroke: 'var(--hairline-teal, rgba(20,184,166,0.45))', strokeWidth: 1 }}
              contentStyle={{ background: 'var(--bg-surface, #182336)', border: '1px solid var(--cards-border)', borderRadius: 4, padding: '4px 8px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--text-primary)' }}
              labelStyle={{ color: 'var(--text-label)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em' }}
              labelFormatter={(v) => String(v).replace(/^\d{4}-W/, 'W')}
            />
          )}
          {!compact && (
            <Legend iconType="plainline" iconSize={10} wrapperStyle={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 9, paddingTop: 4, color: 'var(--text-label)' }} />
          )}
          <Line type="monotone" dataKey="market" name="All signals" stroke="#14B8A6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="policy" name="Policy" stroke="#A78BFA" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// MetricsBar — Dashboard revamp v2.
//
// 5 KPI cards in the disclosure-metric pattern (Defillama-derived). Each
// card has a compact resting state (big number + label + small sparkline)
// and an expanded state that reveals BOTH a bigger sparkline AND
// card-specific intel (Aden 2026-05-28 callout: "not sure what clicking
// the cards at the bottom does. Confusing and doesn't seem to reveal
// anything. Please rework to actually add value").
//
// Per card, the reveal is:
//   • CS Coverage  → top 4 active states by remaining capacity
//   • IX Headroom  → breakdown by IX difficulty tier (easy/moderate/hard)
//   • Policy Pulse → 3 most-recent news items with pillar + source
//   • Avg Capacity → top 4 states by remaining capacity (active+limited)
//   • Pipeline Load→ active vs limited MW split + top 4 states by MW
//
// Data-honesty: sparkline history is 4 of 5 real (csCoverage/pipelineLoad/
// avgCapacity/policyPulse derived from snapshots+news_feed; IX Headroom
// has no history source yet — renders "trend tracking coming online"
// without a fake sparkline).

const CARD_BG = 'var(--cards-bg, #131C2C)'

// ── Icons (kept lean — decorative, not the focal point of the card) ───────
function IconMap()        { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>) }
function IconZap()        { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>) }
function IconBell()       { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>) }
function IconGauge()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10"/><path d="M12 6v6l4 2"/></svg>) }
function IconTrendingUp() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>) }

// ── Loading shimmer — 5 cards matching the new short shape ────────────────
function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-md border dash-shimmer"
          style={{ background: CARD_BG, borderColor: 'var(--cards-border)', minHeight: '108px' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal) 50%, transparent 100%)' }} />
        </div>
      ))}
    </div>
  )
}

// ── Reveal sub-components — render inside the expanded card body ──────────

// Top-N state row list — generic. Used by activeCS, avgCapacity, mwPipeline.
// Now renders as a Tremor-style Bar List (label on a proportional value bar);
// see src/components/ui/BarListRows.jsx + Skills/Tremor/Bar List/_PORT.md.
function StateRowsReveal({ rows, valueFormatter, sub }) {
  // Each reveal row is a state-program object; the bar length scales by its
  // remaining capacity (the same number the formatter prints). Carry `value`
  // for the bar width while keeping the original object for the formatter.
  const barRows = (rows || []).map((r) => ({ ...r, value: r.capacityMW || 0 }))
  return <BarListRows rows={barRows} valueFormatter={valueFormatter} sub={sub} />
}

// IX difficulty breakdown — small bar split by tier
function IxDifficultyReveal({ programs }) {
  const counts = useMemo(() => {
    const c = { easy: 0, moderate: 0, hard: 0, very_hard: 0 }
    for (const p of programs || []) {
      if (p.ixDifficulty in c) c[p.ixDifficulty] += 1
    }
    return c
  }, [programs])

  const tiers = [
    { key: 'easy',      label: 'Easy',      color: '#14B8A6', count: counts.easy },
    { key: 'moderate',  label: 'Moderate',  color: '#5EEAD4', count: counts.moderate },
    { key: 'hard',      label: 'Hard',      color: '#FBBF24', count: counts.hard },
    { key: 'very_hard', label: 'Very Hard', color: '#F87171', count: counts.very_hard },
  ]
  const total = tiers.reduce((s, t) => s + t.count, 0)
  if (total === 0) return <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>No IX data.</p>

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex w-full h-2 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {tiers.map((t) => (
          t.count > 0 && (
            <div
              key={t.key}
              style={{ width: `${(t.count / total) * 100}%`, background: t.color }}
              title={`${t.label}: ${t.count}`}
            />
          )
        ))}
      </div>
      {/* Legend rows */}
      <ul className="space-y-1 mt-2">
        {tiers.map((t) => (
          <li key={t.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: t.color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-label)' }}>{t.label}</span>
            </div>
            <span className="font-mono text-[10px] tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.count} <span style={{ color: 'var(--text-muted)' }}>· {Math.round((t.count / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Recent news items reveal — pillar dot + headline + source/date
function RecentNewsReveal({ news }) {
  const recent = useMemo(() => {
    return (news || []).slice(0, 3)
  }, [news])
  if (recent.length === 0) return <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>No recent items.</p>
  const PILLAR_COLOR = { offtake: '#14B8A6', ix: '#FBBF24', site: '#60A5FA', policy: '#A78BFA' }
  return (
    <ul className="space-y-1.5">
      {recent.map((n) => {
        const dot = PILLAR_COLOR[n.pillar] || '#14B8A6'
        const date = n.date ? new Date(n.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
        return (
          <li key={n.id} className="flex items-start gap-1.5">
            <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] leading-snug line-clamp-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                {n.headline}
              </p>
              <p className="text-[9px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {n.source}{date ? ` · ${date}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Active vs Limited MW split — small horizontal bar + caption
function PipelineSplitReveal({ programs }) {
  const split = useMemo(() => {
    let active = 0, limited = 0
    for (const p of programs || []) {
      const mw = p.capacityMW || 0
      if (p.csStatus === 'active')  active  += mw
      if (p.csStatus === 'limited') limited += mw
    }
    return { active, limited, total: active + limited }
  }, [programs])

  if (split.total === 0) return <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>No pipeline data.</p>

  const topStates = (programs || [])
    .filter((p) => p.csStatus === 'active' || p.csStatus === 'limited')
    .sort((a, b) => (b.capacityMW || 0) - (a.capacityMW || 0))
    .slice(0, 3)

  return (
    <div className="space-y-2">
      {/* Active = teal, Limited = amber — distinct hues so the split reads at
          a glance (Aden 2026-05-29: the two teals were too close). */}
      <div className="flex w-full h-2 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${(split.active / split.total) * 100}%`, background: '#14B8A6' }} />
        <div style={{ width: `${(split.limited / split.total) * 100}%`, background: '#FBBF24' }} />
      </div>
      {/* Two columns, each stacking label over value — keeps the MW unit on
          the same line as the number instead of wrapping it. */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#14B8A6' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-label)' }}>Active</span>
          </div>
          <p className="font-mono text-[12px] tabular-nums font-bold mt-0.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            {split.active.toLocaleString()} MW
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#FBBF24' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-label)' }}>Limited</span>
          </div>
          <p className="font-mono text-[12px] tabular-nums font-bold mt-0.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            {split.limited.toLocaleString()} MW
          </p>
        </div>
      </div>
      {/* Top states as the same Bar List treatment used by CS Coverage /
          Avg Capacity, so every state-ranking reveal reads consistently. */}
      <div className="pt-1 border-t" style={{ borderColor: 'var(--cards-border)' }}>
        <BarListRows
          rows={topStates.map((s) => ({ ...s, value: s.capacityMW || 0 }))}
          valueFormatter={(s) => `${(s.capacityMW || 0).toLocaleString()} MW`}
          sub="Top 3 by MW"
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function MetricsBar({ previewMode = false }) {
  void previewMode

  // Multiple cards can be open at once (Aden 2026-05-29: "any card can be
  // opened or closed at the same time"). Track a Set of expanded keys.
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())
  const [liveMetrics, setLiveMetrics] = useState(null)
  const [history, setHistory] = useState(null)
  const [programs, setPrograms] = useState([])
  const [news, setNews] = useState([])

  useEffect(() => {
    getDashboardMetrics().then(setLiveMetrics).catch((e) => console.warn('[MetricsBar] live metrics failed:', e?.message))
    getDashboardMetricsHistory({ weeks: 8 })
      .then(setHistory)
      .catch((e) => console.warn('[MetricsBar] history failed:', e?.message))
    getStatePrograms().then(setPrograms).catch((e) => console.warn('[MetricsBar] programs failed:', e?.message))
    getNewsFeed().then(setNews).catch((e) => console.warn('[MetricsBar] news failed:', e?.message))
  }, [])

  // Live values from Supabase with graceful defaults while loading
  const m = {
    statesWithActiveCS:      liveMetrics?.statesWithActiveCS      ?? '—',
    statesWithAnyCS:         liveMetrics?.statesWithAnyCS         ?? '—',
    utilitiesWithIXHeadroom: liveMetrics?.utilitiesWithIXHeadroom ?? '—',
    policyAlertsThisWeek:    liveMetrics?.policyAlertsThisWeek    ?? '—',
    avgCSCapacityRemaining:  liveMetrics?.avgCSCapacityRemaining  ?? '—',
    totalMWInPipeline:       liveMetrics?.totalMWInPipeline       ?? '—',
  }

  // Reveal rows — top N states for the activeCS / avgCapacity / mwPipeline cards
  const topActiveStates = useMemo(() => (
    programs
      .filter((p) => p.csStatus === 'active' && (p.capacityMW || 0) > 0)
      .sort((a, b) => (b.capacityMW || 0) - (a.capacityMW || 0))
      .slice(0, 4)
  ), [programs])

  const topRemainingStates = useMemo(() => (
    programs
      .filter((p) => (p.csStatus === 'active' || p.csStatus === 'limited') && (p.capacityMW || 0) > 0)
      .sort((a, b) => (b.capacityMW || 0) - (a.capacityMW || 0))
      .slice(0, 4)
  ), [programs])

  const CARDS = [
    {
      key: 'activeCS',
      label: 'CS Coverage',
      value: m.statesWithActiveCS,
      rawValue: liveMetrics?.statesWithActiveCS,
      sub: `${m.statesWithAnyCS} with any program`,
      icon: <IconMap />,
      series: history?.csCoverage || [],
      sparkColor: '#14B8A6',
      tooltip: 'States with funded community-solar programs accepting new project applications.',
      reveal: (
        <StateRowsReveal
          rows={topActiveStates}
          valueFormatter={(s) => `${(s.capacityMW || 0).toLocaleString()} MW`}
          sub={`Showing top 4 of ${m.statesWithActiveCS} active`}
        />
      ),
    },
    {
      key: 'ixCapacity',
      label: 'IX Headroom',
      value: m.utilitiesWithIXHeadroom,
      rawValue: liveMetrics?.utilitiesWithIXHeadroom,
      sub: 'open queue capacity',
      icon: <IconZap />,
      series: history?.ixHeadroom,
      sparkColor: '#FBBF24',
      tooltip: 'Utilities estimated to have meaningful interconnection queue capacity for ≤5 MW projects.',
      noTrendNote: 'Weekly trend tracking coming online',
      reveal: <IxDifficultyReveal programs={programs} />,
    },
    {
      key: 'policyAlerts',
      label: 'Policy Pulse',
      value: m.policyAlertsThisWeek,
      rawValue: liveMetrics?.policyAlertsThisWeek,
      sub: 'this week · all pillars',
      icon: <IconBell />,
      dual: true,
      dualSeries: history?.policyPulseByPillar || [],
      sparkColor: '#A78BFA',
      tooltip: 'Policy + market signals published in the last 7 days across all pillars. Trend splits Policy-pillar volume from all other signals.',
      reveal: <RecentNewsReveal news={news} />,
    },
    {
      key: 'avgCapacity',
      label: 'Avg Capacity',
      value: (() => {
        const raw = m.avgCSCapacityRemaining
        const num = typeof raw === 'string' ? parseInt(raw, 10) : raw
        return Number.isFinite(num) ? `${num} MW` : raw
      })(),
      rawValue: parseInt(liveMetrics?.avgCSCapacityRemaining, 10),
      suffix: ' MW',
      sub: 'avg remaining · active states',
      icon: <IconGauge />,
      series: history?.avgCapacity || [],
      sparkColor: '#34D399',
      tooltip: 'Mean MW of program capacity still open across active and limited states.',
      reveal: (
        <StateRowsReveal
          rows={topRemainingStates}
          valueFormatter={(s) => `${(s.capacityMW || 0).toLocaleString()} MW`}
          sub="Top 4 by remaining capacity"
        />
      ),
    },
    {
      key: 'mwPipeline',
      label: 'Pipeline Load',
      value: typeof m.totalMWInPipeline === 'number' ? m.totalMWInPipeline.toLocaleString() : m.totalMWInPipeline,
      rawValue: liveMetrics?.totalMWInPipeline,
      sub: 'active + limited states',
      icon: <IconTrendingUp />,
      series: history?.pipelineLoad || [],
      sparkColor: '#5EEAD4',
      tooltip: 'Total MW of remaining capacity across all active + limited CS programs.',
      reveal: <PipelineSplitReveal programs={programs} />,
    },
  ]

  if (!liveMetrics) return <MetricsSkeleton />

  const handleToggle = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 items-start">
      {CARDS.map((c) => {
        const expanded = expandedKeys.has(c.key)
        const chartData = c.dual ? c.dualSeries : c.series
        const hasSeries = Array.isArray(chartData) && chartData.length > 0
        return (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleToggle(c.key)}
                className="group relative overflow-hidden rounded-md text-left transition-all duration-200 hover:-translate-y-0.5 w-full"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${expanded ? 'var(--hairline-teal, rgba(20,184,166,0.45))' : 'var(--cards-border, #1F2A3D)'}`,
                  minHeight: expanded ? '280px' : '94px',
                  boxShadow: expanded ? '0 8px 32px -12px rgba(20,184,166,0.45)' : 'none',
                }}
                aria-expanded={expanded}
              >
                {/* Top accent hairline */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

                <div className="relative p-3 flex flex-col gap-1.5 h-full">
                  {/* Eyebrow row: label + icon + chevron */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold leading-none" style={{ color: 'var(--text-label, #98A4B6)' }}>
                        {c.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span style={{ color: 'var(--text-muted, #6C7A91)', opacity: 0.7 }}>
                        {c.icon}
                      </span>
                      <svg
                        width="9" height="9" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="transition-transform duration-150"
                        style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {/* Big number */}
                  <div
                    className="font-bold tabular-nums leading-none mt-0.5"
                    style={{
                      color: 'var(--text-primary, #F5F7FA)',
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      fontSize: expanded ? '32px' : '26px',
                      transition: 'font-size 0.2s ease',
                    }}
                  >
                    {Number.isFinite(c.rawValue) ? <CountUp value={c.rawValue} suffix={c.suffix || ''} /> : c.value}
                  </div>

                  {/* Sub-label */}
                  <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted, #6C7A91)' }}>
                    {c.sub}
                  </p>

                  {/* Sparkline — smaller in expanded mode now, since the
                      reveal block takes the bulk of the real estate */}
                  <div className="pt-1">
                    {hasSeries ? (
                      c.dual ? (
                        <PolicyDualSparkline
                          series={chartData}
                          height={expanded ? 64 : 28}
                          compact={!expanded}
                        />
                      ) : (
                        <KPISparkline
                          data={chartData}
                          color={c.sparkColor}
                          height={expanded ? 56 : 28}
                          compact={!expanded}
                          ariaLabel={`${c.label} 8-week trend`}
                        />
                      )
                    ) : (
                      <div
                        className="flex items-center gap-1.5 h-[28px] px-1"
                        style={{ color: 'var(--text-muted, #6C7A91)' }}
                      >
                        <span className="relative flex w-1 h-1 shrink-0">
                          <span className="relative inline-flex rounded-full h-1 w-1 dash-pulse-dot" style={{ background: 'var(--warning, #FBBF24)' }} />
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] truncate" style={{ color: 'var(--text-muted, #6C7A91)' }}>
                          {c.noTrendNote || '8-week trend accruing'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CARD-SPECIFIC REVEAL — only when expanded. This is the
                      real intel each card surfaces (top states, IX
                      breakdown, recent news, MW split). Replaces the
                      previous "just bigger sparkline" expansion. */}
                  {expanded && (
                    <div
                      className="mt-2 pt-2"
                      style={{ borderTop: '1px solid var(--cards-border)' }}
                    >
                      {c.reveal}
                    </div>
                  )}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/55 mb-1">{c.label}</p>
              <p className="text-[12px] leading-relaxed">{c.tooltip}</p>
              <p className="text-[10px] text-white/40 mt-2">Click to expand the trend.</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
