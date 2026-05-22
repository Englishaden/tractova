import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useScroll, useTransform, useMotionValue, useMotionValueEvent, animate } from 'motion/react'
import { domToCanvas } from 'modern-screenshot'

// ScrollAssemble — pixel-particle "gather" reveal, modeled on the Huly hero
// Aden flagged: the panel breaks into tiles that flow in from the screen edges
// and gather to fill the image, then disperse back out as you scroll up.
//
// How it works:
//   1. The live §01 DOM is snapshotted once (modern-screenshot → canvas; works
//      with Tailwind v4 oklch + the SVG gauge because it renders via the
//      browser, not a CSS reimplementation).
//   2. The snapshot is diced into a grid of pixel-tiles. Each tile starts off
//      the nearest screen edge (left/right) with vertical jitter + a random
//      per-tile delay → "smooth chaotic" inflow, and lerps to its home cell.
//   3. A single `progress` (0 = scattered off the sides, 1 = assembled) drives
//      every tile. It's `intro × scrollPosition`, so it plays once on load AND
//      is fully reversible on scroll — scrub up and the tiles fly back out.
//   4. Once assembled we show the real (crisp, interactive) DOM and hide the
//      canvas, crossfaded so any snapshot/live mismatch is invisible.
//
// Canvas drawImage of the tiles is far cheaper than the per-frame SVG filter
// the first take used — that recompute was the lag. If the snapshot ever fails
// we just show the DOM (graceful). Reduced-motion → plain children.

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)

export default function ScrollAssemble({ children, className }) {
  const reduce = useReducedMotion()
  const hostRef = useRef(null)
  const contentRef = useRef(null)
  const canvasRef = useRef(null)
  const dataRef = useRef(null)                                  // {cell, csrc, w, h, src, tiles}
  const stateRef = useRef({ prog: 1, assembled: true, raf: 0 })
  const stopRef = useRef(null)
  const [assembled, setAssembled] = useState(true)             // true → live DOM visible

  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end start'] })
  const scrollAssembled = useTransform(scrollYProgress, [0, 0.6], [1, 0], { clamp: true })
  const intro = useMotionValue(reduce ? 1 : 0)

  const draw = () => {
    const d = dataRef.current, cv = canvasRef.current
    if (!d || !cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, d.w, d.h)
    const prog = stateRef.current.prog
    for (let i = 0; i < d.tiles.length; i++) {
      const t = d.tiles[i]
      const lp = Math.max(0, Math.min(1, (prog - t.off) / (1 - t.off)))
      if (lp <= 0) continue
      const e = easeOutCubic(lp)
      ctx.globalAlpha = lp < 0.85 ? lp : 1
      ctx.drawImage(d.src, t.sxi, t.syi, d.csrc, d.csrc,
        t.sx + (t.hx - t.sx) * e, t.sy + (t.hy - t.sy) * e, d.cell, d.cell)
    }
    ctx.globalAlpha = 1
  }

  const render = () => {
    stateRef.current.raf = 0
    const prog = (reduce ? 1 : intro.get()) * scrollAssembled.get()
    stateRef.current.prog = prog
    const asm = prog > 0.99
    if (asm !== stateRef.current.assembled) { stateRef.current.assembled = asm; setAssembled(asm) }
    if (!asm) draw()
  }
  const schedule = () => {
    if (!dataRef.current) return
    if (!stateRef.current.raf) stateRef.current.raf = requestAnimationFrame(render)
  }
  useMotionValueEvent(scrollAssembled, 'change', schedule)

  useEffect(() => {
    if (reduce) return undefined
    const el = contentRef.current
    if (!el) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const rect = el.getBoundingClientRect()
        const w = Math.round(rect.width), h = Math.round(rect.height)
        if (!w || !h) return
        const src = await domToCanvas(el, { scale: 1, font: false })
        if (cancelled) return
        buildTiles(src, w, h)
        sizeCanvas(w, h)
        schedule() // paint the scattered state immediately (held while the
                   // "analyzing" overlay finishes dismissing)…
        // …then play the full gather in view. delay ≈ overlay dismiss so the
        // dramatic edge-inflow isn't hidden behind the scrim.
        const controls = animate(intro, 1, { duration: 1.7, delay: 0.55, ease: [0.16, 1, 0.3, 1], onUpdate: schedule })
        stopRef.current = () => controls.stop()
      } catch {
        if (!cancelled) setAssembled(true) // graceful fallback → show DOM
      }
    }, 150)
    return () => { cancelled = true; clearTimeout(timer); stopRef.current?.(); cancelAnimationFrame(stateRef.current.raf) }
  }, [reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildTiles(src, w, h) {
    const cell = 26
    const sxScale = src.width / w           // source px per CSS px (handles dpr)
    const csrc = cell * sxScale
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell)
    const cx = w / 2
    const tiles = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = c * cell, hy = r * cell
        const fromLeft = (hx + cell / 2) < cx
        tiles.push({
          hx, hy,
          sx: fromLeft ? -(cell + Math.random() * 0.6 * w) : w + Math.random() * 0.6 * w,
          sy: hy + (Math.random() - 0.5) * h * 0.7,
          off: Math.random() * 0.4,        // per-tile stagger → chaotic gather
          sxi: c * csrc, syi: r * csrc,
        })
      }
    }
    dataRef.current = { cell, csrc, w, h, src, tiles }
  }

  function sizeCanvas(w, h) {
    const cv = canvasRef.current; if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    cv.style.width = `${w}px`; cv.style.height = `${h}px`
  }

  if (reduce) return <div className={className}>{children}</div>

  return (
    <div ref={hostRef} className={className} style={{ position: 'relative' }}>
      <div ref={contentRef} style={{ opacity: assembled ? 1 : 0, transition: 'opacity 160ms linear', pointerEvents: assembled ? 'auto' : 'none' }}>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: assembled ? 0 : 1, transition: 'opacity 160ms linear' }}
      />
    </div>
  )
}
