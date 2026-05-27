import { useEffect, useRef, useState } from 'react'

/**
 * useRevealOnScroll — attach `ref` to an element; the element gets a
 * `.is-revealed` class when it enters the viewport. Pair with the
 * `.reveal-on-scroll` CSS utility (in `src/index.css`) for the fade-up
 * entrance.
 *
 * Sourced from the Nixtio site teardown (research/2026-05-27-nixtio-teardown.md
 * § "AOS-style fade-up entrance"). Implemented in ~15 lines instead of
 * pulling the AOS library — same behavior, zero bundle cost.
 */
export function useRevealOnScroll() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-revealed')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '-8% 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/**
 * useCountUp — animate a number from 0 to `target` over `durationMs`
 * once the element enters the viewport. Returns `[value, ref]`.
 *
 * easeOutCubic gives the same "fast-then-decelerating" feel as Nixtio's
 * stat counters. Respects prefers-reduced-motion (jumps straight to the
 * final value).
 */
export function useCountUp(target, durationMs = 1600) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof target !== 'number' || Number.isNaN(target)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let rafId = 0
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs)
        const eased = 1 - Math.pow(1 - t, 3)
        setValue(Math.floor(target * eased))
        if (t < 1) rafId = requestAnimationFrame(tick)
        else setValue(target)
      }
      rafId = requestAnimationFrame(tick)
      io.disconnect()
    })
    io.observe(el)
    return () => {
      io.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [target, durationMs])
  return [value, ref]
}
