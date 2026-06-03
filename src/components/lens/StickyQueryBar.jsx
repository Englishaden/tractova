import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

// StickyQueryBar — once the Lens form scrolls out of view, a thin bar slides in
// under the nav carrying the active query (so you never lose context mid-report)
// plus quick "Edit" (jump back to the form) and "Re-run" actions. Tucks below
// the fixed h-14 nav (top-14) and under it in the stack (z-40 < nav z-50).
//
// Visibility is driven by an IntersectionObserver on the form element passed via
// `watchRef` — no scroll math, no thresholds to tune. Reduced-motion: appears
// without the slide.
export default function StickyQueryBar({ watchRef, summary, onEdit, onRerun, analyzing }) {
  const reduced = useReducedMotion()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = watchRef?.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [watchRef])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: -48, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: -48, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-14 left-0 right-0 z-40 border-b"
          style={{
            background: 'linear-gradient(90deg, #0F1A2E 0%, #0A132A 100%)',
            borderColor: 'rgba(20,184,166,0.25)',
          }}
        >
          <div className="max-w-dashboard mx-auto px-6 h-11 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold shrink-0" style={{ color: '#5EEAD4' }}>
                Lens
              </span>
              <span className="text-[9px] hidden sm:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
              <span className="font-mono text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.80)' }}>
                {summary}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold px-2.5 py-1 rounded-md transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                Edit ↑
              </button>
              <button
                type="button"
                onClick={onRerun}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-1 rounded-md transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)', color: '#FFFFFF' }}
              >
                {analyzing ? 'Running…' : 'Re-run'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
