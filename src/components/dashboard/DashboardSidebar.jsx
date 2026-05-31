import { useSearchParams, useNavigate } from 'react-router-dom'
import AnimatedIcon from '../ui/AnimatedIcon'
import HoverBorderGradient from '../ui/HoverBorderGradient'

// DashboardSidebar — left-rail tab navigation for the Dashboard.
//
// Three tabs (Home / Analytics / Markets & Policy). Active tab is read
// from + written to the `?tab=` querystring so refresh/share/back-button
// all work. Default (no querystring) = Home.
//
// On mobile (<md), the sidebar collapses to a horizontal top strip so
// it doesn't steal width from the content. Same buttons, same routing —
// just horizontal layout.
//
// Bottom of the sidebar carries a "Run a Lens" CTA — the destination
// action that lives across all tabs (matches the previous MarketFiltersRail
// CTA position). Links to /search.

const TABS = [
  {
    id: 'home',
    label: 'Home',
    description: 'Map + filters + intel feed',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Charts + state-by-state',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'markets',
    label: 'Markets & Policy',
    description: 'Programs · subscribers · policy',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
]

// Triple-chevron glyph for the collapse toggle. Points the way the rail
// will move: left to collapse, right (mirrored) to expand. The trailing two
// chevrons fade so it reads as "fold this away," not a single back-arrow.
function TripleChevron({ expand }) {
  return (
    <svg
      width="16" height="14" viewBox="0 0 16 14" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: expand ? 'scaleX(-1)' : 'none' }}
      aria-hidden="true"
    >
      <polyline points="7 2 2 7 7 12" />
      <polyline points="11 2 6 7 11 12" opacity="0.6" />
      <polyline points="15 2 10 7 15 12" opacity="0.32" />
    </svg>
  )
}

export default function DashboardSidebar({ collapsed = false, onToggleCollapse }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeTab = searchParams.get('tab') || 'home'

  const handleTabClick = (id) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'home') next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next, { replace: false })
  }

  const handleRunLens = () => navigate('/search')

  return (
    <>
      {/* Desktop: vertical rail on lg+ */}
      <aside
        className="hidden lg:flex lg:flex-col rounded-md h-full thin-scrollbar overflow-y-auto overflow-x-hidden"
        style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
        aria-label="Dashboard sections"
      >
        {/* Header — label (hidden when collapsed) + collapse toggle */}
        <div className={`pt-3 pb-2 shrink-0 flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
          {!collapsed && (
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: 'var(--text-primary)' }}>
              Dashboard
            </p>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="dash-collapse-toggle shrink-0 inline-flex items-center justify-center rounded-md w-7 h-7 transition-colors"
            style={{
              background: 'rgba(20,184,166,0.08)',
              border: '1px solid var(--hairline-teal, rgba(20,184,166,0.30))',
              color: 'var(--link, #5EEAD4)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.18)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.08)' }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <TripleChevron expand={collapsed} />
          </button>
        </div>
        <nav className={`flex-1 pb-2 flex flex-col gap-1.5 ${collapsed ? 'px-2 items-center' : 'px-2'}`}>
          {TABS.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabClick(t.id)}
                className={`dash-border-gradient group relative text-left rounded-md transition-all overflow-hidden ${collapsed ? 'w-10 h-10 flex items-center justify-center px-0 py-0' : 'px-3 py-2.5'}`}
                style={{
                  background: active
                    ? 'linear-gradient(135deg, rgba(20,184,166,0.14) 0%, rgba(20,184,166,0.04) 100%)'
                    : 'rgba(255,255,255,0.02)',
                  color: active ? 'var(--link, #5EEAD4)' : 'var(--text-label)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-label)' }}
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'page' : undefined}
              >
                {/* Top hairline accent — visible only on the active tab */}
                {active && !collapsed && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-2 right-2 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(94,234,212,0.85) 50%, transparent 100%)' }}
                  />
                )}

                {collapsed ? (
                  <span
                    className="relative z-10 shrink-0 transition-colors"
                    style={{ color: active ? 'var(--link, #5EEAD4)' : 'inherit' }}
                  >
                    {t.icon}
                  </span>
                ) : (
                  <>
                    <div className="relative z-10 flex items-center gap-2">
                      <span
                        className="shrink-0 transition-colors"
                        style={{ color: active ? 'var(--link, #5EEAD4)' : 'inherit' }}
                      >
                        {t.icon}
                      </span>
                      <span className="text-[13px] font-semibold leading-none">{t.label}</span>
                    </div>
                    <p
                      className="relative z-10 mt-1 ml-6 text-[10px] leading-snug"
                      style={{
                        color: active ? 'var(--link, #5EEAD4)' : 'var(--text-muted)',
                        opacity: active ? 0.78 : 1,
                      }}
                    >
                      {t.description}
                    </p>
                  </>
                )}

                {/* Soft teal radial glow behind the active tab — sits
                    UNDER the content, sells the "this tab is hot" feel */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle at 0% 50%, rgba(20,184,166,0.18) 0%, transparent 60%)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Run a Lens CTA — anchored at the bottom of the rail */}
        <div className={`pt-2 pb-3 border-t shrink-0 ${collapsed ? 'px-2' : 'px-2'}`} style={{ borderColor: 'var(--cards-border)' }}>
          <HoverBorderGradient containerClassName="w-full" radius={8}>
            <button
              type="button"
              onClick={handleRunLens}
              className={`dash-ai-glow w-full inline-flex items-center justify-center gap-2 rounded-md font-bold text-[12px] transition-all hover:brightness-110 ${collapsed ? 'h-10 py-0' : 'py-2'}`}
              style={{
                background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 16px -4px rgba(20,184,166,0.55)',
              }}
              aria-label="Run a Lens"
            >
              <AnimatedIcon name="Search" animation="pulse" size={11} strokeWidth={2.5} />
              {!collapsed && 'Run a Lens'}
            </button>
          </HoverBorderGradient>
          {!collapsed && (
            <p className="mt-1.5 text-[9px] leading-tight text-center" style={{ color: 'var(--text-muted)' }}>
              Single-project deep-dive
            </p>
          )}
        </div>
      </aside>

      {/* Mobile: horizontal scroll strip on <lg */}
      <nav
        className="lg:hidden flex items-center gap-2 overflow-x-auto thin-scrollbar p-2 rounded-md"
        style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)' }}
        aria-label="Dashboard sections"
      >
        {TABS.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabClick(t.id)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-all"
              style={{
                background: active ? 'rgba(20,184,166,0.10)' : 'transparent',
                border: `1px solid ${active ? 'rgba(20,184,166,0.40)' : 'var(--cards-border)'}`,
                color: active ? 'var(--link, #5EEAD4)' : 'var(--text-label)',
              }}
              data-active={active ? 'true' : 'false'}
            >
              <span className="shrink-0">{t.icon}</span>
              <span className="text-[12px] font-semibold whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={handleRunLens}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold text-[11px]"
          style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)', color: '#FFFFFF', boxShadow: '0 4px 12px -4px rgba(20,184,166,0.50)' }}
        >
          Run a Lens
        </button>
      </nav>
    </>
  )
}
