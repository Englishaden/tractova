import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * HoverBorderGradient — a wrapper whose border is a rotating conic
 * gradient. The rotation accelerates and the gradient brightens on
 * hover. Built as an outer wrapper that draws the gradient + an inner
 * element (the actual interactive surface) inset by 1px to leave the
 * gradient visible as a border.
 *
 * Props match the expected demo API:
 *   - containerClassName — applied to the outer wrapper (radius lives here)
 *   - className         — applied to the inner element
 *   - as                — inner element tag, defaults to 'button'
 *   - duration          — seconds per rotation when idle (default 3)
 *   - children          — content of the inner element
 */
export function HoverBorderGradient({
  containerClassName,
  className,
  as: Tag = 'button',
  duration = 3,
  children,
  ...rest
}) {
  const [hover, setHover] = useState(false)

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'relative inline-flex overflow-hidden p-px',
        containerClassName,
      )}
    >
      {/* Rotating conic gradient — sized to overflow the container so
          the band always reaches the edges as it spins. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-[-100%]"
        style={{
          background:
            'conic-gradient(from var(--angle, 0deg), transparent 0deg, transparent 70deg, #14B8A6 120deg, #5EEAD4 180deg, #14B8A6 240deg, transparent 290deg, transparent 360deg)',
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: hover ? duration * 0.45 : duration,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {/* Inner element. Inherits containerClassName's radius via `rounded-inherit`. */}
      <Tag
        {...rest}
        className={cn(
          'relative z-10 inline-flex items-center justify-center transition-colors',
          containerClassName?.includes('rounded-full') ? 'rounded-full' : 'rounded-[inherit]',
          className,
        )}
      >
        {children}
      </Tag>
    </span>
  )
}
