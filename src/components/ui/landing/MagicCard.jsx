import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * MagicCard — a card with a cursor-tracked radial gradient. The
 * gradient color and size are configurable; opacity fades when the
 * cursor leaves. Pair with any background — works on both light and
 * dark surfaces because the gradient color is explicitly passed.
 *
 * Props:
 *   - gradientColor — CSS color (default '#5EEAD4' teal)
 *   - gradientSize  — radius in px (default 280)
 *   - gradientOpacity — peak gradient alpha 0–1 (default 0.18)
 *   - className     — applied to the card
 *   - children
 */
export function MagicCard({
  gradientColor = '#5EEAD4',
  gradientSize = 280,
  gradientOpacity = 0.18,
  className,
  children,
  ...rest
}) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mc-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--mc-y', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn('relative isolate overflow-hidden rounded-2xl', className)}
      {...rest}
    >
      {/* Cursor-tracked radial fill. Pure inline style so the consumer
          can pass any gradientColor at runtime without losing Tailwind
          JIT class generation. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(${gradientSize}px circle at var(--mc-x, 50%) var(--mc-y, 50%), ${gradientColor}, transparent 70%)`,
          opacity: active ? gradientOpacity : 0,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
