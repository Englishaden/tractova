import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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

const SIZE_BUCKETS = [
  { id: '0-2',   label: '0–2 MW',   min: 0, max: 2 },
  { id: '2-5',   label: '2–5 MW',   min: 2, max: 5 },
  { id: '5-10',  label: '5–10 MW',  min: 5, max: 10 },
  { id: '10-20', label: '10–20 MW', min: 10, max: 20 },
]

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

// UtilityCombobox — searchable typeahead dropdown for the Utility/Source
// filter. Replaces the browser-native <datalist> which rendered OS-styled
// (white-on-white) and ignored the dark scope. Built on @radix-ui/react-popover
// so it inherits Radix's portal + focus-trap + outside-click + Esc handling.
//
// Behavior:
//   - Input click → opens the dropdown (full list)
//   - Typing → filters the list (case-insensitive substring)
//   - Click an option → sets value, closes
//   - Esc / outside click → closes
//   - Empty list message when no matches
function UtilityCombobox({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const inputRef = useRef(null)

  // Mirror external value (e.g. "Clear all" sets value='') back into the
  // input. Skipped when the user is actively typing so we don't fight them.
  const valueRef = useRef(value)
  if (valueRef.current !== value && document.activeElement !== inputRef.current) {
    valueRef.current = value
    if (query !== value) setQuery(value || '')
  }

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return options.slice(0, 50) // cap for perf
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50)
  }, [options, query])

  const handleSelect = (opt) => {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // Live-filter the consumer (Intelligence Feed) — substring match
              onChange(e.target.value)
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type to filter…"
            className="w-full rounded text-[11px] px-2 py-1.5 pr-6 focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--cards-border)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--hairline-teal)' }}
            onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--cards-border)' }}
          />
          {(query || value) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
              aria-label="Clear utility filter"
              tabIndex={-1}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        {/* Popover content — Aden 2026-05-28 callout: previous dark
            cards-bg looked "literally black." Switched to a light-card-
            on-dark-page pattern (matches the tooltip vocabulary already
            used elsewhere on the Dashboard: bright surface with dark
            text + teal accent border + soft shadow). Reads cleanly as
            a floating dropdown above the dark dashboard. */}
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="rounded-md z-[60] thin-scrollbar overflow-y-auto"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(20,184,166,0.45)',
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.55), 0 0 0 1px rgba(20,184,166,0.06)',
            width: 'var(--radix-popover-trigger-width)',
            maxHeight: '240px',
            color: '#0A1828',
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-2.5 py-3 text-center">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: '#5A6B7A' }}>
                {options.length === 0 ? 'Loading sources…' : 'No matches'}
              </span>
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((opt) => {
                const isActive = opt === value
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                      style={{
                        background: isActive ? 'rgba(20,184,166,0.12)' : 'transparent',
                        color: isActive ? '#0F766E' : '#0A1828',
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(20,184,166,0.08)'; e.currentTarget.style.color = '#0F766E' } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0A1828' } }}
                    >
                      {opt}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
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
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {count > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full font-mono text-[9px] font-bold tabular-nums"
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
  const navigate = useNavigate()

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

  const f = filters || { states: [], utility: '', stage: null, sizeBucket: null }

  const setStates    = (states)     => onChange({ ...f, states })
  const setUtility   = (utility)    => onChange({ ...f, utility })
  const setStage     = (stage)      => onChange({ ...f, stage })
  const setSize      = (sizeBucket) => onChange({ ...f, sizeBucket })

  const toggleState = (id) => {
    const current = new Set(f.states)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setStates(Array.from(current))
  }

  const clearAll = () => onChange({ states: [], utility: '', stage: null, sizeBucket: null })

  const activeCount = (f.states.length > 0 ? 1 : 0) + (f.utility ? 1 : 0) + (f.stage ? 1 : 0) + (f.sizeBucket ? 1 : 0)

  const handleRunLens = () => {
    const params = new URLSearchParams()
    if (f.states.length === 1) params.set('state', f.states[0])
    if (f.stage) params.set('stage', f.stage)
    if (f.sizeBucket) {
      const bucket = SIZE_BUCKETS.find((b) => b.id === f.sizeBucket)
      if (bucket) params.set('mw', String((bucket.min + bucket.max) / 2))
    }
    navigate(params.toString() ? `/search?${params.toString()}` : '/search')
  }

  return (
    <aside
      className="rounded-md border border-[var(--cards-border)] flex flex-col h-full thin-scrollbar"
      style={{ background: 'var(--cards-bg)' }}
    >
      {/* Rail header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: 'var(--text-primary)' }}>
            Market Filters
          </span>
          {activeCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full font-mono text-[9px] font-bold tabular-nums"
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
            className="font-mono text-[9px] uppercase tracking-[0.18em] underline decoration-dotted hover:no-underline transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear
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

        {/* Size (MW) */}
        <FilterGroup
          label="Size (MW)"
          count={f.sizeBucket ? 1 : 0}
          open={openGroups.size}
          onToggle={() => toggle('size')}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {SIZE_BUCKETS.map((b) => {
              const active = f.sizeBucket === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSize(active ? null : b.id)}
                  className="rounded text-[10px] font-mono font-semibold tabular-nums px-1.5 py-1 transition-all"
                  style={{
                    background: active ? 'var(--link-active-bg)' : 'transparent',
                    border: `1px solid ${active ? 'var(--link-active-bg)' : 'var(--cards-border)'}`,
                    color: active ? '#FFFFFF' : 'var(--text-label)',
                  }}
                  data-active={active ? 'true' : 'false'}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[9px] leading-tight" style={{ color: 'var(--text-muted)' }}>
            Carries into /search as project MW.
          </p>
        </FilterGroup>
      </div>

      {/* Run a Lens CTA pinned to bottom (Image 1 reference) */}
      <div className="px-2 pt-2 pb-3 border-t border-[var(--cards-border)] shrink-0">
        <button
          type="button"
          onClick={handleRunLens}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md py-2 font-semibold text-[12px] transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
            color: '#FFFFFF',
            boxShadow: '0 4px 16px -4px rgba(20,184,166,0.45)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.65" y2="16.65" />
          </svg>
          Run a Lens
        </button>
        <p className="mt-1.5 text-[9px] leading-tight text-center" style={{ color: 'var(--text-muted)' }}>
          {activeCount > 0
            ? `Opens /search with ${activeCount} filter${activeCount === 1 ? '' : 's'} pre-applied`
            : 'Single-project deep-dive in the Lens'}
        </p>
      </div>
    </aside>
  )
}
