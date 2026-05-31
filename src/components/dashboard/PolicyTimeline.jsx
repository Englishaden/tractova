import { useEffect, useState, useMemo } from 'react'
import { getPolicyImpactEvents } from '../../lib/programData'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip'
import AnimatedIcon from '../ui/AnimatedIcon'

// PolicyTimeline — Policy section. A CLICK-STEPPED horizontal milestone rail of
// curated regulatory events (policy_impact_events), oldest → newest, colored by
// impact severity. No scrollbars: a page of nodes fits the width and the arrows
// step through. HOVER a node for the detail (site-standard Tooltip, floats above
// content); CLICK opens the source. Publish-gated data; sparse fallback < 3.

const SEVERITY = {
  severe: { color: '#F87171', label: 'Severe' },
  medium: { color: '#FBBF24', label: 'Medium' },
  small:  { color: '#5EEAD4', label: 'Small' },
}
const NEUTRAL = { color: '#64748B', label: 'Tracked' }
const sevOf = (e) => SEVERITY[e?.impactSeverity] || NEUTRAL

const PAGE_SIZE = 6

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Bigger, clearer stepper arrow — disabled state dims but never shows the
// not-allowed (stop-sign) cursor.
function StepArrow({ dir, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Earlier milestones' : 'Later milestones'}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-all disabled:opacity-25 disabled:cursor-default hover:bg-[rgba(20,184,166,0.12)]"
      style={{ color: 'var(--link, #5EEAD4)', border: '1px solid var(--hairline-teal, rgba(20,184,166,0.30))' }}
    >
      <AnimatedIcon name={dir === 'left' ? 'ChevronLeft' : 'ChevronRight'} animation="nudge" size={16} strokeWidth={2.5} trigger={disabled ? 'none' : 'hover'} />
    </button>
  )
}

export default function PolicyTimeline() {
  const [events, setEvents] = useState(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPolicyImpactEvents()
      .then((rows) => { if (!cancelled) setEvents(rows || []) })
      .catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [])

  const dated = useMemo(
    () => (events || [])
      .filter((e) => e.effectiveDate)
      .sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate))),
    [events],
  )

  const pageCount = Math.max(1, Math.ceil(dated.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageNodes = dated.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  if (events === null) {
    return <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: 170 }} />
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      <header className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>Policy Timeline</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {dated.length} milestone{dated.length === 1 ? '' : 's'}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1.5">
              <StepArrow dir="left" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} />
              <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-label)' }}>{safePage + 1}/{pageCount}</span>
              <StepArrow dir="right" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} />
            </div>
          )}
        </div>
      </header>

      {dated.length < 3 ? (
        <p className="px-4 py-8 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Policy-milestone tracking accruing — {dated.length} dated event{dated.length === 1 ? '' : 's'} so far.
        </p>
      ) : (
        <TooltipProvider delayDuration={120}>
          <div className="relative px-4 pt-5 pb-4">
            <div className="absolute left-4 right-4" style={{ top: 26, height: 1, background: 'var(--cards-border)' }} aria-hidden="true" />
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${pageNodes.length}, minmax(0, 1fr))` }}>
              {pageNodes.map((ev) => {
                const sev = sevOf(ev)
                return (
                  <Tooltip key={ev.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => ev.sourceUrl && window.open(ev.sourceUrl, '_blank', 'noopener,noreferrer')}
                        aria-label={`${ev.eventName} — ${ev.state}`}
                        className="group relative text-center outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--link,#5EEAD4)] rounded cursor-pointer"
                      >
                        <div className="flex justify-center" style={{ height: 12 }}>
                          <span
                            className="relative z-10 w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-150"
                            style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}`, border: '2px solid var(--cards-bg)' }}
                          />
                        </div>
                        <p className="mt-2 font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.effectiveDate)}</p>
                        <p className="mt-0.5 text-[11px] leading-snug font-medium line-clamp-2 transition-colors group-hover:text-[var(--link)]" style={{ color: 'var(--text-primary)' }}>
                          {ev.eventName}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px]" style={{ color: sev.color }}>{ev.state}</p>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[320px]">
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] mb-1" style={{ color: sev.color }}>
                        {ev.state} · {sev.label} impact · {fmtDate(ev.effectiveDate)}{ev.eventType ? ` · ${ev.eventType}` : ''}
                      </p>
                      <p className="text-[12px] font-semibold leading-snug mb-1">{ev.eventName}</p>
                      {ev.summary && <p className="text-[11px] leading-relaxed text-white/80">{ev.summary.slice(0, 240)}{ev.summary.length > 240 ? '…' : ''}</p>}
                      {ev.sourceUrl && <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--link, #5EEAD4)' }}>Click → source ↗</p>}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </TooltipProvider>
      )}

      <footer className="px-4 py-2 border-t" style={{ borderColor: 'var(--cards-border)' }}>
        <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
          Source: Tractova policy-impact tracker (admin-curated from state PUC / legislative filings). Node color = assessed impact severity. Hover for detail · click for source.
        </p>
      </footer>
    </div>
  )
}
