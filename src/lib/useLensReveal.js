import { useEffect } from 'react'

// Scroll-linked, reversible reveal for the Lens § sections (.lens-reveal).
//
// JS-driven on purpose: the CSS `animation-timeline: view()` approach is the
// "purest" (compositor) but isn't supported in Safari / older Chromium yet, so
// for many people it silently does nothing. This hook works in every browser.
// It only writes opacity + transform (compositor-cheap), batched in a single
// rAF off a passive scroll listener, so it stays smooth at the display's
// refresh rate.
//
// Each section fades + rises in as it enters the viewport and fades + sinks out
// as it leaves — reversible in both scroll directions. While a section sits in
// the comfortable middle of the screen it's full-opacity + crisp (readable).
// Respects prefers-reduced-motion (leaves everything static + visible).
//
// `active` flips true once the report (and its .lens-reveal nodes) is in the
// DOM so the hook can find + drive them.
export function useLensReveal(active) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined

    const els = Array.from(document.querySelectorAll('.lens-reveal'))
    if (!els.length) return undefined
    els.forEach((el) => { el.style.willChange = 'opacity, transform' })

    const FADE = 0.21  // fraction of each section's pass spent fading in / out
    const RISE = 42    // px of travel
    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight || document.documentElement.clientHeight
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const p = (vh - r.top) / (r.height + vh)  // 0 entering bottom → 1 exited top
        let o = 1
        let ty = 0
        if (p <= 0) { o = 0; ty = RISE }
        else if (p >= 1) { o = 0; ty = -RISE }
        else if (p < FADE) { const t = p / FADE; o = t; ty = RISE * (1 - t) }
        else if (p > 1 - FADE) { const t = (p - (1 - FADE)) / FADE; o = 1 - t; ty = -RISE * t }
        el.style.opacity = String(Math.round(o * 1000) / 1000)
        el.style.transform = ty ? `translateY(${ty.toFixed(1)}px)` : 'none'
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      els.forEach((el) => { el.style.opacity = ''; el.style.transform = ''; el.style.willChange = '' })
    }
  }, [active])
}
