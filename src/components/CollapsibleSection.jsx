import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

// Collapsible Lens result section. The header mirrors SectionMarker (mono
// "§ NN · Label" + hairline rule + optional sublabel) with a chevron toggle;
// the body is CONDITIONALLY RENDERED (never height-auto — that animation is the
// OOM landmine flagged in BUILD_LOG 2026-05-11) and fades in/out on toggle.
//
// On a fresh Lens run every section is collapsed except the headline Market
// Position (defaultOpen). Collapsing unmounts the body, so heavy sections
// (maps, comparable-deal tables) don't pay their render cost until opened.
export default function CollapsibleSection({ index, label, sublabel, defaultOpen = false, dataTourId, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const reduced = useReducedMotion()

  return (
    <section className="mt-8" data-tour-id={dataTourId}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 mb-4 text-left group/sec cursor-pointer focus-visible:outline-none"
      >
        <span
          className="text-[11px] font-bold tracking-[0.20em] uppercase shrink-0 transition-colors group-hover/sec:text-teal-700"
          style={{ color: '#0F1A2E', fontFamily: MONO }}
        >
          {index != null ? `§ ${String(index).padStart(2, '0')} · ` : ''}{label}
        </span>
        <div className="flex-1 h-px transition-colors group-hover/sec:bg-teal-200" style={{ background: '#E2E8F0' }} />
        {sublabel && (
          <span
            className="text-[10px] tracking-[0.18em] uppercase shrink-0 hidden sm:inline"
            style={{ color: '#94A3B8', fontFamily: MONO }}
          >
            {sublabel}
          </span>
        )}
        <motion.span
          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors group-hover/sec:border-teal-300 group-hover/sec:text-teal-700"
          style={{ borderColor: '#E2E8F0', color: '#5A6B7A' }}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
