// ── LibrarySubNav — horizontal sub-tab strip (Pass 6) ────────────────────────
// Bifurcates the Library into three focused views (Dashboard-style nav, but a
// light horizontal strip so the board keeps full width): Pipeline (the deal
// board/list) · Intelligence (portfolio analytics) · Comparisons. State + URL
// (?view=) live in useLibraryLayout; this is presentational.

const TABS = [
  {
    id: 'pipeline', label: 'Pipeline',
    icon: (<><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>),
  },
  {
    id: 'intelligence', label: 'Intelligence',
    icon: (<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  },
  {
    id: 'comparisons', label: 'Comparisons',
    icon: (<><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>),
  },
]

export default function LibrarySubNav({ viewMode, setViewMode, counts = {} }) {
  return (
    <nav
      className="flex items-center gap-0.5 sm:gap-1 border-b border-gray-200 mb-4 overflow-x-auto thin-scrollbar"
      role="tablist"
      aria-label="Library view"
    >
      {TABS.map((t) => {
        const active = viewMode === t.id
        const count = counts[t.id]
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setViewMode(t.id)}
            className="relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/30 rounded-t-md"
            style={{ color: active ? '#0F766E' : '#6B7280' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            <span>{t.label}</span>
            {count != null && count > 0 && (
              <span className="font-mono text-[10px] tabular-nums" style={{ color: active ? '#0F766E' : '#9CA3AF', opacity: 0.8 }}>· {count}</span>
            )}
            {active && (
              <span
                className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #14B8A6 30%, #14B8A6 70%, transparent)' }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
