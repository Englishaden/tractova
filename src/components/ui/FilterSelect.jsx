import { useState, useRef, useEffect } from 'react'

// FilterSelect — inline filter dropdown with the same custom-popup style as
// Search.jsx's FieldSelect, but sized for filter-bar contexts (smaller
// padding, single-line, no above-input label). Used in Library to replace
// the three native <select> elements (All States / All Tech / All Stages)
// that drifted from the rest of the app's polish.
//
// Visual parity with FieldSelect: same border, focus ring, popup shadow,
// hover state, checkmark on selected option. Smaller dimensions and an
// inline placeholder treatment because filter chips don't have a visible
// label above them — the placeholder IS the label when nothing is picked.
//
// Optional: per-option tooltip via `optionTooltips` map (used by tech-type
// filters where users may not know what BESS / Hybrid / etc. mean).
export default function FilterSelect({
  value,
  onChange,
  options,             // array of strings
  placeholder,         // shown when value is empty (e.g. 'All States')
  optionTooltips = {}, // { [optionValue]: string } — surfaces below the option label
  ariaLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const displayValue = value || placeholder
  const isPlaceholder = !value

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors bg-white border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 ${
          isPlaceholder
            ? 'text-gray-500 border-gray-200 hover:border-gray-300'
            : 'text-teal-700 border-teal-200 hover:border-teal-300'
        }`}
      >
        <span>{displayValue}</span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 top-full mt-1.5 min-w-full w-max bg-white border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
        >
          {/* "Clear" option — picks the empty/placeholder state */}
          <li
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false) }}
            className={`flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-colors border-b border-gray-100 ${
              isPlaceholder
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-500 hover:bg-primary-50 hover:text-primary-700'
            }`}
          >
            <span className={`w-3 h-3 shrink-0 ${isPlaceholder ? 'text-primary' : 'text-transparent'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
            {placeholder}
          </li>

          {options.map((opt) => {
            const tip = optionTooltips[opt]
            const selected = value === opt
            return (
              <li
                key={opt}
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false) }}
                className={`flex items-start gap-2 px-3 py-2 text-[11px] cursor-pointer transition-colors ${
                  selected
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                }`}
              >
                <span className={`w-3 h-3 shrink-0 mt-0.5 ${selected ? 'text-primary' : 'text-transparent'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block">{opt}</span>
                  {tip && (
                    <span className="block text-[10px] text-gray-400 leading-snug mt-0.5">{tip}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
