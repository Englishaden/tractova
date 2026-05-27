import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * LampContainer — a dramatic overhead spotlight cone that expands on
 * mount. Two angled gradient panels overlap at the top of the section
 * to form a cone shape; a horizontal teal line + radial bloom anchor
 * the "lamp base." Children render below the cone.
 *
 * Used as the §6 final CTA wrapper so the closing moment feels
 * cinematic — gives the page a clear visual "capstone." The cone
 * height + bloom intensity are tuned to read at 1280-1920px desktop
 * widths; on narrow viewports the conical mask shrinks but still
 * works.
 *
 * Props:
 *   - className — applied to the outer section (background lives here)
 *   - children  — rendered above the lamp effect, z-10
 */
export function LampContainer({ className, children }) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div aria-hidden="true" className="absolute inset-0 flex items-start justify-center pointer-events-none">
        {/* Left cone gradient — rotates from upper-left toward center */}
        <motion.div
          initial={{ opacity: 0.3, width: '8rem' }}
          whileInView={{ opacity: 1, width: '28rem' }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.2 }}
          style={{
            background:
              'conic-gradient(from 70deg at center top, #14B8A6 0deg, transparent 60deg)',
          }}
          className="absolute top-0 right-1/2 h-72 origin-top-right rotate-[18deg] blur-xl"
        />
        {/* Right cone gradient — mirror */}
        <motion.div
          initial={{ opacity: 0.3, width: '8rem' }}
          whileInView={{ opacity: 1, width: '28rem' }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.2 }}
          style={{
            background:
              'conic-gradient(from 290deg at center top, transparent 300deg, #14B8A6 360deg)',
          }}
          className="absolute top-0 left-1/2 h-72 origin-top-left -rotate-[18deg] blur-xl"
        />
        {/* Horizontal bright line — the lamp filament */}
        <motion.div
          initial={{ width: '4rem', opacity: 0.6 }}
          whileInView={{ width: '20rem', opacity: 1 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.3 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-[#5EEAD4] shadow-[0_0_24px_#5EEAD4]"
        />
        {/* Radial bloom directly under the filament */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.4 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-[28rem] -translate-y-1/2 rounded-full bg-[#14B8A6] opacity-30 blur-3xl"
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
