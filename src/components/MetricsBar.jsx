import { useState, useEffect } from 'react'
import { getDashboardMetrics, getDashboardMetricsHistory } from '../lib/programData'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import CountUp from './ui/CountUp'
import KPISparkline from './charts/KPISparkline'

// MetricsBar — Dashboard revamp v2.
//
// Replaces the previous 5× 196px modal-opening cards with 5× ~120px cards
// in the disclosure-metric pattern (Defillama-derived; see
// research/2026-05-27-defillama-teardown.md §Layout & Interaction
// Patterns #1). Each card carries an area-chart sparkline (8-week trend).
// Click a card → expands inline to a bigger sparkline with axis labels.
// No more modals.
//
// Data-honesty: 4 of 5 cards ship with REAL derived history (csCoverage,
// pipelineLoad, avgCapacity, policyPulse) from getDashboardMetricsHistory().
// The 5th (IX Headroom) has no history source yet and renders without a
// sparkline + an honest "Trend tracking coming online" footer chip. We
// don't fake the trend with random-walk noise (data-honesty memory).

const CARD_BG = 'var(--cards-bg, #131C2C)'

// ── Icons (kept lean — decorative, not the focal point of the card) ───────
function IconMap()        { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>) }
function IconZap()        { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>) }
function IconBell()       { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>) }
function IconGauge()      { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10"/><path d="M12 6v6l4 2"/></svg>) }
function IconTrendingUp() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>) }

// Loading shimmer — 5 cards matching the new short shape.
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

export default function MetricsBar({ previewMode = false }) {
  // previewMode kept in the signature for API compatibility with the Dashboard
  // call site, but the new MetricsBar has no preview-specific behavior — the
  // breakdown modals (which previously rendered the preview gate) are retired.
  void previewMode

  const [expandedKey, setExpandedKey] = useState(null)
  const [liveMetrics, setLiveMetrics] = useState(null)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    getDashboardMetrics().then(setLiveMetrics).catch((e) => console.warn('[MetricsBar] live metrics failed:', e?.message))
    getDashboardMetricsHistory({ weeks: 8 })
      .then(setHistory)
      .catch((e) => console.warn('[MetricsBar] history failed:', e?.message))
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
    },
    {
      key: 'ixCapacity',
      label: 'IX Headroom',
      value: m.utilitiesWithIXHeadroom,
      rawValue: liveMetrics?.utilitiesWithIXHeadroom,
      sub: 'open queue capacity',
      icon: <IconZap />,
      series: history?.ixHeadroom, // null — graceful no-sparkline
      sparkColor: '#FBBF24',
      tooltip: 'Utilities estimated to have meaningful interconnection queue capacity for ≤5 MW projects.',
      noTrendNote: 'Weekly trend tracking coming online',
    },
    {
      key: 'policyAlerts',
      label: 'Policy Pulse',
      value: m.policyAlertsThisWeek,
      rawValue: liveMetrics?.policyAlertsThisWeek,
      sub: 'this week · all pillars',
      icon: <IconBell />,
      series: history?.policyPulse || [],
      sparkColor: '#F87171',
      tooltip: 'Policy + market signals published in the last 7 days across all pillars.',
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
    },
  ]

  // Until live metrics resolve, show shimmer. History can still be loading
  // when live metrics land — that's fine, the sparkline slot renders empty
  // until it arrives. Live numbers don't wait on history.
  if (!liveMetrics) return <MetricsSkeleton />

  const handleToggle = (key) => {
    setExpandedKey((curr) => (curr === key ? null : key))
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
      {CARDS.map((c) => {
        const expanded = expandedKey === c.key
        const hasSeries = Array.isArray(c.series) && c.series.length > 0
        return (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleToggle(c.key)}
                className="group relative overflow-hidden rounded-md text-left transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${expanded ? 'var(--hairline-teal, rgba(20,184,166,0.45))' : 'var(--cards-border, #1F2A3D)'}`,
                  minHeight: expanded ? '200px' : '94px',
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

                  {/* Sparkline (compact mode by default, full mode when expanded) */}
                  <div className="mt-auto pt-1">
                    {hasSeries ? (
                      <KPISparkline
                        data={c.series}
                        color={c.sparkColor}
                        height={expanded ? 120 : 28}
                        compact={!expanded}
                        ariaLabel={`${c.label} 8-week trend`}
                      />
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

                  {/* Expanded footer caption */}
                  {expanded && (
                    <p className="text-[10px] mt-1 leading-tight" style={{ color: 'var(--text-label, #98A4B6)' }}>
                      8-week trailing · refreshed weekly
                    </p>
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
