import { useState } from 'react'
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
// Row click toggles inline expansion of the existing ProjectCard. This
// keeps Phase 2A low-blast-radius: we don't refactor card content; we
// just provide a denser index above it.

// Score color thresholds — mirror ProjectCard.jsx so a row and its
// expanded card always agree on hue.
function colorForScore(score) {
  if (score == null) return '#9CA3AF'
  if (score >= 70)   return '#0F766E'  // teal
  if (score >= 50)   return '#D97706'  // amber
  return '#DC2626'                      // red
}

// Static (non-animated) score arc. 28px footprint, no motion springs
// per row — a 50-row table mounting 50 simultaneous motion components
// is a perf trap. Visually mirrors MiniArcGauge but pre-renders the arc.
function TableScoreArc({ score, size = 28 }) {
  const color = colorForScore(score)
  const dash = `${Math.max(0, Math.min(100, score ?? 0))}, 100`
  return (
    <div className="shrink-0 relative" style={{ width: size, height: size }}>
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
        {score == null ? '—' : score}
      </span>
    </div>
  )
}

// Alerts dot — amber if any warning, muted-gray for info-only, hidden
// otherwise. Title attribute carries the count for hover discovery.
function AlertDot({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <span className="text-[10px] text-gray-300 font-mono">—</span>
  }
  const warningCount = alerts.filter(a => a.level === 'warning').length
  const color = warningCount > 0 ? '#D97706' : '#94A3B8'
  return (
    <span
      className="inline-flex items-center gap-1 font-mono tabular-nums text-[10px] font-semibold"
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
// `select` is a tight checkbox column; `score` a 28px arc; `name` flexes;
// the rest are fixed-width mono cells for tabular alignment.
const COLS = 'minmax(28px, auto) 36px minmax(0, 1fr) 110px 56px 110px 130px 44px 60px'

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
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E5E7EB', background: 'white' }}>
      {/* Sticky header. top-14 clears the fixed Nav (h-14). */}
      <div
        className="sticky top-14 z-10 grid items-center gap-3 px-3 py-2 border-b eyebrow-mono"
        style={{
          gridTemplateColumns: COLS,
          background: '#0F1A2E',
          color: '#94A3B8',
          borderColor: '#E5E7EB',
        }}
      >
        <span aria-hidden="true" />
        <span style={{ color: '#5EEAD4' }}>Score</span>
        <span style={{ color: '#5EEAD4' }}>Project</span>
        <span style={{ color: '#5EEAD4' }}>Locale</span>
        <span style={{ color: '#5EEAD4' }} className="text-right">MW</span>
        <span style={{ color: '#5EEAD4' }}>Tech</span>
        <span style={{ color: '#5EEAD4' }}>Stage</span>
        <span style={{ color: '#5EEAD4' }}>Alerts</span>
        <span style={{ color: '#5EEAD4' }} className="text-right">Saved</span>
      </div>

      <ul role="list">
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
                className="w-full grid items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{
                  gridTemplateColumns: COLS,
                  background: isOpen ? 'rgba(20,184,166,0.04)' : isSelected ? 'rgba(15,118,110,0.05)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(15,26,46,0.025)' }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = isSelected ? 'rgba(15,118,110,0.05)' : 'transparent' }}
                aria-expanded={isOpen}
                aria-label={`${p.name} — ${isOpen ? 'collapse' : 'expand'} details`}
              >
                {/* Bulk-select checkbox. stopPropagation so the row click
                    doesn't toggle expansion when the user clicks the
                    checkbox itself. */}
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
                    <p className="text-[10px] text-gray-500 truncate">{p.csProgram}</p>
                  )}
                </div>

                <span className="text-[11px] text-gray-700 font-mono tabular-nums truncate">
                  {p.county ? `${p.county}, ${p.state}` : p.state || '—'}
                </span>

                <span className="text-[12px] font-mono tabular-nums font-semibold text-ink text-right">
                  {p.mw ?? '—'}
                </span>

                <span className="text-[11px] text-gray-700 truncate">{p.technology || '—'}</span>

                <span className="text-[11px] font-medium text-ink truncate">{p.stage || '—'}</span>

                <AlertDot alerts={alerts} />

                <span className="text-[10px] font-mono tabular-nums text-gray-500 text-right">
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
