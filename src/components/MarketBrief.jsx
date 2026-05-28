import { useEffect, useState, useMemo } from 'react'
import TractovaLoader from './ui/TractovaLoader'
import { sanitizeBrief } from '../lib/searchShared.jsx'

// MarketBrief — above-the-fold editorial paragraph for the Dashboard.
//
// Sits between the page header and MetricsBar. Single-paragraph (~50 words),
// serif drop-cap, Claude Sonnet 4.6 badge — same visual vocabulary as
// MarketIntelligenceSummary on the Lens results page and NewsFeed's Market
// Pulse. The brief itself is weekly-cached server-side (api/market-brief.js),
// so this fetch is a near-zero-cost cache lookup for the dashboard.
//
// Slot ALWAYS renders: if the API returns null (cold start, error, no API
// key), a hard static fallback ("X states with active programs · Y MW
// addressable pipeline · refreshed weekly") synthesized from the props takes
// its place. The dashboard never opens with an empty slot above the metrics.
//
// Public to both signed-in users and /preview unauth visitors — the brief is
// a hook, not a gated asset (matches the plan's "verdict before the data
// grid" intent).

// Module-level cache — the brief is global (not user-scoped) and shared
// week-to-week, so a single fetch per page-load lifecycle is plenty. Avoids
// re-firing the network call when the Dashboard remounts mid-session (e.g.
// navigating away to /library and back).
let _briefCache = null

export default function MarketBrief({ stateProgramMap, deltaMap }) {
  const [data, setData] = useState(_briefCache)
  const [loading, setLoading] = useState(!_briefCache)

  // Static fallback synthesized from props — always available, always
  // honest. This is what renders if the API has no signal yet, or if the
  // brief fetch errors. The component never blanks.
  const staticFallback = useMemo(() => {
    const programs = Object.values(stateProgramMap || {})
    const active = programs.filter(s => s.csStatus === 'active').length
    const limited = programs.filter(s => s.csStatus === 'limited').length
    const totalMW = programs
      .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
      .reduce((sum, s) => sum + (s.capacityMW || 0), 0)
    const moverCount = deltaMap?.size || 0
    if (active === 0) {
      return 'Tractova tracks every U.S. community-solar program in one place — open programs, capacity left, interconnection conditions, and policy moves that shift where the next megawatt gets built. Refreshed weekly.'
    }
    const moverClause = moverCount > 0
      ? ` ${moverCount} state${moverCount === 1 ? '' : 's'} moved on score this week.`
      : ''
    return `${active} state${active === 1 ? '' : 's'} are running open community-solar programs and another ${limited} are operating at limited capacity, totaling ${totalMW.toLocaleString()} MW of addressable pipeline for independent developers right now.${moverClause} Refreshed weekly.`
  }, [stateProgramMap, deltaMap])

  useEffect(() => {
    if (_briefCache) { setData(_briefCache); setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        // Routed through the lens-insight multiplexer (public action,
        // before the Pro auth gate) so it doesn't consume a slot in the
        // Hobby plan's 12-Serverless-Function cap.
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'market-brief' }),
        })
        if (cancelled) return
        if (!res.ok) { setLoading(false); return }
        const json = await res.json()
        if (cancelled) return
        // API always returns 200; null brief means "fall back" (which we do
        // gracefully via staticFallback). Cache the response either way so
        // we don't re-hit for the same week's null answer.
        _briefCache = json
        setData(json)
        setLoading(false)
      } catch (e) {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const cleanBrief = sanitizeBrief(data?.brief)
  const showAI = !!cleanBrief
  const callouts = Array.isArray(data?.callouts) ? data.callouts : []
  const briefText = showAI ? cleanBrief : staticFallback

  return (
    <article
      className="relative bg-white rounded-lg overflow-hidden mb-4"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Top teal hairline rail — matches MarketIntelligenceSummary vocabulary */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }}
      />

      {/* Eyebrow strip — Market Brief label + Sonnet 4.6 badge (when AI live) */}
      <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-gray-100 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Market Brief
          </span>
          {showAI ? (
            <span
              className="eyebrow-mono px-2 py-0.5"
              style={{ background: 'rgba(20,184,166,0.10)', color: '#115E59', border: '1px solid rgba(20,184,166,0.30)' }}
            >
              ◆ Claude · Sonnet 4.6
            </span>
          ) : !loading && (
            <span
              className="eyebrow-mono px-2 py-0.5"
              style={{ background: 'rgba(15,118,110,0.06)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.18)' }}
            >
              Weekly Pulse
            </span>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.20em] font-semibold"
          style={{ color: '#0F766E' }}
        >
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          This Week
        </span>
      </div>

      {/* Body — serif paragraph with drop-cap. Mirrors MarketIntelligenceSummary
          drop-cap treatment so the Dashboard's editorial moment and the Lens
          analyst brief share one voice. */}
      <div className="px-5 py-5">
        {loading ? (
          <div className="flex items-center gap-3 py-1">
            <TractovaLoader size={28} />
            <p className="text-[12px] text-gray-500 leading-tight">
              Synthesizing this week's market signal…
            </p>
          </div>
        ) : (
          <>
            <p
              className="font-serif text-[16px] leading-[1.55] text-ink first-letter:text-[54px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85] first-letter:font-serif"
              style={{ letterSpacing: '-0.005em' }}
            >
              {briefText}
            </p>

            {showAI && callouts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-gray-400">
                  Named this week
                </span>
                {callouts.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className="w-1 h-3" style={{ background: '#14B8A6' }} />
                    <span className="font-serif text-[12px] font-semibold text-ink">{c}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}
