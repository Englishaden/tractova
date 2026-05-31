import { useEffect, useState, useMemo } from 'react'
import { getPolicyImpactEvents } from '../../lib/programData'

// PolicyTimeline — Policy section. A CLICK-STEPPED horizontal milestone rail of
// curated regulatory events (policy_impact_events), oldest → newest, colored by
// impact severity. No scrollbars: a fixed page of nodes fits the width and
// prev/next steps through them; clicking a node opens an OVERLAY detail card
// that floats above the section (no layout push, no scroll-to-read).
//
// Data honesty: publish-gated events only (admin-curated; AI never sets the
// $-impact fields unverified). Honest sparse state when < 3 dated events.

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

export default function PolicyTimeline() {
  const [events, setEvents] = useState(null)
  const [page, setPage] = useState(0)
  const [activeId, setActiveId] = useState(null)

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
  const activeEvent = activeId ? dated.find((e) => e.id === activeId) : null

  // Escape closes the overlay detail.
  useEffect(() => {
    if (!activeEvent) return
    const onKey = (e) => { if (e.key === 'Escape') setActiveId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeEvent])

  if (events === null) {
    return <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: 170 }} />
  }

  return (
    <div className="relative rounded-md overflow-hidden" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      <header className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>Policy Timeline</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {dated.length} milestone{dated.length === 1 ? '' : 's'}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}
                aria-label="Earlier milestones"
                className="font-mono text-[11px] px-1.5 py-0.5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.05]"
                style={{ color: 'var(--link, #5EEAD4)', border: '1px solid var(--cards-border)' }}>←</button>
              <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-label)' }}>{safePage + 1}/{pageCount}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                aria-label="Later milestones"
                className="font-mono text-[11px] px-1.5 py-0.5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.05]"
                style={{ color: 'var(--link, #5EEAD4)', border: '1px solid var(--cards-border)' }}>→</button>
            </div>
          )}
        </div>
      </header>

      {dated.length < 3 ? (
        <p className="px-4 py-8 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Policy-milestone tracking accruing — {dated.length} dated event{dated.length === 1 ? '' : 's'} so far.
        </p>
      ) : (
        <div className="relative px-4 pt-5 pb-4">
          {/* baseline rule through the node dots */}
          <div className="absolute left-4 right-4" style={{ top: 26, height: 1, background: 'var(--cards-border)' }} aria-hidden="true" />
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${pageNodes.length}, minmax(0, 1fr))` }}>
            {pageNodes.map((ev) => {
              const sev = sevOf(ev)
              const isActive = ev.id === activeId
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setActiveId(isActive ? null : ev.id)}
                  aria-label={`${ev.eventName} — ${ev.state}`}
                  className="group relative text-center outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--link,#5EEAD4)] rounded"
                >
                  <div className="flex justify-center" style={{ height: 12 }}>
                    <span
                      className="relative z-10 rounded-full transition-transform group-hover:scale-125"
                      style={{ width: isActive ? 12 : 9, height: isActive ? 12 : 9, background: sev.color, boxShadow: `0 0 6px ${sev.color}`, border: '2px solid var(--cards-bg)' }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.effectiveDate)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug font-medium line-clamp-2 transition-colors group-hover:text-[var(--link)]" style={{ color: 'var(--text-primary)' }}>
                    {ev.eventName}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px]" style={{ color: sev.color }}>{ev.state}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <footer className="px-4 py-2 border-t" style={{ borderColor: 'var(--cards-border)' }}>
        <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
          Source: Tractova policy-impact tracker (admin-curated from state PUC / legislative filings). Node color = assessed impact severity. Click a node for detail.
        </p>
      </footer>

      {/* Overlay detail — floats above the section, no layout push / scroll */}
      {activeEvent && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(7,12,20,0.78)', backdropFilter: 'blur(2px)' }}
          onClick={() => setActiveId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-[440px] rounded-md p-4"
            style={{ background: 'var(--bg-surface, #182336)', border: `1px solid ${sevOf(activeEvent).color}55`, boxShadow: '0 12px 40px -10px rgba(0,0,0,0.7)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sevOf(activeEvent).color, boxShadow: `0 0 6px ${sevOf(activeEvent).color}` }} />
                <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: sevOf(activeEvent).color }}>
                  {activeEvent.state} · {sevOf(activeEvent).label} impact · {fmtDate(activeEvent.effectiveDate)}
                </span>
              </div>
              <button type="button" onClick={() => setActiveId(null)} aria-label="Close"
                className="shrink-0 text-[14px] leading-none px-1 rounded hover:bg-white/[0.06]" style={{ color: 'var(--text-muted)' }}>×</button>
            </div>
            <p className="text-[13px] font-semibold leading-snug mb-1.5" style={{ color: 'var(--text-primary)' }}>{activeEvent.eventName}</p>
            {activeEvent.eventType && (
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--text-muted)' }}>{activeEvent.eventType}</p>
            )}
            {activeEvent.summary && (
              <p className="text-[12px] leading-relaxed mb-2" style={{ color: 'var(--text-secondary, #C7D0DE)' }}>{activeEvent.summary}</p>
            )}
            {activeEvent.sourceUrl && (
              <a href={activeEvent.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
                Source →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
