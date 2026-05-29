import { useMemo } from 'react'

// StateProgramGrid — Markets & Policy tab, section 1.
// Clickable cards for every state with an active / limited / pending CS
// program (csStatus !== 'none'), grouped by status and sorted by
// feasibility score within each group. Each card carries the three
// vital signs from the spec: a radial score gauge, remaining authorized
// capacity (MW), and program runway (months + urgency). Clicking a card
// opens the canonical StateDetailPanel via onSelectState.
//
// Data: getStatePrograms() (passed down from MarketsPolicyTab). Every
// field shown is read straight off the normalized row — no synthesis.

const STATUS_META = {
  active:  { label: 'Active',  dot: '#14B8A6', chip: 'bg-[rgba(20,184,166,0.15)] text-[#5EEAD4] border-[rgba(20,184,166,0.35)]' },
  limited: { label: 'Limited', dot: '#FBBF24', chip: 'bg-[rgba(251,191,36,0.12)] text-[#FBBF24] border-[rgba(251,191,36,0.32)]' },
  pending: { label: 'Pending', dot: '#FB923C', chip: 'bg-[rgba(251,146,60,0.10)] text-[#FB923C] border-[rgba(251,146,60,0.28)]' },
}

const STATUS_ORDER = ['active', 'limited', 'pending']

const RUNWAY_META = {
  strong:   { label: 'runway',   color: '#5EEAD4' },
  moderate: { label: 'runway',   color: '#2DD4BF' },
  watch:    { label: 'watch',    color: '#FBBF24' },
  urgent:   { label: 'act now',  color: '#F87171' },
}

// Score → choropleth-ramp color (matches StateDetailPanel ScoreBar).
function scoreColor(score) {
  if (score >= 75) return '#0F766E'
  if (score >= 60) return '#14B8A6'
  if (score >= 45) return '#2DD4BF'
  if (score >= 25) return '#99F6E4'
  return '#CCFBF1'
}

// Compact radial gauge — 44px SVG arc, 270° sweep, score number centered.
function RadialScoreGauge({ score = 0 }) {
  const pct = Math.max(0, Math.min(100, score))
  const r = 18
  const circumference = 2 * Math.PI * r
  // 270° sweep (3/4 of the circle), starting at bottom-left.
  const sweep = 0.75
  const dash = circumference * sweep
  const filled = dash * (pct / 100)
  const color = scoreColor(pct)
  return (
    <div className="relative shrink-0" style={{ width: 46, height: 46 }}>
      <svg width="46" height="46" viewBox="0 0 46 46" style={{ transform: 'rotate(135deg)' }}>
        <circle
          cx="23" cy="23" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <circle
          cx="23" cy="23" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 700ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: 14, color }}>{pct}</span>
      </div>
    </div>
  )
}

function StateCard({ state, onSelect }) {
  const meta = STATUS_META[state.csStatus] || STATUS_META.pending
  const runway = state.runway
  const runMeta = runway ? RUNWAY_META[runway.urgency] : null

  return (
    <button
      type="button"
      onClick={() => onSelect?.(state.id)}
      className="group relative text-left rounded-md p-3 transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--cards-border)' }}
      data-state={state.id}
    >
      {/* Hover teal hairline */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }}
      />

      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{state.id}</span>
            <span className="text-[11px] truncate" style={{ color: 'var(--text-label)' }}>{state.name}</span>
          </div>
          {state.csProgram && (
            <p className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }} title={state.csProgram}>{state.csProgram}</p>
          )}
        </div>
        <span className={`shrink-0 text-[9px] font-mono uppercase tracking-[0.12em] font-bold px-1.5 py-0.5 rounded-full border ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <RadialScoreGauge score={state.feasibilityScore} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Capacity</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {state.capacityMW > 0 ? `${state.capacityMW.toLocaleString()} MW` : '—'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Runway</span>
            {runway ? (
              <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: runMeta.color }}>
                ~{runway.months}mo · {runMeta.label}
              </span>
            ) : (
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-disabled)' }}>n/a</span>
            )}
          </div>
        </div>
      </div>

      {/* Hover-reveal open hint */}
      <span className="absolute bottom-2 right-3 text-[9px] font-mono uppercase tracking-[0.16em] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--link, #5EEAD4)' }}>
        open →
      </span>
    </button>
  )
}

export default function StateProgramGrid({ programs = [], onSelectState }) {
  const groups = useMemo(() => {
    const active = programs.filter((s) => s.csStatus && s.csStatus !== 'none')
    const byStatus = {}
    for (const st of STATUS_ORDER) {
      byStatus[st] = active
        .filter((s) => s.csStatus === st)
        .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
    }
    return byStatus
  }, [programs])

  const totalCount = STATUS_ORDER.reduce((n, st) => n + groups[st].length, 0)

  return (
    <section
      className="relative rounded-md p-4 overflow-hidden"
      style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
    >
      <div className="h-px absolute top-0 left-0 right-0" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
            State Program Grid
          </h2>
        </div>
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {totalCount} programs · click for detail
        </span>
      </header>

      {totalCount === 0 ? (
        <p className="text-[11px] py-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading state programs…</p>
      ) : (
        <div className="space-y-4">
          {STATUS_ORDER.map((st) => {
            const list = groups[st]
            if (list.length === 0) return null
            const meta = STATUS_META[st]
            return (
              <div key={st}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-bold" style={{ color: 'var(--text-label)' }}>
                    {meta.label} · {list.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {list.map((state) => (
                    <StateCard key={state.id} state={state} onSelect={onSelectState} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
