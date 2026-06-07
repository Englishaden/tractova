import { useMemo, useState } from 'react'
import { PIPELINE_STAGES, PIPELINE_SHORT } from './PipelineProgress'
import StagePicker from './StagePicker'
import MiniArcGauge from './MiniArcGauge'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import { getAlerts } from '../../lib/alertHelpers'

// ── PipelineBoard — kanban deal board (Pass 5, Wave 3) ───────────────────────
// A 4th Library layout: one column per pipeline stage, drag a deal card across
// to advance it. The strongest "deal-tracker" upgrade and it reuses the data
// that already drives the Pipeline Distribution bar + StagePicker. Native HTML5
// drag-and-drop keeps it dependency-free; every card also carries a StagePicker
// (Radix Popover) so keyboard / touch users have a non-drag path (a11y — touch
// DnD is poor, so the board is desktop-only, consistent with Table/Map).
//
// Drop → onStageChange(id, newStage), the same handler the StagePicker and the
// distribution bar already use (persists + logs the score_change/audit event).

const STAGE_COLORS = ['#F0FDFA', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0F766E', '#0F1A2E']
const NONE = '__none__'  // pseudo-stage column for projects with no stage set

function accentFor(score) {
  if (score == null) return '#D1D5DB'
  if (score >= 70) return '#0F766E'
  if (score >= 50) return '#D97706'
  return '#DC2626'
}

export default function PipelineBoard({ projects, stateProgramMap, countyDataMap, onStageChange, onCardClick }) {
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)

  const scoreOf = (p) => {
    const sp = stateProgramMap[p.state]
    if (!sp) return null
    const cd = countyDataMap[`${p.state}::${p.county}`] || null
    return safeScore(computeSubScores(sp, cd, p.stage, p.technology))
  }

  // Group into stage buckets; collect anything stage-less / off-taxonomy into NONE.
  const { buckets, hasUnstaged } = useMemo(() => {
    const b = { [NONE]: [], ...Object.fromEntries(PIPELINE_STAGES.map(s => [s, []])) }
    for (const p of projects) {
      if (p.stage && b[p.stage]) b[p.stage].push(p)
      else b[NONE].push(p)
    }
    return { buckets: b, hasUnstaged: b[NONE].length > 0 }
  }, [projects])

  // Only render the NONE column when it has cards (so the common case is a
  // clean 7-column board).
  const columns = hasUnstaged ? [NONE, ...PIPELINE_STAGES] : PIPELINE_STAGES

  const onDrop = (stage) => {
    const id = dragId
    setOverStage(null); setDragId(null)
    if (!id) return
    onStageChange?.(id, stage === NONE ? '' : stage)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1" role="list" aria-label="Pipeline board">
      {columns.map((stage) => {
        const items = buckets[stage] || []
        const idx = PIPELINE_STAGES.indexOf(stage)
        const label = stage === NONE ? 'No stage' : PIPELINE_SHORT[idx]
        const color = stage === NONE ? '#9CA3AF' : STAGE_COLORS[idx]
        const mw = items.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0)
        const isOver = overStage === stage
        return (
          <div
            key={stage}
            role="listitem"
            onDragOver={(e) => { e.preventDefault(); if (overStage !== stage) setOverStage(stage) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverStage(s => (s === stage ? null : s)) }}
            onDrop={(e) => { e.preventDefault(); onDrop(stage) }}
            className="w-64 shrink-0 rounded-xl flex flex-col transition-colors"
            style={{
              background: isOver ? 'rgba(20,184,166,0.06)' : '#F9FAFB',
              border: isOver ? '1px solid rgba(20,184,166,0.45)' : '1px solid #E5E7EB',
            }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ['#F0FDFA', '#99F6E4'].includes(color) ? '#0F766E' : color }} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink truncate">{label}</span>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-gray-400 shrink-0">
                {items.length}{mw > 0 ? ` · ${mw.toFixed(0)}MW` : ''}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 min-h-[80px]">
              {items.length === 0 ? (
                <p className="text-[10px] text-gray-300 text-center py-6 select-none">Drop a deal here</p>
              ) : (
                items.map((p) => {
                  const score = scoreOf(p)
                  const alerts = getAlerts(p, stateProgramMap, countyDataMap)
                  const hasUrgent = alerts.some(a => a.level === 'urgent')
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null) }}
                      onClick={() => onCardClick?.(p)}
                      className={`rounded-lg bg-white border px-2.5 py-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${dragId === p.id ? 'opacity-40' : ''}`}
                      style={{ borderColor: hasUrgent ? 'rgba(220,38,38,0.35)' : '#E5E7EB', borderLeft: `3px solid ${accentFor(score)}` }}
                    >
                      <div className="flex items-start gap-2">
                        <MiniArcGauge score={score} color={accentFor(score)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-ink leading-snug line-clamp-2" style={{ fontFamily: 'var(--font-serif, serif)' }}>{p.name}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">
                            {p.county} County · {parseFloat(p.mw) || 0} MW
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {alerts.length > 0 && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap leading-none text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={hasUrgent ? { background: '#FEE2E2', color: '#991B1B' } : { background: '#FEF3C7', color: '#92400E' }}>
                                {alerts.length} alert{alerts.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {(p.tags || []).slice(0, 2).map(t => (
                              <span key={t} className="inline-block whitespace-nowrap leading-none text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[80px]" style={{ background: 'rgba(20,184,166,0.08)', color: '#0F766E' }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        {/* Keyboard / touch path — change stage without dragging. */}
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <StagePicker stage={p.stage} projectId={p.id} onChange={(s) => onStageChange?.(p.id, s)} compact />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
