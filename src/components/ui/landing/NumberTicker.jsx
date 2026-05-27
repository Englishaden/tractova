import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * NumberTicker — animates an integer from 0 to `value` once the element
 * enters the viewport. Single-frame requestAnimationFrame loop with an
 * easeOutCubic curve. Respects prefers-reduced-motion (jumps to final
 * value immediately). Tabular-nums so the digits don't jitter horizontally.
 *
 * Drop-in replacement for the older useCountUp hook — this version is a
 * self-contained component so we can swap it in inline rather than threading
 * a ref through every counter call-site.
 *
 * Props:
 *   - value: the target integer
 *   - durationMs: how long the count-up takes (default 1800)
 *   - className: passed straight through; pair with text-* sizing classes
 *   - prefix / suffix: optional strings rendered before/after the number
 */
export function NumberTicker({
  value = 0,
  durationMs = 1800,
  className,
  prefix = '',
  suffix = '',
  style,
}) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof value !== 'number' || Number.isNaN(value)) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }

    let rafId = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs)
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(Math.floor(value * eased))
        if (t < 1) rafId = requestAnimationFrame(tick)
        else setDisplay(value)
      }
      rafId = requestAnimationFrame(tick)
      io.disconnect()
    }, { rootMargin: '-5% 0px' })

    io.observe(el)
    return () => {
      io.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [value, durationMs])

  return (
    <span ref={ref} className={cn('tabular-nums', className)} style={style}>
      {prefix}{display}{suffix}
    </span>
  )
}
