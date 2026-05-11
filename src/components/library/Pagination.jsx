// Phase 2A · TRACTOVA-UX-001 — Library pagination control.
//
// Client-side windowing of the rendered list. The data fetch in
// Library.jsx still pulls all projects because the Pipeline Distribution
// stat strip + score-change audit + stats banner all need the full set
// — only the rendering of cards / table rows is windowed.
//
// Four page sizes (10 / 25 / 50 / 100). Default 25 is right for the
// typical CS-developer pipeline; 10 lets a smaller portfolio actually
// exercise the pagination affordance; 100 is the "show everything in
// a long scroll" option. Power users with very large pipelines can
// also bypass entirely via the hidden ?all=1 URL flag.
//
// The strip is rendered whenever the portfolio is large enough that
// pagination is a meaningful affordance (≥5 projects in the filtered
// view). When there's only one page of results the prev/next chevrons
// hide, so the strip reads as a position indicator + page-size selector
// rather than a control surface — never noise.
//
// All numerics tabular-nums + JetBrains Mono so the strip reads as a
// data row, Bloomberg-style.

const PAGE_SIZES = [10, 25, 50, 100]

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const atFirst = page <= 1
  const atLast = page >= totalPages

  return (
    <div
      className="flex items-center justify-between gap-3 mt-4 mb-1 pt-3 px-1 flex-wrap"
      style={{ borderTop: '1px solid #E5E7EB' }}
    >
      <span className="text-[11px] font-mono tabular-nums" style={{ color: '#6B7280' }}>
        Showing <span className="font-semibold text-ink">{start}</span>
        <span className="mx-0.5 text-gray-400">–</span>
        <span className="font-semibold text-ink">{end}</span>
        <span className="mx-1 text-gray-400">of</span>
        <span className="font-semibold text-ink">{total}</span>
      </span>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-gray-400">Show:</span>
        {PAGE_SIZES.map(n => {
          const active = pageSize === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onPageSizeChange(n)}
              className="text-[10px] font-semibold font-mono tabular-nums px-2 py-1 rounded-sm transition-colors"
              style={active
                ? { background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.30)' }
                : { background: 'transparent', color: '#6B7280', border: '1px solid transparent' }}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Prev / next chevrons hide when there's only one page. The
          page-size selector + position indicator above still tell the
          user where they stand and offer the affordance to shrink the
          page size; controls only appear when there's something to
          control. */}
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={atFirst}
            aria-label="Previous page"
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
            style={{ color: atFirst ? '#9CA3AF' : '#0F1A2E', border: '1px solid #E5E7EB' }}
            onMouseEnter={(e) => { if (!atFirst) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="text-[11px] font-mono tabular-nums px-2 text-gray-500">
            <span className="font-semibold text-ink">{page}</span>
            <span className="mx-1 text-gray-400">/</span>
            <span className="font-semibold text-ink">{totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={atLast}
            aria-label="Next page"
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
            style={{ color: atLast ? '#9CA3AF' : '#0F1A2E', border: '1px solid #E5E7EB' }}
            onMouseEnter={(e) => { if (!atLast) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      ) : (
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-gray-400">
          1 page
        </span>
      )}
    </div>
  )
}
