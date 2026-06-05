import { useMemo } from 'react'
import { getAlerts } from '../../lib/alertHelpers'

// ── LibraryStatusRibbon — one thin glanceable line on the Pipeline view ──────
// Keeps the portfolio numbers (projects · MW · alerts · due) in view without the
// heavy intelligence drawer; the deep analytics live one click away in the
// Intelligence tab. Pass 6 — replaces the old always-open PortfolioIntelligence
// summary header in the main scroll.

export default function LibraryStatusRibbon({ projects, stateProgramMap, countyDataMap, onOpenIntelligence }) {
  const { totalMw, alertCount, dueCount, hasOverdue } = useMemo(() => {
    const now = Date.now()
    let mw = 0, alerts = 0, due = 0, overdue = false
    for (const p of projects) {
      mw += parseFloat(p.mw) || 0
      alerts += getAlerts(p, stateProgramMap, countyDataMap).length
      if (p.followUpAt) {
        const days = (new Date(p.followUpAt).getTime() - now) / 86400000
        if (days <= 7) { due++; if (days < 0) overdue = true }
      }
    }
    return { totalMw: mw, alertCount: alerts, dueCount: due, hasOverdue: overdue }
  }, [projects, stateProgramMap, countyDataMap])

  if (projects.length === 0) return null

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold shrink-0" style={{ color: '#0F766E' }}>◈ Portfolio</span>
      <span className="text-xs font-medium text-ink font-mono tabular-nums">
        {projects.length} project{projects.length !== 1 ? 's' : ''}
        <span className="mx-1.5 text-gray-300">·</span>
        {totalMw.toFixed(1)} MW
        <span className="mx-1.5 text-gray-300">·</span>
        <span style={{ color: alertCount > 0 ? '#B45309' : undefined }}>{alertCount} alert{alertCount !== 1 ? 's' : ''}</span>
        {dueCount > 0 && (
          <>
            <span className="mx-1.5 text-gray-300">·</span>
            <span style={{ color: hasOverdue ? '#DC2626' : '#0F766E' }}>{dueCount} due</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onOpenIntelligence}
        className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold transition-colors shrink-0"
        style={{ color: '#0F766E' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#0A1828' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#0F766E' }}
      >
        Portfolio intelligence
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  )
}
