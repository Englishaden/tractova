// ChartCard — shared chrome for Analytics-tab visualizations.
//
// Every chart on the Analytics tab sits inside one of these:
//   • Dark dashboard card surface (var(--cards-bg))
//   • Teal hairline top accent (matches the rest of the dashboard)
//   • Semantic category eyebrow + title + optional sub
//   • Optional header-right slot (toggles, controls) + badge pill
//   • Optional footer note (data-honesty caveats live here)
//   • Optional collapsible state (chevron in the eyebrow row)
//
// The chart itself goes in `children` and is expected to be a
// ResponsiveContainer-wrapped Recharts component.
//
// Bento layout (v2.10): pass `className` for the grid column span +
// `h-full` so sibling tiles in a row stretch to equal height. The card is
// a flex column; the body grows to fill. Charts still set their own inner
// pixel height (Recharts ResponsiveContainer needs one) — use the shared
// TILE_H constants so same-row tiles align.

import { useState } from 'react'

// Standard tile chart-body heights so bento rows line up. Compact by
// default so the page nearly fits one screen; charts grow when expanded.
export const TILE_H = { ribbon: 88, feature: 200, expanded: 320, hero: 220 }

export default function ChartCard({
  label,            // semantic category eyebrow (e.g. 'CAPACITY') — NOT "Chart 0X"
  title,
  sub,
  footer,
  badge,            // optional small pill node rendered next to the title
  headerRight,      // optional node rendered in the header right (toggles)
  className = '',
  collapsible = false,
  defaultOpen = true,
  expandable = false,   // show the expand/minimize button (bento reflow)
  isExpanded = false,   // controlled expanded state (drives the icon)
  onToggleExpand,       // () => void — parent owns the bento col-span reflow
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const expanded = !collapsible || open

  return (
    <article
      className={`relative rounded-md overflow-hidden flex flex-col ${className}`}
      style={{ background: 'var(--cards-bg, #131C2C)', border: '1px solid var(--cards-border, #1F2A3D)' }}
    >
      {/* Teal hairline accent */}
      <div className="h-px shrink-0" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />

      {/* Eyebrow + title row. When `expandable`, the WHOLE header is the
          click target (like the KPI cards) — onToggleExpand fires on header
          click; interactive children stopPropagation. The expand glyph is
          a passive indicator, not the only hit area. */}
      <header
        className={`group/hdr px-4 pt-3 pb-2 flex items-start justify-between gap-2 shrink-0 ${expandable ? 'cursor-pointer select-none' : ''}`}
        onClick={expandable ? onToggleExpand : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-pressed={expandable ? isExpanded : undefined}
        onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand?.() } } : undefined}
      >
        <div className="flex-1 min-w-0">
          {label && (
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] font-bold leading-none mb-1.5" style={{ color: 'var(--link, #5EEAD4)' }}>
              {label}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {badge}
          </div>
          {sub && (
            <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--text-label)' }}>
              {sub}
            </p>
          )}
        </div>
        {(headerRight || collapsible || expandable) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {headerRight && <span onClick={(e) => e.stopPropagation()}>{headerRight}</span>}
            {expandable && (
              <span
                className="p-1 transition-colors group-hover/hdr:opacity-100"
                style={{ color: isExpanded ? 'var(--link, #5EEAD4)' : 'var(--text-muted)' }}
                aria-hidden="true"
              >
                {isExpanded ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </span>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="p-1 -mr-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-expanded={open}
                aria-label={open ? 'Collapse chart' : 'Expand chart'}
              >
                <svg
                  width="11" height="11" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform duration-150"
                  style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Chart body — grows to fill the tile so same-row cards align */}
      {expanded && (
        <div className="px-3 pb-3 flex-1 min-h-0">
          {children}
        </div>
      )}

      {/* Footer note (data-honesty caveats) */}
      {expanded && footer && (
        <footer
          className="px-4 py-2 border-t shrink-0"
          style={{ borderColor: 'var(--cards-border)', background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {footer}
          </p>
        </footer>
      )}
    </article>
  )
}

// Shared chart-tooltip styling helpers — pass to Recharts <Tooltip>
// contentStyle / labelStyle so every chart has the same hover treatment.
export const CHART_TOOLTIP = {
  contentStyle: {
    background: 'var(--bg-surface, #182336)',
    border: '1px solid var(--hairline-teal, rgba(20,184,166,0.45))',
    borderRadius: 6,
    padding: '6px 10px',
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: 10,
    color: 'var(--text-primary, #F5F7FA)',
    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
  },
  labelStyle: {
    color: 'var(--text-label, #98A4B6)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontWeight: 600,
  },
  itemStyle: {
    color: 'var(--text-primary, #F5F7FA)',
    padding: 0,
  },
}

// Shared cartesian-grid + axis styling
export const CHART_AXIS = {
  tick: { fill: 'var(--text-label, #98A4B6)', fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' },
  axisLine: { stroke: 'var(--cards-border, #1F2A3D)' },
  tickLine: { stroke: 'var(--cards-border, #1F2A3D)' },
}

export const CHART_GRID_STROKE = 'rgba(255,255,255,0.06)'

// Small mono toggle/segmented-control used in chart header-right slots
// (e.g. the linear/log scale switch on the projects dot plot).
export function ChartToggle({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded overflow-hidden"
      style={{ border: '1px solid var(--cards-border, #1F2A3D)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="font-mono text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 transition-colors"
            style={{
              background: active ? 'var(--link-active-bg, rgba(20,184,166,0.18))' : 'transparent',
              color: active ? 'var(--link, #5EEAD4)' : 'var(--text-muted, #6C7A91)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
