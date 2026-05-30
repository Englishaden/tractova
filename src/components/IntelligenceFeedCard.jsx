import { useEffect, useRef } from 'react'
import AnimatedList from './ui/AnimatedList'
import AnimatedIcon from './ui/AnimatedIcon'

// IntelligenceFeedCard — condensed replacement for the verbose NewsFeed
// on the revamped Dashboard. Top-5 most-recent items in a tight card.
//
// Aden's brief 2026-05-27: "Get rid of the policy and market feed but
// condense it into its own card using the skills files we have." The
// old NewsFeed carried filter tabs, pagination, Market Pulse AI block,
// preview-mode gating — all of which made it feel like its own page-
// within-a-page. This is the intelligence-terminal-friendly distillate.
//
// Patterns used:
//   • Spotlight Card chrome — adapts the existing `.lp-spotlight` CSS
//     utility (already defined in src/index.css from the Landing page).
//     Cursor-following teal radial gradient on hover. Zero new deps.
//   • Defillama dotted-underline cell pattern — `underline decoration-dotted`
//     on each headline + source-line so every cell reads as hover-rich.
//   • Defillama hover-reveal CTA — "View all" link goes from invisible
//     to visible on card hover (group-hover trick).
//   • Tractova pillar dot vocabulary — teal (offtake), amber (ix), blue (site)
//     dots before each headline so pillar reads at a glance.
//
// Does NOT include (intentional cuts per Aden):
//   • Filter tabs — global filters live in the MarketFiltersRail
//   • Pagination — top-5 only; "View all" links to the legacy feed view
//   • Market Pulse AI block — was tied to MarketBrief; both temporarily
//     hidden together.

const PILLAR_DOT = {
  offtake: '#14B8A6', // teal — Tractova brand
  ix:      '#FBBF24', // amber — caution
  site:    '#60A5FA', // sky-blue — site control
}

const PILLAR_LABEL = {
  offtake: 'Offtake',
  ix:      'Interconnection',
  site:    'Site',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ITEM_LIMIT = 5

export default function IntelligenceFeedCard({ news = [], onSeeAll }) {
  const cardRef = useRef(null)

  // Cursor-following spotlight (`.lp-spotlight` reads --mx / --my CSS vars
  // we set on pointermove). Same hook the Landing page uses; pattern
  // catalogued in Skills/Spotlight Card.md.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])

  const items = (news || []).slice(0, ITEM_LIMIT)

  return (
    <article
      ref={cardRef}
      className="lp-spotlight group rounded-md flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--cards-bg, #131C2C)',
        border: '1px solid var(--cards-border, #1F2A3D)',
      }}
    >
      {/* Hairline accent rail (dashboard-dark teal) */}
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      {/* Header */}
      <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
            Intelligence Feed
          </p>
        </div>
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted, #6C7A91)' }}>
          {(news || []).length} items · live
        </span>
      </header>

      {/* Items — cascade in on mount (Skills/Animated List.md) */}
      {items.length === 0 ? (
        <ul className="flex-1 min-h-0">
          <li className="px-4 py-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
              No signals
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              No policy or market signals match the active filters.
            </p>
          </li>
        </ul>
      ) : (
        <AnimatedList className="flex-1 overflow-y-auto thin-scrollbar divide-y divide-[var(--cards-border)] min-h-0" delay={0.06}>
          {items.map((item) => {
          const dot = PILLAR_DOT[item.pillar] || PILLAR_DOT.offtake
          const isAlert = item.type === 'policy-alert'
          return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                title={item.summary}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: dot,
                      boxShadow: isAlert ? `0 0 8px ${dot}` : 'none',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] leading-snug font-medium line-clamp-2 underline decoration-dotted decoration-[var(--cards-border)] underline-offset-2"
                      style={{ color: 'var(--text-primary, #F5F7FA)' }}
                    >
                      {item.headline}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] tracking-tight" style={{ color: 'var(--text-muted, #6C7A91)' }}>
                      <span style={{ color: dot }}>{PILLAR_LABEL[item.pillar] || 'Market'}</span>
                      <span> · {item.source} · {formatDate(item.date)}</span>
                      {isAlert && (
                        <span className="ml-1 font-bold uppercase" style={{ color: '#FBBF24' }}> · Alert</span>
                      )}
                    </p>
                  </div>
                </div>
              </a>
          )
        })}
        </AnimatedList>
      )}

      {/* Hover-reveal "View all" CTA (Defillama group-hover trick) */}
      <footer
        className="px-4 py-2.5 border-t shrink-0 flex items-center justify-between"
        style={{ borderColor: 'var(--cards-border)' }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.20em]" style={{ color: 'var(--text-muted)' }}>
          Showing top {Math.min(items.length, ITEM_LIMIT)}
        </span>
        <button
          type="button"
          onClick={() => onSeeAll?.()}
          className="invisible group-hover:visible group-focus-within:visible inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors"
          style={{ color: 'var(--link, #5EEAD4)' }}
        >
          View all <AnimatedIcon name="ArrowRight" animation="nudge" size={12} />
        </button>
      </footer>
    </article>
  )
}
