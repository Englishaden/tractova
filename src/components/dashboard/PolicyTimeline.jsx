import { useEffect, useState, useMemo } from 'react'
import { getPolicyImpactEvents } from '../../lib/programData'

// PolicyTimeline — Policy section. A horizontal milestone rail of curated
// regulatory events (policy_impact_events), oldest → newest, colored by impact
// severity. Distinct from the Policy Feed (a chronological signal list) and
// from the Markets table/radar. Hover a node for the summary + source.
//
// Data honesty: admin-curated events only; honest sparse state when < 3.

const SEVERITY = {
  severe: { color: '#F87171', label: 'Severe' },
  medium: { color: '#FBBF24', label: 'Medium' },
  small:  { color: '#5EEAD4', label: 'Small' },
}
const NEUTRAL = { color: '#64748B', label: 'Tracked' }

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function PolicyTimeline() {
  const [events, setEvents] = useState(null)

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

  if (events === null) {
    return <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: 150 }} />
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}>
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />
      <header className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>Policy Timeline</h3>
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {dated.length} dated milestone{dated.length === 1 ? '' : 's'}
        </span>
      </header>

      {dated.length < 3 ? (
        <p className="px-4 py-8 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Policy-milestone tracking accruing — {dated.length} dated event{dated.length === 1 ? '' : 's'} so far.
        </p>
      ) : (
        <div className="overflow-x-auto thin-scrollbar px-4 pb-3">
          <div className="relative flex gap-2 min-w-max pt-5">
            {/* baseline rule running through the node dots */}
            <div className="absolute left-0 right-0" style={{ top: 26, height: 1, background: 'var(--cards-border)' }} aria-hidden="true" />
            {dated.map((ev) => {
              const sev = SEVERITY[ev.impactSeverity] || NEUTRAL
              return (
                <div key={ev.id} className="group relative w-[156px] shrink-0">
                  <div className="flex justify-center" style={{ height: 12 }}>
                    <span
                      className="relative z-10 w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125"
                      style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}`, border: '2px solid var(--cards-bg)' }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[9px] tabular-nums text-center" style={{ color: 'var(--text-muted)' }}>{fmtDate(ev.effectiveDate)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug font-medium line-clamp-2 text-center" style={{ color: 'var(--text-primary)' }}>
                    {ev.eventName}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-center" style={{ color: sev.color }}>
                    {ev.state}{ev.eventType ? ` · ${ev.eventType}` : ''}
                  </p>
                  {/* hover detail */}
                  {(ev.summary || ev.sourceUrl) && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 z-20 rounded-md p-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                      style={{ background: 'var(--bg-surface, #182336)', border: '1px solid var(--cards-border)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)' }}>
                      {ev.summary && <p className="text-[10px] leading-snug" style={{ color: 'var(--text-secondary, #C7D0DE)' }}>{ev.summary.slice(0, 220)}{ev.summary.length > 220 ? '…' : ''}</p>}
                      {ev.sourceUrl && (
                        <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--link, #5EEAD4)' }}>
                          Source →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <footer className="px-4 py-2 border-t" style={{ borderColor: 'var(--cards-border)' }}>
        <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
          Source: Tractova policy-impact tracker (admin-curated from state PUC / legislative filings). Node color = assessed impact severity.
        </p>
      </footer>
    </div>
  )
}
