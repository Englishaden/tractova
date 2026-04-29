import { useState, useEffect } from 'react'
import { getNewsFeed } from '../lib/programData'
import { supabase } from '../lib/supabase'

// Module-level session cache so the Market Pulse fetches once per session,
// not on every NewsFeed mount/unmount.
let _pulseCache = null

const PILLAR_STYLES = {
  offtake: { dot: 'bg-primary',     badge: 'bg-primary-50 text-primary-700 border-primary-200',     label: 'Offtake' },
  ix:      { dot: 'bg-accent-500',  badge: 'bg-accent-50 text-accent-700 border-accent-200',         label: 'Interconnection' },
  site:    { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200',               label: 'Site Control' },
}

const TYPE_STYLES = {
  'policy-alert':  { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Policy Alert',  dot: 'bg-amber-400' },
  'market-update': { badge: 'bg-gray-100 text-gray-500 border-gray-200',   label: 'Market Update', dot: 'bg-gray-300'  },
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PAGE_SIZE = 4

export default function NewsFeed({ news: newsProp }) {
  const [filter,   setFilter]   = useState('all')
  const [page,     setPage]     = useState(0)
  const [liveNews, setLiveNews] = useState(null)
  const [pulse,    setPulse]    = useState(_pulseCache)
  const [pulseLoading, setPulseLoading] = useState(false)

  // If news wasn't passed as a prop (e.g. used standalone), fetch it ourselves
  useEffect(() => {
    if (!newsProp) getNewsFeed().then(setLiveNews).catch(console.error)
  }, [newsProp])

  const newsData = newsProp ?? liveNews ?? []

  // Fetch Market Pulse AI summary once per session (Pro-gated; silently no-ops for free)
  useEffect(() => {
    if (_pulseCache || pulseLoading || !newsData.length) return
    let cancelled = false
    setPulseLoading(true)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setPulseLoading(false); return }
        const items = newsData.slice(0, 12).map(n => ({
          headline: n.headline,
          summary: n.summary,
          pillar: n.pillar,
          source: n.source,
        }))
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'news-summary', items }),
        })
        if (cancelled) return
        // Pro-only: free users get 403, just silently skip
        if (!res.ok) { setPulseLoading(false); return }
        const json = await res.json()
        if (!cancelled && json.summary) {
          _pulseCache = json.summary
          setPulse(json.summary)
        }
        setPulseLoading(false)
      } catch {
        if (!cancelled) setPulseLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [newsData.length])

  const filtered = filter === 'all'
    ? newsData
    : newsData.filter((item) => item.pillar === filter)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // Reset to page 0 when filter changes
  const handleFilter = (f) => { setFilter(f); setPage(0) }

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Policy & Market Feed</h2>
          <span className="text-xs text-gray-400">{newsData.length} items</span>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mt-2.5">
          {['all', 'offtake', 'ix', 'site'].map((f) => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'ix' ? 'Interconnection' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Market Pulse — AI-summarized rollup of recent news (Pro only) */}
      {(pulse || pulseLoading) && (
        <div
          className="px-5 py-3 border-b border-gray-100"
          style={{ background: 'rgba(20,184,166,0.04)' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2-7 4 14 2-7h4"/>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#0F766E' }}>
              Market Pulse
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded text-teal-700" style={{ background: 'rgba(20,184,166,0.12)' }}>
              AI
            </span>
          </div>
          {pulseLoading ? (
            <p className="text-[12px] italic text-gray-400">Synthesizing this week's signal…</p>
          ) : (
            <p className="text-[12px] leading-relaxed text-gray-700">{pulse}</p>
          )}
        </div>
      )}

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {paginated.map((item) => {
          const pillar    = PILLAR_STYLES[item.pillar] || PILLAR_STYLES.offtake
          const typeStyle = TYPE_STYLES[item.type]     || TYPE_STYLES['market-update']
          const isAlert   = item.type === 'policy-alert'
          const stateTags = item.tags.filter((t) => t.length === 2 && t === t.toUpperCase())

          return (
            <article
              key={item.id}
              className={`px-5 py-4 hover:bg-surface transition-colors ${isAlert ? 'border-l-2 border-amber-300' : ''}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${isAlert ? typeStyle.dot : pillar.dot}`} />
                <div className="flex-1 min-w-0">
                  {/* Type tag above headline for alerts */}
                  {isAlert && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mb-1 ${typeStyle.badge}`}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                      {typeStyle.label}
                    </span>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-sm leading-snug transition-colors hover:text-primary ${isAlert ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}
                  >
                    {item.headline}
                  </a>
                  {item.summary && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {!isAlert && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${typeStyle.badge}`}>
                        {typeStyle.label}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${pillar.badge}`}>
                      {pillar.label}
                    </span>
                    {stateTags.map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                        {tag}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                      {item.source} · {formatDate(item.date)}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* Footer — pagination */}
      <div className="px-5 py-2.5 border-t border-gray-100 bg-chrome rounded-b-lg flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {page * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE + PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            aria-label="Previous page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
            aria-label="Next page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
