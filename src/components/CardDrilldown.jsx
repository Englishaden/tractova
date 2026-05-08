import { useState } from 'react'
import { motion } from 'motion/react'

// V3.1: Reusable expandable footer for the 3 main Lens cards (SC / IX / Offtake).
// Compact view never regresses -- this lives BELOW the existing card body.
// Click toggles a motion-animated drawer revealing methodology / sources /
// comparable benchmarks. Accent color matches each card's editorial eyebrow.
export default function CardDrilldown({ accentColor, label = 'Methodology & sources', children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full px-5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors hover:bg-gray-50/60 focus:outline-hidden focus-visible:bg-gray-50/80"
      >
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold transition-colors"
          style={{ color: open ? accentColor : '#5A6B7A' }}
        >
          {label}
        </span>
        <motion.svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? accentColor : '#94A3B8'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <motion.div
        initial={false}
        animate={open
          ? { height: 'auto', opacity: 1 }
          : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-5 pt-1 pb-4 space-y-3 text-[11px] text-gray-600 leading-snug">
          {children}
        </div>
      </motion.div>
    </div>
  )
}
