import { useMemo } from 'react'
import { Link } from 'react-router-dom'

// ── Empty-state onboarding ───────────────────────────────────────────────────
// Surfaces the platform's live-data promise on the very first render a new
// Pro lands on /library: a "Live markets right now" strip pulling the most-
// recently-updated active CS states from the already-loaded stateProgramMap,
// each clickable into a pre-filled Lens. The 3-value-prop card and primary
// CTAs stay below — but the user's first action becomes "click a real
// state to see Lens in motion" instead of "start typing into the form."
export default function EmptyStateOnboarding({ stateProgramMap, lastRefresh }) {
  // Top 4 active CS states by recency. Sort by max(lastVerified, updatedAt)
  // descending so we surface what we've most recently re-verified — the
  // freshest of the live coverage. csStatus filter keeps the showcase to
  // states a user can actually run a Lens on with confidence.
  const liveMarkets = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    const tsOf = (s) => {
      const v = s.lastVerified ? new Date(s.lastVerified).getTime() : 0
      const u = s.updatedAt    ? new Date(s.updatedAt).getTime()    : 0
      return v > u ? v : u
    }
    return states
      .filter((s) => s.csStatus === 'active')
      .map((s) => ({ ...s, _ts: tsOf(s) }))
      .filter((s) => s._ts > 0)
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 4)
  }, [stateProgramMap])

  return (
    <div
      className="rounded-2xl mt-2 mx-auto max-w-3xl px-8 py-10"
      style={{
        background: 'linear-gradient(180deg, rgba(20,184,166,0.04) 0%, rgba(20,184,166,0.08) 100%)',
        border: '1px solid rgba(20,184,166,0.20)',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
            boxShadow: '0 6px 18px rgba(20,184,166,0.30)',
          }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: '#0F766E' }}>
          Step 1 · Build your portfolio
        </p>
        <h2 className="font-serif text-2xl font-semibold text-ink" style={{ letterSpacing: '-0.018em' }}>
          Save your first project
        </h2>
        <p className="text-sm mt-2 max-w-md text-gray-600 leading-relaxed">
          Run a Lens analysis on any state + county, then click <span className="text-ink font-semibold">Save as Project</span>.
          Saved projects unlock alerts, weekly digest, and live re-scoring as market data shifts.
        </p>

        {/* Live-data freshness stamp — proves the live-data promise on the
            very first render. Mirrors the Library hero stamp once projects
            exist; here we show it pre-projects to set expectations. */}
        {lastRefresh && (
          <div className="flex items-center gap-2 mt-3">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: lastRefresh.isStale ? '#D97706' : '#0F766E', boxShadow: lastRefresh.isStale ? 'none' : '0 0 4px rgba(20,184,166,0.7)' }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: lastRefresh.isStale ? '#92400E' : '#0F766E' }}>
              Live data refreshed {lastRefresh.date}
            </span>
          </div>
        )}

        {/* Live markets strip — most-recently-verified active CS states.
            Each card click opens /search with the state pre-selected (county
            and tech stay user-chosen). The user's first interaction becomes
            "click a real state and see Lens in motion" instead of staring
            at an empty form.

            Skeleton placeholders render while stateProgramMap hydrates so
            the layout stays stable on first paint — without this guard the
            strip silently disappears for the ~200-500ms it takes Supabase
            to return state_programs, creating a jarring late-paint shift. */}
        <div className="w-full max-w-2xl mt-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-bold" style={{ color: '#0F766E' }}>
              ◆ Live markets right now
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
              most recently verified
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {liveMarkets.length === 0 ? (
              // Skeleton — 4 placeholder cards while stateProgramMap loads
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`mkt-skel-${i}`}
                  className="rounded-lg px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(20,184,166,0.10)',
                    minHeight: 90,
                  }}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="h-2 w-6 rounded-sm bg-gray-200/80 animate-pulse" />
                    <div className="h-2 w-10 rounded-sm bg-gray-200/60 animate-pulse" />
                  </div>
                  <div className="h-3 w-3/4 rounded-sm bg-gray-200/80 mb-1.5 animate-pulse" />
                  <div className="h-2 w-1/2 rounded-sm bg-gray-200/60 animate-pulse" />
                </div>
              ))
            ) : (
              liveMarkets.map((s) => {
                const ageDays = Math.max(0, Math.floor((Date.now() - s._ts) / 86400000))
                const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1d ago' : `${ageDays}d ago`
                const capacityLabel = s.capacityMW > 0
                  ? (s.capacityMW >= 1000 ? `${(s.capacityMW / 1000).toFixed(1)}k MW` : `${s.capacityMW} MW`)
                  : null
                return (
                  <Link
                    key={s.id}
                    to={`/search?state=${s.id}`}
                    className="group/mkt rounded-lg px-3 py-2.5 text-left transition-all hover:-translate-y-px"
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(20,184,166,0.20)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.55)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(20,184,166,0.20)' }}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-bold text-ink">
                        {s.id}
                      </span>
                      <span className="font-mono text-[9px] text-gray-400 tabular-nums">
                        {ageLabel}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-ink leading-tight truncate">{s.name}</p>
                    {capacityLabel && (
                      <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                        {capacityLabel} remaining
                      </p>
                    )}
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] mt-1.5 transition-colors" style={{ color: '#0F766E' }}>
                      Run Lens →
                    </p>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Three value props — what saved projects unlock. Anchors the
            empty state's "why save?" question after the live-markets
            strip has answered "where do I start?" */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 w-full max-w-2xl">
          {[
            { icon: 'M12 2 L2 7 L12 12 L22 7 z M2 17 L12 22 L22 17 M2 12 L12 17 L22 12', label: 'Live re-scoring', body: 'Feasibility index recomputes as program capacity, IX queues, and tariffs shift.' },
            { icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z', label: 'Alerts on change', body: 'Email when CS programs cap, SREC markets move, or upgrade costs spike.' },
            { icon: 'M3 3v18h18 M9 17V9 M14 17V5 M19 17v-4', label: 'Portfolio analytics', body: 'AI-generated weekly insight + concentration risk + portfolio health score.' },
          ].map(p => (
            <div key={p.label} className="rounded-lg px-3 py-3 text-left" style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center mb-1.5" style={{ background: 'rgba(20,184,166,0.12)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={p.icon} />
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-ink leading-tight">{p.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0F766E' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Open Tractova Lens
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors"
          >
            Or browse Markets on the Move →
          </Link>
        </div>
      </div>
    </div>
  )
}
