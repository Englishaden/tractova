import { useMemo, useState } from 'react'

// DensePolicyFeed — Markets & Policy tab, section 4.
// The full-fidelity reincarnation of the old NewsFeed: every active
// signal, paginated 50 per page, filterable by pillar. Rows use the
// dotted-underline cell treatment from IntelligenceFeedCard; hovering a
// row reveals the source summary inline. This is the "read the whole
// conversation" surface that the condensed Intelligence Feed (top-5) on
// the Home tab links nowhere near.
//
// Data: getNewsFeed() (passed down from MarketsPolicyTab). All four
// pillars (offtake / ix / site / policy) are first-class tabs.

const PER_PAGE = 50

const PILLARS = [
  { key: 'all',     label: 'All',            color: '#5EEAD4' },
  { key: 'offtake', label: 'Offtake',        color: '#14B8A6' },
  { key: 'ix',      label: 'Interconnection', color: '#FBBF24' },
  { key: 'site',    label: 'Site',           color: '#60A5FA' },
  { key: 'policy',  label: 'Policy',         color: '#A78BFA' },
]

const PILLAR_COLOR = {
  offtake: '#14B8A6',
  ix:      '#FBBF24',
  site:    '#60A5FA',
  policy:  '#A78BFA',
}
const PILLAR_LABEL = {
  offtake: 'Offtake',
  ix:      'Interconnection',
  site:    'Site',
  policy:  'Policy',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DensePolicyFeed({ news = [] }) {
  const [pillar, setPillar] = useState('all')
  const [page, setPage] = useState(0)

  // Per-pillar counts for the tab badges (computed once over the full feed).
  const counts = useMemo(() => {
    const c = { all: news.length, offtake: 0, ix: 0, site: 0, policy: 0 }
    for (const n of news) if (c[n.pillar] != null) c[n.pillar] += 1
    return c
  }, [news])

  const filtered = useMemo(() => {
    if (pillar === 'all') return news
    return news.filter((n) => n.pillar === pillar)
  }, [news, pillar])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PER_PAGE
  const pageItems = filtered.slice(start, start + PER_PAGE)

  const selectPillar = (key) => { setPillar(key); setPage(0) }

  return (
    <section
      className="relative rounded-md overflow-hidden flex flex-col"
      style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
    >
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      {/* Header + pillar tabs */}
      <header className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
            </span>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
              Policy Feed
            </h2>
          </div>
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} signal{filtered.length === 1 ? '' : 's'} · {pageCount} page{pageCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PILLARS.map((p) => {
            const active = pillar === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPillar(p.key)}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 transition-all"
                style={{
                  background: active ? 'var(--link-active-bg, rgba(20,184,166,0.18))' : 'transparent',
                  border: `1px solid ${active ? p.color : 'var(--cards-border)'}`,
                  color: active ? '#FFFFFF' : 'var(--text-label)',
                }}
                data-active={active ? 'true' : 'false'}
              >
                {p.key !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />}
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-bold">{p.label}</span>
                <span className="font-mono text-[9px] tabular-nums" style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{counts[p.key] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Rows */}
      <ul className="divide-y divide-[var(--cards-border)] border-t border-[var(--cards-border)]">
        {pageItems.length === 0 ? (
          <li className="px-4 py-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>No signals</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No items tagged with this pillar.</p>
          </li>
        ) : pageItems.map((item) => {
          const color = PILLAR_COLOR[item.pillar] || PILLAR_COLOR.offtake
          const isAlert = item.type === 'policy-alert'
          return (
            <li key={item.id} className="group px-4 py-2.5 transition-colors hover:bg-white/[0.025]">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color, boxShadow: isAlert ? `0 0 8px ${color}` : 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12.5px] leading-snug font-medium underline decoration-dotted decoration-[var(--cards-border)] underline-offset-2 group-hover:decoration-[var(--link)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.headline}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] tracking-tight" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color }}>{PILLAR_LABEL[item.pillar] || 'Market'}</span>
                      <span> · {item.source} · {formatDate(item.date)}</span>
                      {item.stateIds?.length > 0 && <span> · {item.stateIds.slice(0, 4).join(', ')}{item.stateIds.length > 4 ? '…' : ''}</span>}
                      {isAlert && <span className="ml-1 font-bold uppercase" style={{ color: '#FBBF24' }}> · Alert</span>}
                    </p>
                    {/* Hover-reveal summary */}
                    {item.summary && (
                      <p className="mt-1 text-[11px] leading-snug max-h-0 overflow-hidden opacity-0 group-hover:max-h-24 group-hover:opacity-100 transition-all duration-200" style={{ color: 'var(--text-secondary)' }}>
                        {item.summary}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            </li>
          )
        })}
      </ul>

      {/* Pagination */}
      {pageCount > 1 && (
        <footer className="px-4 py-2.5 border-t shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--cards-border)' }}>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            {start + 1}–{Math.min(start + PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
              style={{ color: 'var(--link, #5EEAD4)', border: '1px solid var(--cards-border)' }}
            >
              ← Prev
            </button>
            <span className="font-mono text-[10px] tabular-nums px-1" style={{ color: 'var(--text-label)' }}>
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04]"
              style={{ color: 'var(--link, #5EEAD4)', border: '1px solid var(--cards-border)' }}
            >
              Next →
            </button>
          </div>
        </footer>
      )}
    </section>
  )
}
