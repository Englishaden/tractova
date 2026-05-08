import { useState, useRef, useEffect } from 'react'
import allCounties from '../data/allCounties.json'

// Shared style constant — mirrors the inputCls const in src/pages/Search.jsx
// so the open-state input visually matches the MW field in the same form.
const inputCls = "w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none"

// ─────────────────────────────────────────────────────────────────────────────
// Searchable county combobox
// ─────────────────────────────────────────────────────────────────────────────
export default function CountyCombobox({ stateId, value, onValueChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // allCounties keys are state abbreviations → string[]
  const counties = allCounties[stateId] || []

  // Keep query in sync when parent resets value (e.g. state change)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = counties.filter(name =>
    name.toLowerCase().includes(query.toLowerCase())
  )

  const handleInput = (e) => {
    setQuery(e.target.value)
    onValueChange(e.target.value)
    if (!open) setOpen(true)
  }

  const handleSelect = (name) => {
    setQuery(name)
    onValueChange(name)
    setOpen(false)
  }

  const disabled = !stateId
  const placeholder = disabled ? 'Select a state first' : 'Search counties…'

  return (
    <div
      ref={containerRef}
      onClick={() => { if (!disabled && !open) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
      className={`bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs relative transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5 flex items-center gap-1.5 pointer-events-none select-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        County
      </p>

      {/* Closed: mimic FieldSelect display row. Open: show text input */}
      <div className="flex items-center justify-between gap-1 py-0.5">
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search counties…"
            disabled={disabled}
            required
            onClick={(e) => e.stopPropagation()}
            className={inputCls + ' flex-1'}
          />
        ) : (
          <span className={`text-sm pointer-events-none select-none ${query ? 'text-gray-900' : 'text-gray-400'}`}>
            {query || placeholder}
          </span>
        )}
        <svg
          className="pointer-events-none shrink-0 text-gray-400 transition-transform duration-150"
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Hidden input for form validation when open=false and no value yet */}
      <input type="text" value={value} onChange={() => {}} required className="sr-only" tabIndex={-1} />

      {open && stateId && (
        <ul className="absolute z-50 left-0 top-full mt-2 w-full bg-white border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}>
          {filtered.length > 0 ? filtered.map(name => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(name) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary ${
                value === name ? 'bg-primary-50 text-primary font-medium' : 'text-gray-800'
              }`}
            >
              {name}
            </li>
          )) : (
            <li className="px-3 py-2 text-xs text-gray-400 italic">No matching county</li>
          )}
        </ul>
      )}
    </div>
  )
}
