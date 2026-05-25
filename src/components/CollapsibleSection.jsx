import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

// Collapsible Lens result section. The header mirrors SectionMarker (mono
// "§ NN · Label" + hairline rule + optional sublabel) with a chevron toggle.
//
// The body height animates via the CSS grid-template-rows 0fr↔1fr technique —
// NOT framer-motion height:auto. That distinction matters: the OOM landmine
// flagged in BUILD_LOG 2026-05-11 was framer's height:auto, which re-measures
// the subtree in a JS loop every frame. grid-rows is pure CSS — the compositor
// interpolates the track, no measurement, no re-render — so it animates open/
// close smoothly without the memory blowup.
//
// Body content is mount-gated by default: it mounts on open and unmounts after
// the close transition finishes, so heavy sections (comparable-deal tables)
// don't pay their render cost while collapsed. On a fresh Lens run every section
// is collapsed except the headline Market Position (defaultOpen).
//
// `keepMounted` opts a section OUT of unmount-on-collapse: the body stays in the
// DOM and only the grid collapses to 0fr. Use it for heavy, animation-rich
// sections that are open by default (e.g. Market Position) — re-opening them
// then doesn't re-mount the subtree and re-fire every entrance animation at
// once, which is what made the re-open feel laggy.
export default function CollapsibleSection({ index, label, sublabel, defaultOpen = false, keepMounted = false, dataTourId, children }) {
  const [open, setOpen] = useState(defaultOpen)                    // intent — drives chevron + aria
  const [expanded, setExpanded] = useState(defaultOpen)           // visual grid state (0fr/1fr)
  const [render, setRender] = useState(defaultOpen || keepMounted) // body present in the DOM
  const reduced = useReducedMotion()

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      // keepMounted: body is already in the DOM, so flip straight to 1fr.
      if (keepMounted) { setExpanded(true); return }
      setRender(true)
      if (reduced) setExpanded(true)
      // Two rAFs so the browser paints the 0fr state before we flip to 1fr —
      // otherwise it mounts already-expanded and there's no transition.
      else requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)))
    } else {
      setExpanded(false)        // animate 1fr→0fr; unmount onTransitionEnd (unless keepMounted)
      if (!keepMounted && reduced) setRender(false)
    }
  }

  const handleTransitionEnd = (e) => {
    if (keepMounted) return
    if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && !expanded) {
      setRender(false)
    }
  }

  return (
    <section className="mt-8" data-tour-id={dataTourId}>
      <button
        type="button"
        onClick={toggle}
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
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </button>

      <div
        className="grid"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: reduced ? 'none' : `grid-template-rows 0.34s ${EASE}`,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          className="overflow-hidden"
          style={{
            opacity: expanded ? 1 : 0,
            transition: reduced ? 'none' : `opacity 0.28s ${EASE}`,
          }}
        >
          {render && children}
        </div>
      </div>
    </section>
  )
}
