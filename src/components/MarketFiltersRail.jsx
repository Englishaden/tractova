import { useState, useMemo, useRef } from 'react'
import * as Popover from '@radix-ui/react-popover'

// MarketFiltersRail — left vertical rail on the revamped Dashboard.
//
// Modeled on Dashboard Example 1's "MARKET FILTERS" sidebar (State /
// Utility / Policy Stage / Size MW), with a "Run a Lens" CTA pinned
// to the bottom that carries the active filter set into /search.
//
// Filter integration (honest about what's actually wired in Ship 1):
//   • State    → REAL: filters USMap (fades non-matching) + IntelligenceFeed
//                (filters news items by stateIds intersection).
//   • Utility  → REAL: filters IntelligenceFeed by `source` substring match.
//   • Stage    → PASS-THROUGH to /search via querystring; no dashboard filter
//                (project stage doesn't map to dashboard data).
//   • Size MW  → PASS-THROUGH to /search via querystring; no dashboard filter
//                (project sizing is a per-project Lens input).
//
// This is the data-honest scoping: filters that genuinely refine what
// the Dashboard shows do so; filters that only make sense per-project
// open the Lens with those values pre-filled. Better than fake filters
// that look like they filter and don't.
//
// Mobile: collapses to a horizontal scroll drawer above the map (handled
// by Dashboard.jsx via the lg:hidden / lg:block split).

const POLICY_STAGES = [
  { id: 'prospecting',     label: 'Prospecting' },
  { id: 'site-control',    label: 'Site Control' },
  { id: 'pre-development', label: 'Pre-Development' },
  { id: 'development',     label: 'Development / NTP' },
  { id: 'construction',    label: 'Construction' },
]

// Discrete project sizes (MW). Aden 2026-05-29: the old 0–2 / 2–5 buckets
// only handed the Lens a bucket midpoint (1, 3.5, …) which felt arbitrary.
// Pick an exact MW (1–10) and that exact value flows into /search?mw=.
const SIZE_MW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function ChevronDown({ open }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="transition-transform duration-150 shrink-0"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// UtilityCombobox — click-to-open searchable dropdown for the Utility/Source
// filter, modeled on the Lens tab's CountyCombobox (Aden 2026-05-29:
// "should be a dropdown with search functionality like the county button on
// the lens tab… the options come up when you click in, then you have the
// option to type in the utility or scroll down").
//
// Built on @radix-ui/react-popover for portal + outside-click + Esc.
// Behavior:
//   - Closed state is a dropdown-looking button showing the current source
//     (or "All sources") — NOT a bare text field, so it doesn't read as
//     "type first."
//   - Click → opens, full list visible immediately, search input autofocused.
//   - Type → filters the list AND live-filters the Intelligence Feed
//     (substring match, same as the Lens county field commits as you type).
//   - Click an option → commits + closes.  Esc / outside click → closes.
//
// Dark theme (Aden 2026-05-29: "emulate the cards hover description whereby
// the background is a nice dark blue… text is a nice white"). Matches the
// TooltipContent vocabulary: #0A1828 navy surface, teal border, white ink.
function UtilityCombobox({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return options.slice(0, 120)
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 120)
  }, [options, query])

  const handleSelect = (opt) => {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-1.5 rounded text-[11px] px-2 py-1.5 transition-colors"
          style={{
            background: 'var(--bg-input)',
            border: `1px solid ${open ? 'var(--hairline-teal)' : 'var(--cards-border)'}`,
            color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          <span className="truncate text-left">{value || 'All sources'}</span>
          <span className="flex items-center gap-0.5 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                className="p-0.5 rounded-sm"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Clear utility filter"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </span>
            )}
            <ChevronDown open={open} />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Dark navy surface (#0A1828) + teal border + white ink — matches
            the card-hover tooltip vocabulary Aden referenced. */}
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 0) }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="rounded-md z-[60] overflow-hidden"
          style={{
            background: '#0A1828',
            border: '1px solid #14B8A6',
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.6)',
            width: 'var(--radix-popover-trigger-width)',
            color: '#FFFFFF',
          }}
        >
          {/* Search input */}
          <div className="p-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                onChange(e.target.value) // live-filter the Intelligence Feed (substring)
              }}
              placeholder="Search utilities…"
              className="w-full rounded text-[11px] px-2 py-1.5 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#FFFFFF',
              }}
            />
          </div>
          <ul className="py-1 max-h-[220px] overflow-y-auto thin-scrollbar">
            {/* All sources reset row */}
            <li>
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                style={{ color: !value ? '#5EEAD4' : 'rgba(255,255,255,0.85)', background: !value ? 'rgba(20,184,166,0.14)' : 'transparent' }}
                onMouseEnter={(e) => { if (value) e.currentTarget.style.background = 'rgba(20,184,166,0.12)' }}
                onMouseLeave={(e) => { if (value) e.currentTarget.style.background = 'transparent' }}
              >
                All sources
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-2.5 py-3 text-center">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {options.length === 0 ? 'Loading sources…' : 'No matches'}
                </span>
              </li>
            ) : filtered.map((opt) => {
              const isActive = opt === value
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      background: isActive ? 'rgba(20,184,166,0.18)' : 'transparent',
                      color: isActive ? '#5EEAD4' : 'rgba(255,255,255,0.85)',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(20,184,166,0.12)'; e.currentTarget.style.color = '#5EEAD4' } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' } }}
                  >
                    {opt}
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function FilterGroup({ label, count, open, onToggle, children }) {
  return (
    <div className="border-b border-[var(--cards-border)] last:border-none">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2.5 px-1 text-left transition-colors hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {count > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full font-mono text-[9px] font-bold tabular-nums shrink-0"
              style={{ background: 'var(--link-active-bg)', color: '#FFFFFF' }}
            >
              {count}
            </span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)' }}>
          <ChevronDown open={open} />
        </span>
      </button>
      {open && (
        <div className="pb-3 px-1 -mt-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

export default function MarketFiltersRail({
  stateProgramMap = {},
  newsSources = [],
  // Controlled filter state — lives in Dashboard.jsx; this rail emits onChange.
  filters,
  onChange,
}) {
  // Per-group disclosure. Default: State open (the most useful), others closed.
  const [openGroups, setOpenGroups] = useState({
    state:   true,
    utility: false,
    stage:   false,
    size:    false,
  })
  const toggle = (g) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }))

  // Sorted list of states with at least one program (active/limited/pending).
  const filterableStates = useMemo(() => {
    return Object.values(stateProgramMap || {})
      .filter((s) => s.csStatus && s.csStatus !== 'none')
      .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
  }, [stateProgramMap])

  // Unique news sources, sorted alpha. Used for the Utility typeahead.
  const sourceOptions = useMemo(() => {
    const set = new Set(newsSources.filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [newsSources])

  const f = filters || { states: [], utility: '', stage: null, mw: null }

  const setStates    = (states)  => onChange({ ...f, states })
  const setUtility   = (utility) => onChange({ ...f, utility })
  const setStage     = (stage)   => onChange({ ...f, stage })
  const setMw        = (mw)      => onChange({ ...f, mw })

  const toggleState = (id) => {
    const current = new Set(f.states)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setStates(Array.from(current))
  }

  const clearAll = () => onChange({ states: [], utility: '', stage: null, mw: null })

  const activeCount = (f.states.length > 0 ? 1 : 0) + (f.utility ? 1 : 0) + (f.stage ? 1 : 0) + (f.mw ? 1 : 0)

  return (
    <aside
      className="rounded-md border border-[var(--cards-border)] flex flex-col h-full thin-scrollbar"
      style={{ background: 'var(--cards-bg)' }}
    >
      {/* Rail header — two-row layout when filters are active, so the
          count chip + Clear link don't collide with the wrapping label
          on a 200px-wide rail (Aden 2026-05-28: "1 next to clear overlaps
          and looks ugly"). When no filters are active, single row. */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            Market Filters
          </span>
          {activeCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full font-mono text-[9px] font-bold tabular-nums shrink-0"
              style={{ background: 'var(--link-active-bg)', color: '#FFFFFF' }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] underline decoration-dotted hover:no-underline transition-colors whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter groups */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-2">
        {/* State */}
        <FilterGroup
          label="State"
          count={f.states.length}
          open={openGroups.state}
          onToggle={() => toggle('state')}
        >
          <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto thin-scrollbar pr-1">
            {filterableStates.map((s) => {
              const active = f.states.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleState(s.id)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-all"
                  style={{
                    background: active ? 'var(--link-active-bg)' : 'transparent',
                    border: `1px solid ${active ? 'var(--link-active-bg)' : 'var(--cards-border)'}`,
                    color: active ? '#FFFFFF' : 'var(--text-label)',
                  }}
                  data-active={active ? 'true' : 'false'}
                >
                  <span className="font-mono text-[10px] font-bold tabular-nums leading-none">{s.id}</span>
                </button>
              )
            })}
            {filterableStates.length === 0 && (
              <span className="text-[10px] italic" style={{ color: 'var(--text-disabled)' }}>
                Loading states…
              </span>
            )}
          </div>
        </FilterGroup>

        {/* Utility — Radix Popover combobox (2026-05-28 v2.5).
            Browser-native <datalist> rendered as a white-on-white dropdown
            in dark scope (no OS-level theming control). Custom combobox
            gives us full styling + keyboard nav + dark-themed list. */}
        <FilterGroup
          label="Utility / Source"
          count={f.utility ? 1 : 0}
          open={openGroups.utility}
          onToggle={() => toggle('utility')}
        >
          <UtilityCombobox
            value={f.utility}
            onChange={setUtility}
            options={sourceOptions}
          />
          <p className="mt-1.5 text-[9px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            Filters the Intelligence Feed by source name.
          </p>
        </FilterGroup>

        {/* Policy Stage */}
        <FilterGroup
          label="Policy Stage"
          count={f.stage ? 1 : 0}
          open={openGroups.stage}
          onToggle={() => toggle('stage')}
        >
          <div className="flex flex-col gap-1">
            {POLICY_STAGES.map((s) => {
              const active = f.stage === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStage(active ? null : s.id)}
                  className="w-full flex items-center justify-between rounded px-1.5 py-1 text-[11px] transition-colors"
                  style={{
                    background: active ? 'var(--link-bg)' : 'transparent',
                    color: active ? 'var(--link)' : 'var(--text-label)',
                  }}
                >
                  <span>{s.label}</span>
                  {active && (
                    <span style={{ color: 'var(--link)' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[9px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            Carries into /search · Lens runs scoped to stage.
          </p>
        </FilterGroup>

        {/* Size (MW) — discrete 1–10; the exact value flows into the Lens
            (via the state detail panel's Run-a-Lens) as ?mw=. */}
        <FilterGroup
          label="Size (MW)"
          count={f.mw ? 1 : 0}
          open={openGroups.size}
          onToggle={() => toggle('size')}
        >
          <div className="grid grid-cols-5 gap-1">
            {SIZE_MW_OPTIONS.map((v) => {
              const active = f.mw === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMw(active ? null : v)}
                  className="rounded text-[11px] font-mono font-semibold tabular-nums py-1 transition-all"
                  style={{
                    background: active ? 'var(--link-active-bg)' : 'transparent',
                    border: `1px solid ${active ? 'var(--link-active-bg)' : 'var(--cards-border)'}`,
                    color: active ? '#FFFFFF' : 'var(--text-label)',
                  }}
                  data-active={active ? 'true' : 'false'}
                >
                  {v}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[9px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            {f.mw ? `${f.mw} MW` : 'Project size (MW)'} · carries into the Lens when you open a state.
          </p>
        </FilterGroup>
      </div>
    </aside>
  )
}
