import { lazy, Suspense, useMemo } from 'react'
import CollapsibleSection from '../CollapsibleSection'
import LensSectionRail from '../lens/LensSectionRail'
import PortfolioAnalytics from './PortfolioAnalytics'
import { useLensReveal } from '../../lib/useLensReveal'
import { PIPELINE_STAGES, PIPELINE_SHORT } from './PipelineProgress'

// LibraryMap is heavy (react-simple-maps + topojson + centroids); lazy-split so
// it only loads when §03 Geography is opened.
const LibraryMap = lazy(() => import('./LibraryMap.jsx'))

// ── LibraryIntelligence — the Intelligence sub-tab (Pass 6) ──────────────────
// Replaces the old all-in-one PortfolioIntelligence drawer. Gives the portfolio
// analytics their own roomy tab, organised Lens-style: numbered collapsible
// §-sections + a right-gutter scrollspy rail + scroll-reveal, with generous
// spacing so it breathes. Reuses the Lens primitives (CollapsibleSection /
// LensSectionRail / useLensReveal) and the existing PortfolioAnalytics body.
// Pipeline-funnel and Map sections drill THROUGH to the Pipeline tab (filtered).

const STAGE_COLORS = ['#F0FDFA', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0F766E', '#0F1A2E']

const SECTIONS = [
  { id: 'lib-intel-1', label: 'Pipeline' },
  { id: 'lib-intel-2', label: 'Analytics' },
  { id: 'lib-intel-3', label: 'Map' },
]

export default function LibraryIntelligence({ projects, stateProgramMap, countyDataMap, onStageDrill, onStateDrill }) {
  useLensReveal(projects.length > 0)

  const stageCounts = useMemo(() => {
    const now = Date.now()
    return PIPELINE_STAGES.map((s, i) => {
      const matching = projects.filter(p => p.stage === s)
      const stale = matching.some(p => p.savedAt && (now - new Date(p.savedAt).getTime()) / 86400000 >= 180)
      return {
        stage: s,
        count: matching.length,
        mw: matching.reduce((sum, p) => sum + (parseFloat(p.mw) || 0), 0),
        color: STAGE_COLORS[i],
        stale,
      }
    })
  }, [projects])

  const due = useMemo(() => {
    const now = Date.now()
    return projects
      .filter(p => p.followUpAt)
      .map(p => ({ p, ms: new Date(p.followUpAt).getTime() }))
      .filter(({ ms }) => (ms - now) / 86400000 <= 7)
      .sort((a, b) => a.ms - b.ms)
  }, [projects])

  if (projects.length === 0) return null

  return (
    <div className="relative pb-8">
      <LensSectionRail sections={SECTIONS} />

      {/* §01 — Pipeline distribution + what's due (click → Pipeline filtered) */}
      <CollapsibleSection index={1} id="lib-intel-1" label="Pipeline" sublabel="stages · what's due" defaultOpen keepMounted>
        <div className="lens-reveal flex flex-col gap-3">
          <div className="rounded-xl px-4 py-3.5 bg-white border border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Pipeline Distribution</p>
            {(() => {
              const active = stageCounts.filter(s => s.count > 0)
              const total = active.reduce((s, c) => s + c.count, 0) || 1
              return (
                <>
                  <div className="flex w-full h-8 rounded-lg overflow-hidden" style={{ background: '#F1F5F9' }}>
                    {active.map(({ stage, count, mw, color, stale }) => {
                      const pct = (count / total) * 100
                      const light = ['#F0FDFA', '#99F6E4', '#5EEAD4'].includes(color)
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => onStageDrill?.(stage)}
                          title={`${stage} · ${count} project${count > 1 ? 's' : ''} · ${mw.toFixed(1)} MW — open in Pipeline`}
                          className="relative h-full flex items-center justify-center transition-all hover:brightness-95"
                          style={{ width: `${pct}%`, background: color }}
                        >
                          {pct > 7 && <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: light ? '#0A1828' : '#FFFFFF' }}>{count}</span>}
                          {stale && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B', boxShadow: '0 0 0 1.5px #FFFFFF' }} />}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2.5">
                    {active.map(({ stage, count, color }) => {
                      const swatch = ['#F0FDFA', '#99F6E4'].includes(color) ? '#5EEAD4' : color
                      return (
                        <button key={stage + 'l'} type="button" onClick={() => onStageDrill?.(stage)} className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: swatch }} />
                          <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#5A6B7A' }}>
                            {PIPELINE_SHORT[PIPELINE_STAGES.indexOf(stage)]} · {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>

          {due.length > 0 && (
            <div className="rounded-xl px-4 py-3 bg-white border border-gray-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Due This Week</p>
              <div className="flex flex-col gap-1.5">
                {due.map(({ p, ms }) => {
                  const days = Math.round((ms - Date.now()) / 86400000)
                  const overdue = ms < Date.now()
                  const rel = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-ink truncate min-w-0">{p.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {p.followUpNote && <span className="text-gray-400 truncate max-w-[160px] hidden sm:inline">{p.followUpNote}</span>}
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm" style={overdue ? { background: 'rgba(220,38,38,0.10)', color: '#DC2626' } : { background: 'rgba(15,118,110,0.10)', color: '#0F766E' }}>{rel}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* §02 — Health · risk · tech mix · AI insight */}
      <CollapsibleSection index={2} id="lib-intel-2" label="Analytics" sublabel="health · risk · mix · AI" defaultOpen>
        <div className="lens-reveal">
          <PortfolioAnalytics projects={projects} stateProgramMap={stateProgramMap} />
        </div>
      </CollapsibleSection>

      {/* §03 — Geographic map (collapsed; lazy-loads react-simple-maps on open).
          Click a state / pin → drill into the Pipeline tab filtered to it. */}
      <CollapsibleSection index={3} id="lib-intel-3" label="Map" sublabel="locations · click to drill">
        <div className="lens-reveal">
          <Suspense fallback={<div className="rounded-xl border border-gray-200 bg-paper h-[420px] animate-pulse" aria-label="Map loading" />}>
            <LibraryMap
              projects={projects}
              stateProgramMap={stateProgramMap}
              countyDataMap={countyDataMap}
              filterState=""
              onStateClick={(id, has) => { if (has) onStateDrill?.(id) }}
              onStateDoubleClick={(id, has) => { if (has) onStateDrill?.(id) }}
              onSwitchToTable={() => {}}
              onPinClick={(p) => onStateDrill?.(p.state)}
            />
          </Suspense>
        </div>
      </CollapsibleSection>
    </div>
  )
}
