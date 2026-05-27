import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * BackgroundBeams — diagonal light beams animated across a dark
 * section. Built from SVG paths (so they scale crisply) with a
 * stroke-dashoffset animation driving the "beam" travel + opacity
 * stagger. Drops into any relatively positioned dark container.
 *
 * The beams are intentionally subtle — they sit at ~12-18% opacity
 * against the section background and only the leading edge gets the
 * brighter teal pulse. Designed to give the §3 pillar-tabs section
 * its own bg signature distinct from the §1 hero grid.
 *
 * Props:
 *   - className — applied to the wrapper (positioning, masks)
 */
export function BackgroundBeams({ className }) {
  // Six paths spanning the section diagonally. Coordinates use a
  // wide viewBox so the beams traverse a long visual distance even
  // on narrow viewports.
  const beams = [
    { d: 'M-20 220 C 180 60, 420 140, 720 -40',  delay: 0.0, dur: 7.5 },
    { d: 'M-40 380 C 220 200, 460 280, 760 80',  delay: 1.1, dur: 8.6 },
    { d: 'M-30 540 C 200 360, 480 420, 780 200', delay: 0.4, dur: 9.4 },
    { d: 'M-10 700 C 240 520, 500 580, 800 360', delay: 1.8, dur: 8.0 },
    { d: 'M-50 860 C 220 680, 480 740, 780 540', delay: 0.7, dur: 9.8 },
    { d: 'M-20 1020 C 260 840, 520 900, 820 720', delay: 1.4, dur: 7.8 },
  ]

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        '[mask-image:radial-gradient(ellipse_at_center,_black_50%,_transparent_85%)]',
        className,
      )}
    >
      <svg
        viewBox="0 0 800 1080"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="beam-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#5EEAD4" stopOpacity="0"   />
            <stop offset="40%"  stopColor="#5EEAD4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0F766E" stopOpacity="0"   />
          </linearGradient>
        </defs>

        {beams.map((b, i) => (
          <g key={i} style={{ opacity: 0.55 }}>
            {/* Base stroke (always visible, very faint) */}
            <path
              d={b.d}
              stroke="#5EEAD4"
              strokeOpacity="0.10"
              strokeWidth="1"
              fill="none"
            />
            {/* Travelling bright segment */}
            <motion.path
              d={b.d}
              stroke="url(#beam-gradient)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="80 1200"
              initial={{ strokeDashoffset: 1280 }}
              animate={{ strokeDashoffset: -80 }}
              transition={{
                delay: b.delay,
                duration: b.dur,
                ease: 'linear',
                repeat: Infinity,
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
