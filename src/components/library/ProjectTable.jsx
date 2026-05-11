import { useEffect, useState } from 'react'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import { getAlerts } from '../../lib/alertHelpers'
import ProjectCard from '../ProjectCard.jsx'

// Phase 2A · TRACTOVA-UX-001 — Bloomberg-grid Table view for Library.
//
// CSS grid (not <table>) so a row's inline expansion can render the full
// ProjectCard without breaking column widths. Sticky header. Mono numerics
// across score / MW / saved-date so portfolio totals read as one column
// of data, Bloomberg-style. Single-dot alert affordance (amber if any
// warnings; muted if only info-level; nothing if clean).
//
// Row click toggles inline expansion of the full ProjectCard (passes
// defaultExpanded so the user gets one-click full detail — no two-step
// "row → banner → expand" friction).
//
// Layout notes:
// - The outer wrapper deliberately does NOT use `overflow-hidden`. Chrome
//   treats overflow-hidden ancestors as a clipping context that breaks
//   `position: sticky` against the viewport. Rounded corners are applied
//   to the header (rounded-t) and the rows-wrapper (rounded-b) instead.
// - The sticky header sits at `top-14` to clear the fixed Nav (h-14, 56px).

function colorForScore(score) {
  if (score == null) return '#9CA3AF'
  if (score >= 70)   return '#0F766E'  // teal
  if (score >= 50)   return '#D97706'  // amber
  return '#DC2626'                      // red
}

// Animated arc + count-up number, driven by a single requestAnimationFrame
// loop per row. Number and arc derive from the SAME `display` value so
// they stay in lockstep — never a frame where the arc is at 60% but the
// number reads 0. Cubic ease-out (1 − (1 − t)^3) matches the same curve
// the Phase 0 GaugeFill primitive + the Cards-view MiniArcGauge animate
// with (`[0.16, 1, 0.3, 1]` cubic-bezier). Lighter than motion springs
// — one setState per frame per row × 48 frames = ~2400 updates over the
// 800ms reveal, well within React 18's frame budget at 50 rows.
function TableScoreArc({ score, size = 28 }) {
  const color = colorForScore(score)
  const target = score == null ? 0 : Math.max(0, Math.min(100, score))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let raf
    let startTime = null
    const duration = 800
    const step = (now) => {
      if (startTime === null) startTime = now
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(target * eased)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  const dash = `${display}, 100`
  return (
    <div className="shrink-0 relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {score == null ? '—' : Math.round(display)}
      </span>
    </div>
  )
}

function AlertDot({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <span className="block text-[11px] text-gray-300 font-mono tabular-nums text-center">—</span>
  }
  const warningCount = alerts.filter(a => a.level === 'warning').length
  const color = warningCount > 0 ? '#D97706' : '#94A3B8'
  return (
    <span
      className="flex items-center justify-center gap-1 font-mono tabular-nums text-[11px] font-semibold"
      style={{ color }}
      title={alerts.map(a => a.label).join(' · ')}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {alerts.length}
    </span>
  )
}

function relativeDate(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 1)   return 'Today'
  if (days < 2)   return '1d'
  if (days < 30)  return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

// Column template — kept in one place so header + rows stay in lockstep.
// Wider Score (48) gives the arc breathing room. Wider MW (90) with the
// number padded inward so it doesn't crowd Tech. Tech (150) + Stage (160)
// fit the longest common values ("Community Solar", "NTP (Notice to
// Proceed)") without mid-word truncation.
const COLS = '32px 48px minmax(0, 1fr) 140px 90px 150px 160px 64px 72px'

// Reusable header cell — consistent typography for column titles.
function HeaderCell({ children, align = 'left' }) {
  return (
    <span
      className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] leading-none truncate"
      style={{ color: '#5EEAD4', textAlign: align }}
    >{children}</span>
  )
}

export default function ProjectTable({
  projects,
  stateProgramMap,
  countyDataMap,
  stateDeltaMap,
  scenariosMap,
  shareCountMap,
  selectedIds,
  onToggleSelect,
  onStageChange,
  onRequestRemove,
  onShareSuccess,
  onScenarioDelete,
}) {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="rounded-xl border" style={{ borderColor: '#E5E7EB' }}>
      {/* Sticky header. Lives OUTSIDE any overflow-hidden ancestor so
          position: sticky resolves against the viewport. Rounded-t-xl
          matches the outer card's rounded corners visually. */}
      <div
        className="sticky top-14 z-10 grid items-center gap-3 px-3 py-2.5 rounded-t-xl"
        style={{
          gridTemplateColumns: COLS,
          background: '#0F1A2E',
          borderBottom: '2px solid #14B8A6',
        }}
      >
        <span aria-hidden="true" />
        <HeaderCell align="center">Score</HeaderCell>
        <HeaderCell>Project</HeaderCell>
        <HeaderCell>Location</HeaderCell>
        <HeaderCell align="center">MW</HeaderCell>
        <HeaderCell>Tech</HeaderCell>
        <HeaderCell>Stage</HeaderCell>
        <HeaderCell align="center">Alerts</HeaderCell>
        <HeaderCell align="center">Saved</HeaderCell>
      </div>

      {/* Rows wrapper. overflow-hidden is safe here — sticky is its
          sibling, not its descendant — and it gives the bottom-left /
          bottom-right corners a clean rounded clip. */}
      <ul role="list" className="rounded-b-xl overflow-hidden">
        {projects.map((p) => {
          const sp = stateProgramMap[p.state]
          const cd = countyDataMap[`${p.state}::${p.county}`] || null
          const subs = sp ? computeSubScores(sp, cd, p.stage, p.technology) : null
          const score = subs ? safeScore(subs.offtake, subs.ix, subs.site) : null
          const alerts = sp ? getAlerts(p, stateProgramMap, countyDataMap) : []
          const isOpen = expandedId === p.id
          const isSelected = selectedIds?.has(p.id)
          return (
            <li key={p.id} className="border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : p.id)}
                className="w-full grid items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  background: isOpen ? 'rgba(20,184,166,0.06)' : isSelected ? 'rgba(15,118,110,0.05)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(15,26,46,0.025)' }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = isSelected ? 'rgba(15,118,110,0.05)' : 'transparent' }}
                aria-expanded={isOpen}
                aria-label={`${p.name} — ${isOpen ? 'collapse' : 'expand'} details`}
              >
                {/* Bulk-select checkbox. stopPropagation so a checkbox
                    click doesn't also toggle row expansion. */}
                <span
                  onClick={(e) => { e.stopPropagation(); onToggleSelect?.(p.id) }}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); onToggleSelect?.(p.id) } }}
                  role="checkbox"
                  aria-checked={!!isSelected}
                  tabIndex={0}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-sm cursor-pointer transition-colors"
                  style={{
                    border: `1.5px solid ${isSelected ? '#0F766E' : '#CBD5E1'}`,
                    background: isSelected ? '#0F766E' : 'white',
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>

                <TableScoreArc score={score} />

                <div className="min-w-0">
                  <p className="font-serif text-[13px] font-semibold text-ink leading-tight truncate">{p.name}</p>
                  {p.csProgram && (
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{p.csProgram}</p>
                  )}
                </div>

                <span className="text-[11px] text-gray-700 font-mono tabular-nums truncate">
                  {p.county ? `${p.county}, ${p.state}` : p.state || '—'}
                </span>

                <span className="text-[12px] font-mono tabular-nums font-semibold text-ink text-center">
                  {p.mw ?? '—'}
                </span>

                <span className="text-[11px] text-gray-700 truncate">{p.technology || '—'}</span>

                <span className="text-[11px] font-medium text-ink truncate">{p.stage || '—'}</span>

                <AlertDot alerts={alerts} />

                <span className="text-[11px] font-mono tabular-nums text-gray-500 text-center">
                  {relativeDate(p.savedAt)}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1" style={{ background: 'rgba(20,184,166,0.03)' }}>
                  <ProjectCard
                    project={p}
                    onRequestRemove={onRequestRemove}
                    onStageChange={onStageChange}
                    stateProgramMap={stateProgramMap}
                    countyDataMap={countyDataMap}
                    stateDelta={stateDeltaMap?.get?.(p.state) || null}
                    shareCount={shareCountMap?.[p.id] || 0}
                    onShareSuccess={() => onShareSuccess?.(p.id)}
                    selected={isSelected}
                    onToggleSelect={() => onToggleSelect?.(p.id)}
                    selectionActive={selectedIds && selectedIds.size > 0}
                    scenarios={scenariosMap?.[p.id] || []}
                    onScenarioDelete={(snapId) => onScenarioDelete?.(p.id, snapId)}
                    defaultExpanded
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {projects.length === 0 && (
        <p className="text-xs text-ink-muted text-center py-6">No projects match current filters.</p>
      )}
    </div>
  )
}
