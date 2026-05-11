// Phase 0 — Standardized collapsible for nested / narrow contexts.
//
// `CollapsibleCard` is the heavy version (eyebrow + serif title + caption
// + accent rail) for the 3 main Lens pillar cards. `CollapsibleSubsection`
// is the lightweight sibling used INSIDE other sections — § 04 shadow
// pillar, § 05 sub-elements, drilldowns, anywhere a collapsible needs
// a smaller footprint without competing with the parent card chrome.
//
// 2026-05-11 — REWRITTEN: motion.div with `height: 'auto'` animation
// caused Chrome OOM crashes on the Lens results page when multiple
// instances wrapped heavy children (CsMarketPanel, 22+ row policy event
// list, ComparableDealsPanel) at the same time. The motion library has
// to synchronously measure all children to compute the target height,
// and stacking measures during the loading-screen → results-render swap
// blew the per-tab memory budget. Reverted to plain conditional render
// for the body — same end-state, no motion mount measurements.
//
// Chevron rotation animation stays (small SVG transform, cheap).
// a11y contract (aria-expanded + aria-controls + role="region") stays.

import { useId, useState } from 'react'
import { motion } from 'motion/react'

export default function CollapsibleSubsection({
  title,                          // ReactNode — typically <GlossaryLabel> or plain string
  description,                    // ReactNode — short context line beside the title
  countBadge,                     // ReactNode — optional badge on the right of the header text
  defaultOpen = false,
  borderLeft = null,              // CSS color string for an optional 3px left accent
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const headerId  = useId()

  const wrapperStyle = borderLeft
    ? { border: '1px solid #E2E8F0', borderLeft: `3px solid ${borderLeft}` }
    : { border: '1px solid #E2E8F0' }

  return (
    <div className={`bg-white rounded-lg overflow-hidden ${className}`} style={wrapperStyle}>
      <button
        id={headerId}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50/50 focus:outline-hidden focus-visible:bg-gray-50/80"
      >
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          {typeof title === 'string'
            ? <span className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0">{title}</span>
            : title}
          {description && (
            <span className="text-[11px] text-gray-500">
              {description}
              {countBadge && <> · {countBadge}</>}
            </span>
          )}
        </div>
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94A3B8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      {open && (
        <div id={contentId} role="region" aria-labelledby={headerId} className="border-t border-gray-100 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}
