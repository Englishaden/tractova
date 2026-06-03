import { useState, useEffect, useRef } from 'react'

// CopyButton — copies `value` to the clipboard and shows a brief inline
// confirmation (glyph swaps to a check + "Copied" for ~1.4s). Reusable across
// surfaces (Lens run-id masthead, Library rows, Glossary terms). Presentational
// and reduced-motion-safe: the feedback is a content swap + colour change, not
// motion, so it reads identically with reduced motion on.
//
// Pass `value` (string to copy) and an a11y `label`. Optional `children`
// override the default glyph; `className` styles the button.
export default function CopyButton({ value, label = 'Copy', className = '', children }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard unavailable (insecure context / denied) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied to clipboard' : label}
      className={`inline-flex items-center gap-1 transition-colors ${className}`}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        children || (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )
      )}
    </button>
  )
}
