// Phase 2A · TRACTOVA-UX-001 — Library view-mode toggle (Cards | Table | Map).
//
// One persistent control above the project list. Cards is the existing
// pre-Phase-2A surface and stays the default. Table is the Bloomberg-grid
// portfolio cockpit (Slice 1). Map is Phase 2B — button is visible but
// disabled with a tooltip until that wave lands.
//
// Layout state lives in Library.jsx and is persisted to localStorage under
// `tractova_library_view`. This component is presentational only.

const VIEWS = [
  {
    id: 'cards',
    label: 'Cards',
    hint: 'One project per card · expanded detail',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4"  width="18" height="6" rx="1"/>
        <rect x="3" y="14" width="18" height="6" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'table',
    label: 'Table',
    hint: 'Bloomberg grid · 50 projects per screen',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="1"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="11" y1="4" x2="11" y2="20"/>
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    hint: 'US choropleth · pipeline pins by county',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3z"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
  },
]

export default function LibraryToolbar({ layout, onLayoutChange, count }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 mt-2">
      <div
        className="inline-flex items-center gap-0.5 p-0.5 rounded-md"
        style={{ background: 'rgba(15,26,46,0.04)', border: '1px solid #E5E7EB' }}
        role="tablist"
        aria-label="Library view mode"
      >
        {VIEWS.map(v => {
          const active = layout === v.id
          const disabled = !!v.disabled
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => !disabled && onLayoutChange(v.id)}
              title={disabled ? `${v.hint} (coming soon)` : v.hint}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded transition-all"
              style={
                disabled
                  ? { color: '#9CA3AF', cursor: 'not-allowed' }
                  : active
                  ? { background: 'white', color: '#0F1A2E', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                  : { background: 'transparent', color: '#6B7280' }
              }
            >
              {v.icon}
              <span>{v.label}</span>
              {disabled && (
                <span className="eyebrow-mono ml-0.5" style={{ color: '#9CA3AF' }}>2B</span>
              )}
            </button>
          )
        })}
      </div>

      {count != null && (
        <span className="eyebrow-mono shrink-0" style={{ color: '#5A6B7A' }}>
          {count} project{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}
