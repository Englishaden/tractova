import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * AnimatedTooltip — wraps a trigger element; on hover shows a small
 * tooltip card with motion-based pop-in. Generic version (not the
 * avatar-list demo from Aceternity) — we use it on data-source pills
 * and the pillar weight chips where the trigger isn't an image.
 *
 * Props:
 *   - label    — required string, shown bold on the tooltip
 *   - sublabel — optional string, shown muted below the label
 *   - placement — 'top' (default) | 'bottom'
 *   - className — applied to the trigger wrapper
 *   - children  — the trigger content
 */
export function AnimatedTooltip({
  label,
  sublabel,
  placement = 'top',
  className,
  children,
}) {
  const [open, setOpen] = useState(false)
  const isTop = placement === 'top'

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className={cn('relative inline-flex', className)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.95 }}
            animate={{ opacity: 1, y: isTop ? -8 : 8, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 4 : -4, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn(
              'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-2 text-xs shadow-lg ring-1',
              'bg-[#0F1A2E] text-white ring-white/10',
              isTop ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            <div className="font-semibold tracking-tight">{label}</div>
            {sublabel && (
              <div className="mt-0.5 text-[10px] text-white/55 font-normal tracking-normal">
                {sublabel}
              </div>
            )}
            {/* arrow */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-[#0F1A2E]',
                isTop ? '-bottom-1' : '-top-1',
              )}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
