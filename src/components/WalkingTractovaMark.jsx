import { useEffect, useState, useRef } from 'react'

// Tractova-mark cameo — pops in from one randomized edge of the screen,
// hovers in place with one of four randomized animation sets, then slides
// back out the same edge. Each appearance is unique on two axes (entry
// side × in-place animation), so different sessions feel different rather
// than playing the same canned moment over and over.
//
// Frequency: once per browser session via sessionStorage. Survives across
// Profile + Lens loading; first surface to fire wins. Resets on tab close.
//
// Test escape hatch: append `?walk=1` to any URL to bypass the session gate
// and re-trigger as many times as you want (great for QA / showing it off).
//
// Surfaces: Profile + Lens loading overlay only. Off-stage from decision-
// grade surfaces (Compare, MemoView, Admin) where users may be screensharing.

const SESSION_KEY = 'tractova-walking-mark-shown-v4'

// ── Entry sides ─────────────────────────────────────────────────────────────
// Each side defines: anchor edge, a positioning band on the perpendicular
// axis, and the keyframe animation name that handles enter/hold/exit.
const SIDES = [
  { name: 'left',   anchor: { left: 0 },    perpAxis: 'top',  perpRange: [30, 70], keyframe: 'tractova-peek-from-left'   },
  { name: 'right',  anchor: { right: 0 },   perpAxis: 'top',  perpRange: [30, 70], keyframe: 'tractova-peek-from-right'  },
  { name: 'top',    anchor: { top: 0 },     perpAxis: 'left', perpRange: [20, 70], keyframe: 'tractova-peek-from-top'    },
  { name: 'bottom', anchor: { bottom: 0 },  perpAxis: 'left', perpRange: [20, 70], keyframe: 'tractova-peek-from-bottom' },
]

// ── In-place animation sets ─────────────────────────────────────────────────
// Each set defines: the inner-wrapper animation that plays during the hover
// phase + an optional sonar overlay (rendered when ringEmitter is true).
//
// All sets are halo-glow-friendly so the mark always feels alive; what
// differs is the body motion vocabulary (bob/tilt vs spin vs still vs nod).
const ANIMATION_SETS = [
  {
    name: 'curious-peek',
    bob:   'tractova-bob-curious 1.6s ease-in-out infinite',
    glow:  'tractova-glow-pulse 2.4s ease-in-out infinite',
    ringEmitter: false,
  },
  {
    name: 'spin-inspect',
    // Spin replaces the bob so the mark continuously rotates. Glow underlies.
    bob:   'tractova-spin-inspect 5s linear infinite',
    glow:  'tractova-glow-pulse 2.4s ease-in-out infinite',
    ringEmitter: false,
  },
  {
    name: 'sonar-pulse',
    // Mark stays mostly still (slight scale-up to feel "active"). The radar
    // rings are the action — rendered as overlay <span>s with their own keyframes.
    bob:   'tractova-bob-static 4s ease-in-out infinite',
    glow:  'tractova-glow-pulse 2.4s ease-in-out infinite',
    ringEmitter: true,
  },
  {
    name: 'subtle-wave',
    // Three gentle tilt cycles, no flares — reads like a small hello-nod.
    bob:   'tractova-wave-subtle 1.8s ease-in-out infinite',
    glow:  'tractova-glow-pulse 2.4s ease-in-out infinite',
    ringEmitter: false,
  },
]

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function WalkingTractovaMark({ enabled = true, delayMs = 2000 }) {
  const [active, setActive] = useState(false)

  // Both random picks captured on first render via useRef so re-renders
  // during the animation can never change the side or animation set
  // mid-flight (would cause visual jumps).
  const config = useRef({
    side:    pickRandom(SIDES),
    setVar:  pickRandom(ANIMATION_SETS),
    perpPos: 0,  // populated below once we know the perp range
  })
  // Compute random perp position once.
  if (config.current.perpPos === 0) {
    const [min, max] = config.current.side.perpRange
    config.current.perpPos = min + Math.random() * (max - min)
  }

  const triggered = useRef(false)

  useEffect(() => {
    if (!enabled || triggered.current) return

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return
    }

    const forceShow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('walk') === '1'

    if (!forceShow) {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === '1') {
          console.debug('[WalkingTractovaMark] already shown this session; append ?walk=1 to retest')
          return
        }
      } catch { /* fall through */ }
    }

    triggered.current = true
    const t = setTimeout(() => {
      // Set the session flag only when the mark actually starts. Prevents
      // the once-per-session quota from being silently consumed by a brief
      // mount that never reached the visible state.
      if (!forceShow) {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* best-effort */ }
      }
      setActive(true)
    }, delayMs)
    return () => clearTimeout(t)
  }, [enabled, delayMs])

  // Auto-cleanup after the cameo completes — removes the element from the
  // DOM so it can't accidentally interfere with anything else.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(false), 7500)  // 7s cameo + 500ms buffer
    return () => clearTimeout(t)
  }, [active])

  if (!active) return null

  const { side, setVar, perpPos } = config.current

  return (
    <>
      <style>{`
        /* ── Entry/exit keyframes (one per side) ─────────────────────────
           Each side's keyframe slides the mark in from off-screen to a
           hover position 12px inside the edge, holds during the in-place
           phase (between 12% and 88% of the 7s cycle), then slides back
           out the same edge. Opacity fades in/out at the bookends. */
        @keyframes tractova-peek-from-left {
          0%   { transform: translateX(-60px); opacity: 0; }
          12%  { transform: translateX(12px);  opacity: 1; }
          88%  { transform: translateX(12px);  opacity: 1; }
          100% { transform: translateX(-60px); opacity: 0; }
        }
        @keyframes tractova-peek-from-right {
          0%   { transform: translateX(60px);  opacity: 0; }
          12%  { transform: translateX(-12px); opacity: 1; }
          88%  { transform: translateX(-12px); opacity: 1; }
          100% { transform: translateX(60px);  opacity: 0; }
        }
        @keyframes tractova-peek-from-top {
          0%   { transform: translateY(-60px); opacity: 0; }
          12%  { transform: translateY(12px);  opacity: 1; }
          88%  { transform: translateY(12px);  opacity: 1; }
          100% { transform: translateY(-60px); opacity: 0; }
        }
        @keyframes tractova-peek-from-bottom {
          0%   { transform: translateY(60px);  opacity: 0; }
          12%  { transform: translateY(-12px); opacity: 1; }
          88%  { transform: translateY(-12px); opacity: 1; }
          100% { transform: translateY(60px);  opacity: 0; }
        }

        /* ── In-place body animations (one per animation set) ─────────────
           These run on the inner wrapper while the outer wrapper handles
           the slide-in/out. Each loops continuously through the visible
           phase of the cameo. */
        @keyframes tractova-bob-curious {
          0%, 100% { transform: translateY(0)    rotate(-3deg); }
          25%      { transform: translateY(-3px) rotate(2deg);  }
          50%      { transform: translateY(0)    rotate(-2deg); }
          75%      { transform: translateY(-3px) rotate(3deg);  }
        }
        @keyframes tractova-spin-inspect {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes tractova-bob-static {
          /* Sonar Pulse — mark scales up subtly as if "powering on" while
             the rings emanate. Almost imperceptible motion on the body
             itself, deliberately, so the rings carry the visual interest. */
          0%, 100% { transform: scale(1.0); }
          50%      { transform: scale(1.06); }
        }
        @keyframes tractova-wave-subtle {
          /* Slow, gentle tilt cycles — not a wave, more like a small nod
             of acknowledgment. ±7° range, 1.8s per cycle. */
          0%, 100% { transform: rotate(-7deg); }
          50%      { transform: rotate(7deg);  }
        }

        /* ── Halo glow — shared across all animation sets ─────────────── */
        @keyframes tractova-glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 8px  rgba(20,184,166,0.45)); }
          50%      { filter: drop-shadow(0 0 18px rgba(20,184,166,0.80)); }
        }

        /* ── Sonar Pulse rings ──────────────────────────────────────────
           Three concentric rings expand from the mark's center on staggered
           delays. Each scales from 1.0 to 2.6 and fades opacity 0.55 → 0
           over 1.6s. Loops infinitely; the cameo unmount stops them. */
        @keyframes tractova-sonar-ring {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0.55; }
          80%  { opacity: 0.06; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="fixed pointer-events-none"
        style={{
          ...side.anchor,
          [side.perpAxis]: `${perpPos}vh`,
          // z-index 110 sits above both normal page content (z<100) and the
          // LensOverlay's dark backdrop (z=100). pointer-events:none ensures
          // it never blocks interactions despite being topmost.
          zIndex: 110,
          animation: `${side.keyframe} 7s ease-in-out forwards`,
          willChange: 'transform, opacity',
        }}
      >
        {/* Body-motion wrapper: runs the chosen in-place animation. */}
        <div
          style={{
            animation: setVar.bob,
            transformOrigin: 'center center',
          }}
        >
          {/* Glow wrapper: pulsing halo, independent cycle. */}
          <div
            style={{
              animation: setVar.glow,
              position: 'relative',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 26 26" style={{ overflow: 'visible', display: 'block' }}>
              <rect width="26" height="26" rx="5" fill="#0F1A2E" />
              <rect x="5"     y="7"   width="16"  height="2.5" rx="1.25" fill="#14B8A6" />
              <rect x="11.75" y="9.5" width="2.5" height="10"  rx="1.25" fill="#14B8A6" />
              <rect x="6"     y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
              <rect x="19.2"  y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
            </svg>

            {/* Sonar rings — only rendered when this animation set is
                "sonar-pulse". Three rings on staggered delays so the
                emanation feels continuous rather than staccato. */}
            {setVar.ringEmitter && (
              <>
                {[0, 0.55, 1.1].map((delay, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1.5px solid rgba(20,184,166,0.65)',
                      transform: 'translate(-50%, -50%)',
                      animation: `tractova-sonar-ring 1.65s ease-out infinite`,
                      animationDelay: `${delay}s`,
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
