import { useState, useRef, useEffect, useMemo } from 'react'
import FilterSelect from '../ui/FilterSelect'
import LibraryToolbar from './LibraryToolbar'
import SpotlightCard from '../ui/SpotlightCard'
import TealRail from '../ui/TealRail'
import { axesFromTechnology } from '../../lib/lensFormConstants'
import { PIPELINE_STAGES } from './PipelineProgress'

// ── Library Command Bar — the single control surface (Pass 5, Wave 1) ────────
// Consolidates what used to be two separate strips (the filter+sort row and the
// view-mode toolbar) plus the new desktop free-text search and tag filter into
// one bar that sits directly above the project list. `savedViewsSlot` is a
// render slot so Wave 4's SavedViewsMenu plugs in without re-touching this file.
//
// NOTE (Wave 5): this bar is intentionally NOT sticky yet. Making it sticky
// requires re-coordinating top offsets with the Table view's own sticky column
// header and the bulk-ops bar; that layering is handled in the mobile-first /
// polish sweep, not here, to keep this consolidation low-risk.

const SORTS = [
  { key: 'saved',    label: 'Recent' },
  { key: 'score',    label: 'Score' },
  { key: 'mw',       label: 'MW' },
  { key: 'alerts',   label: 'Alerts' },
  { key: 'followup', label: 'Due' },
]

// Multi-select tag filter — mirrors FilterSelect's click-outside popup pattern,
// but options toggle (AND-match) instead of single-select-and-close. Hidden
// entirely until the portfolio actually has tags (migration 073 + Wave 2).
function TagFilter({ allTags, filterTags, setFilterTags }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc) }
  }, [open])

  if (!allTags.length) return null
  const active = filterTags.length > 0
  const toggle = (t) => setFilterTags(filterTags.includes(t) ? filterTags.filter(x => x !== t) : [...filterTags, t])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by tag"
        className={`flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors bg-white border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 ${
          active ? 'text-teal-700 border-teal-200 hover:border-teal-300' : 'text-gray-500 border-gray-200 hover:border-gray-300'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        <span>{active ? `${filterTags.length} tag${filterTags.length > 1 ? 's' : ''}` : 'Tags'}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 left-0 top-full mt-1.5 min-w-full w-max bg-white border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
        >
          {active && (
            <li
              onMouseDown={(e) => { e.preventDefault(); setFilterTags([]) }}
              className="px-3 py-2 text-[11px] cursor-pointer transition-colors border-b border-gray-100 text-gray-500 hover:bg-primary-50 hover:text-primary-700"
            >
              Clear tags
            </li>
          )}
          {allTags.map((t) => {
            const sel = filterTags.includes(t)
            return (
              <li
                key={t}
                role="option"
                aria-selected={sel}
                onMouseDown={(e) => { e.preventDefault(); toggle(t) }}
                className={`flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-colors ${sel ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'}`}
              >
                <span className={`w-3 h-3 shrink-0 ${sel ? 'text-primary' : 'text-transparent'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {t}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function LibraryCommandBar({
  projects,
  search, setSearch,
  filterState, setFilterState,
  filterStructure, setFilterStructure,
  filterStage, setFilterStage,
  filterTags, setFilterTags, allTags,
  sortBy, setSortBy,
  layout, onLayoutChange, count,
  activeFilterCount, onClearAll,
  savedViewsSlot = null,
  selectAllSlot = null,
}) {
  const stateOptions = useMemo(
    () => [...new Set(projects.map(p => p.state).filter(Boolean))].sort(),
    [projects],
  )
  const structureOptions = useMemo(
    () => [...new Set(projects.map(p => p.structure || axesFromTechnology(p.technology).structure).filter(Boolean))].sort(),
    [projects],
  )

  return (
    <SpotlightCard
      glow="rgba(20,184,166,0.10)"
      className="mb-3 rounded-xl border border-gray-200 px-3 py-2.5 flex flex-col gap-2.5"
      style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(15,26,46,0.05)' }}
    >
      <TealRail />

      {/* Row 1 — find & filter: search fills the row, filters sit to its right */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects by name, county, state, technology, or tag"
            className="text-[11px] rounded-lg pl-7 pr-7 py-1.5 bg-white border border-gray-200 text-ink placeholder:text-gray-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 focus:border-teal-300 w-full transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        <FilterSelect value={filterState} onChange={setFilterState} placeholder="All States" ariaLabel="Filter by state" options={stateOptions} />
        <FilterSelect value={filterStructure} onChange={setFilterStructure} placeholder="All Structures" ariaLabel="Filter by monetization structure" options={structureOptions} />
        <FilterSelect value={filterStage} onChange={setFilterStage} placeholder="All Stages" ariaLabel="Filter by stage" options={PIPELINE_STAGES} />
        <TagFilter allTags={allTags} filterTags={filterTags} setFilterTags={setFilterTags} />
        {savedViewsSlot}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-semibold text-gray-400 hover:text-teal-700 transition-colors px-1 shrink-0"
          >
            Clear all ✕
          </button>
        )}
      </div>

      {/* Row 2 — sort & view: select-all + sort on the left, layout toggle right.
          A hairline separates the two control zones. */}
      <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-gray-100">
        {selectAllSlot}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-medium text-gray-400">Sort:</span>
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className="text-[10px] font-semibold px-2 py-1 rounded-sm transition-colors"
              style={sortBy === s.key
                ? { background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.30)' }
                : { background: 'transparent', color: '#6B7280', border: '1px solid transparent' }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <LibraryToolbar layout={layout} onLayoutChange={onLayoutChange} count={null} />
        </div>
      </div>
    </SpotlightCard>
  )
}
