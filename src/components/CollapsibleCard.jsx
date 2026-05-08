import { useState } from 'react'
import { motion } from 'motion/react'

// V3.1: Whole-card collapsible wrapper for the 3 main Lens cards
// (SC / IX / Offtake). Header (eyebrow + title + caption) always
// visible and clickable. Body animates height open/close. Default
// state is expanded so first impression is unchanged; users can
// collapse to compress the layout. items-start on the parent grid
// keeps heights independent so a collapsed card doesn't stretch.
export default function CollapsibleCard({
  accentColor,
  eyebrow,
  title,
  caption,
  defaultExpanded = false,
  children,
}) {
  const [open, setOpen] = useState(defaultExpanded)
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full text-left px-5 pt-4 pb-3 transition-colors hover:bg-gray-50/50 focus:outline-hidden focus-visible:bg-gray-50/80"
        style={{ borderBottom: open ? '1px solid #F3F4F6' : '1px solid transparent' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: accentColor }}>
                {eyebrow}
              </p>
            )}
            <h3 className="font-serif text-xl font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
              {title}
            </h3>
            {caption && (
              <p className="font-mono text-[10px] text-gray-400 tracking-wide mt-0.5">
                {caption}
              </p>
            )}
          </div>
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? accentColor : '#94A3B8'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 mt-1.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </div>
      </button>
      <motion.div
        initial={false}
        animate={open ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: 'hidden' }}
      >
        {children}
      </motion.div>
    </section>
  )
}
