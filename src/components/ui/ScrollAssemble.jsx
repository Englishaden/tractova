import { createContext, useEffect, useId, useRef } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  animate,
} from 'motion/react'

// Shared assemble progress (0 = scattered grain, 1 = fully assembled). Any
// descendant can ride it — e.g. WordsReveal on the headline, so the words
// re-gather in lockstep with the panel. null when not inside a ScrollAssemble.
export const AssembleContext = createContext(null)

// Scroll-scrubbed "grain coalesce" — the signature opening beat for the Lens
// result, modeled on the Huly hero where the UI/data materialises out of a
// pixelated haze. The REAL content (gauge, scores, headline) is displaced by
// fractal-noise (reads as drifting static), blurred and dimmed while scattered,
// then gathers into a crisp picture as it settles in the upper viewport.
//
//   - Fully reversible: scrubbing back up re-scatters it; coming back down
//     re-assembles. Progress is locked to scroll position, not a fixed timer.
//   - An intro tween plays the assemble ONCE on mount, so the report visibly
//     "forms" the moment the analysis lands.
//   - Crispness + perf: the SVG filter is detached entirely (filter:none) once
//     assembled, so the resting report carries no filter layer over dense text.
//
// Reduced-motion renders children plain — no filter, no scrub, no intro.
export default function ScrollAssemble({ children, className, introDelay = 0 }) {
  const reduce = useReducedMotion()
  const hostRef = useRef(null)
  const dispRef = useRef(null)
  const blurRef = useRef(null)
  const filterId = `assemble-${useId().replace(/:/g, '')}`

  // 0 while the block sits at the top of the viewport, → 1 as it scrolls up and
  // out the top. Inverted so "in place" = assembled, "scrolled away" = scattered.
  const { scrollYProgress } = useScroll({ target: hostRef, offset: ['start start', 'end start'] })
  const scrollAssembled = useTransform(scrollYProgress, [0, 0.6], [1, 0], { clamp: true })

  // Intro gate — assemble once on mount. `introDelay` lets a caller hold the
  // grain-gather until a covering element (e.g. the Lens "analyzing" overlay)
  // has cleared, so the materialise actually plays in view rather than behind it.
  const intro = useMotionValue(0)
  useEffect(() => {
    if (reduce) { intro.set(1); return }
    const controls = animate(intro, 1, { duration: 1.7, delay: introDelay, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [reduce, intro, introDelay])

  const assembled = useTransform(() => intro.get() * scrollAssembled.get())
  const scattered = useTransform(assembled, (v) => 1 - v)
  // Keep a high opacity floor so the displaced content stays VISIBLE while
  // scattered — the point is to watch grain/static gather into the picture, not
  // fade up from black. Floor lifts fast so it's legible almost immediately.
  const opacity = useTransform(assembled, [0, 1], [0.4, 1])
  const noiseOpacity = useTransform(scattered, [0, 1], [0, 0.65])
  // Detach the filter once assembled → crisp text + no filter cost at rest.
  const filter = useTransform(scattered, (v) => (v < 0.012 ? 'none' : `url(#${filterId})`))

  // Drive the SVG displacement + blur imperatively (cheap, zero React renders).
  const apply = (v) => {
    dispRef.current?.setAttribute('scale', String(v * 34))
    blurRef.current?.setAttribute('stdDeviation', String(v * 4))
  }
  useMotionValueEvent(scattered, 'change', apply)
  useEffect(() => { apply(scattered.get()) }, [scattered])

  if (reduce) {
    return (
      <AssembleContext.Provider value={null}>
        <div className={className}>{children}</div>
      </AssembleContext.Provider>
    )
  }

  return (
    <div ref={hostRef} className={className}>
      <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feGaussianBlur ref={blurRef} in="disp" stdDeviation="0" />
        </filter>
      </svg>

      <AssembleContext.Provider value={assembled}>
        <motion.div className="relative" style={{ opacity, filter, willChange: 'filter, opacity' }}>
          {children}
          {/* Drifting-static overlay — fades out as the picture gathers. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: noiseOpacity,
              mixBlendMode: 'overlay',
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </motion.div>
      </AssembleContext.Provider>
    </div>
  )
}
