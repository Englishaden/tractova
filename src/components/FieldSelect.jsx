import { useState, useRef, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Custom select dropdown (replaces native <select> for Stage + Technology)
// ─────────────────────────────────────────────────────────────────────────────
export default function FieldSelect({ label, labelIcon, value, onChange, options, placeholder, required, optionTooltips = {} }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div
      ref={ref}
      onClick={() => setOpen((o) => !o)}
      className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs cursor-pointer relative transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15"
    >
      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5 flex items-center gap-1.5 pointer-events-none select-none">
        {labelIcon}{label}
      </p>

      {/* Hidden native input for form validation */}
      <input type="text" value={value} onChange={() => {}} required={required} className="sr-only" tabIndex={-1} />

      {/* Display row */}
      <div className="flex items-center justify-between gap-1 text-sm py-0.5 pointer-events-none select-none">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <ul
          className="absolute z-50 left-0 top-full mt-2 w-full min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            opt === '---' ? (
              <li key="divider" className="px-3 py-1.5 pointer-events-none select-none">
                <div className="border-t border-gray-200" />
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mt-1.5">Other</p>
              </li>
            ) : (
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false) }}
              className={`flex items-start gap-2.5 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                value === opt
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
              }`}
            >
              <span className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${value === opt ? 'text-primary' : 'text-transparent'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block">{opt}</span>
                {optionTooltips[opt] && (
                  <span className="block text-[10px] text-gray-400 leading-snug mt-0.5">{optionTooltips[opt]}</span>
                )}
              </span>
            </li>
            )
          ))}
        </ul>
      )}
    </div>
  )
}
