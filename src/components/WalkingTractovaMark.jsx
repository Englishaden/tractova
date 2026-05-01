import { useEffect, useState, useRef } from 'react'

// Peeking Tractova mark — the brand logo pops in from one edge of the
// screen, hovers in place for a few seconds with a gentle bob + tilt + glow
// pulse (like it's curiously looking around), then slides back out the
// same edge. Stays within ~60px of the screen edge throughout — never
// crosses the page or competes with content.
//
// Frequency: once per browser session via sessionStorage. The user won't
// see it more than once no matter how many times they hit Profile or run
// a Lens query in the same session. Resets when they close the tab.
//
// Surfaces (per user direction):
//   - Profile (renders always; gated by sessionStorage flag)
//   - Lens loading state (renders during search; same flag)
//
// Test escape hatch: append `?walk=1` to any URL to force the animation
// to fire regardless of session flag. Useful for QA + showing it off.

const SESSION_KEY = 'tractova-walking-mark-shown-v3'

export default function WalkingTractovaMark({ enabled = true, delayMs = 2000 }) {
  const [active, setActive] = useState(false)
  // Side + vertical position randomized per appearance so the cameo
  // doesn't feel mechanical. Captured in a ref so re-renders during the
  // animation don't change them mid-flight.
  const config = useRef({
    side: Math.random() < 0.5 ? 'left' : 'right',
    topPct: 38 + Math.random() * 28,  // 38-66vh — anchored mid-page area
  })
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
      // Set the session flag only when the mark actually starts. If the
      // component unmounts before the timeout fires, the flag stays unset
      // and the next visit gets a fresh chance.
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

  const { side, topPct } = config.current

  return (
    <>
      <style>{`
        /* Peek in from the LEFT edge: slide from -60px (off-screen) to 12px
           (just inside the edge), hold there, slide back out. */
        @keyframes tractova-peek-left {
          0%   { transform: translateX(-60px); opacity: 0; }
          12%  { transform: translateX(12px);  opacity: 1; }
          88%  { transform: translateX(12px);  opacity: 1; }
          100% { transform: translateX(-60px); opacity: 0; }
        }
        /* Peek in from the RIGHT edge: mirror of the above. */
        @keyframes tractova-peek-right {
          0%   { transform: translateX(60px);  opacity: 0; }
          12%  { transform: translateX(-12px); opacity: 1; }
          88%  { transform: translateX(-12px); opacity: 1; }
          100% { transform: translateX(60px);  opacity: 0; }
        }
        /* Inner float: gentle vertical bob + slight tilt back-and-forth so
           the mark reads as "curiously looking around" rather than static.
           Independent cycle (1.6s) layered over the peek-in/out (7s) for
           organic motion. */
        @keyframes tractova-float-bob {
          0%, 100% { transform: translateY(0)    rotate(-3deg); }
          25%      { transform: translateY(-3px) rotate(2deg);  }
          50%      { transform: translateY(0)    rotate(-2deg); }
          75%      { transform: translateY(-3px) rotate(3deg);  }
        }
        /* Pulsing teal halo emanation — separate cycle so the breath
           doesn't sync with the bob. */
        @keyframes tractova-float-glow {
          0%, 100% { filter: drop-shadow(0 0 8px  rgba(20,184,166,0.45)); }
          50%      { filter: drop-shadow(0 0 18px rgba(20,184,166,0.80)); }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="fixed pointer-events-none"
        style={{
          [side]: 0,
          top: `${topPct}vh`,
          // z-index 110 sits above both normal page content (z<100) and the
          // LensOverlay's dark backdrop (z=100). pointer-events:none ensures
          // it never blocks interactions despite being topmost.
          zIndex: 110,
          animation: `${side === 'left' ? 'tractova-peek-left' : 'tractova-peek-right'} 7s ease-in-out forwards`,
          willChange: 'transform, opacity',
        }}
      >
        {/* Float-bob wrapper: gentle vertical bob + slight tilt */}
        <div
          style={{
            animation: 'tractova-float-bob 1.6s ease-in-out infinite',
            transformOrigin: 'center bottom',
          }}
        >
          {/* Glow-pulse wrapper: pulsing teal halo on independent cycle */}
          <div
            style={{
              animation: 'tractova-float-glow 2.4s ease-in-out infinite',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 26 26" style={{ overflow: 'visible' }}>
              <rect width="26" height="26" rx="5" fill="#0F1A2E" />
              <rect x="5"     y="7"   width="16"  height="2.5" rx="1.25" fill="#14B8A6" />
              <rect x="11.75" y="9.5" width="2.5" height="10"  rx="1.25" fill="#14B8A6" />
              <rect x="6"     y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
              <rect x="19.2"  y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}
