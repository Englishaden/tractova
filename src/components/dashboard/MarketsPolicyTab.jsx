// MarketsPolicyTab — placeholder for Ship 2.2.
//
// Full content (state program grid, subscriber-mix comparison, score-
// history timeline, dense policy feed) lands in the next push. This
// placeholder gives the tab an honest "we're building this" surface
// instead of an empty container that looks broken.

export default function MarketsPolicyTab() {
  const sections = [
    {
      label: 'State Program Grid',
      sub: 'Clickable cards for the ~22 states with active/limited/pending CS programs — each with capacity, runway, and a score gauge.',
    },
    {
      label: 'Subscriber Mix Comparison',
      sub: 'Stacked-bar comparison across LMI-required states. LMI / commercial / residential / municipal aggregated from LBNL deployment data.',
    },
    {
      label: 'State Score History',
      sub: '8-week multi-line trend of feasibility scores for the top-mover states, sized by score-range volatility.',
    },
    {
      label: 'Policy Feed (Dense Mode)',
      sub: 'Paginated 50-item-per-page version of the Intelligence Feed with pillar tabs, dotted-underline rows, and hover-reveal source detail.',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-md p-6 overflow-hidden"
        style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
      >
        {/* Teal hairline */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
            Coming next ship
          </p>
        </div>
        <h2 className="text-xl font-serif font-semibold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Markets &amp; Policy
        </h2>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
          A deeper read on which CS programs are accepting capacity, who's subscribing them, how
          state scores move week-to-week, and the policy conversation driving it all. Ship 2.2.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div
              key={s.label}
              className="rounded-md p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--cards-border)' }}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.20em] font-bold mb-1.5" style={{ color: 'var(--link, #5EEAD4)' }}>
                {s.label}
              </p>
              <p className="text-[11px] leading-snug" style={{ color: 'var(--text-label)' }}>
                {s.sub}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          Plan: .claude/plans/warm-foraging-charm.md · v2.5 Ship 2.2
        </p>
      </div>
    </div>
  )
}
