import { useEffect, useState, useRef } from 'react'

// WalkingTractovaMark — anthropomorphized brand mark with little legs that
// walks across the bottom of the screen, pauses briefly mid-page, then walks
// off. A rare moment of kindness for the developer using the product.
//
// Frequency: once per browser session, tracked via sessionStorage. The user
// won't see it more than once no matter how many times they hit Profile or
// run a Lens query in the same session. Resets when they close the tab.
//
// Surfaces (per user direction):
//   - Profile (renders always; gated by sessionStorage flag)
//   - Lens loading state (renders during search; same flag)
//
// Boundaries:
//   - Pointer-events: none (never blocks clicks)
//   - Honors prefers-reduced-motion (skips the walk entirely)
//   - z-20 (walks ON TOP of page content for full-screen visibility, but
//     non-interactive)
//   - 14s total animation duration: enter → walk to pause → pause → walk
//     to exit → fade off
//
// Composition: SVG built from the canonical Tractova mark (navy rounded
// square + teal lookup grid + center stem) plus two leg <rect>s that swing
// in opposing rotations via CSS keyframes. Body bobs vertically on the
// same 0.45s cadence so leg + body motion are synced like real walking.

// Versioned key — bumping the v## suffix invalidates any previously-set
// flags so existing users get to see the animation again after a refresh.
const SESSION_KEY = 'tractova-walking-mark-shown-v2'

export default function WalkingTractovaMark({ enabled = true, delayMs = 2500 }) {
  const [active, setActive] = useState(false)
  const triggered = useRef(false)

  useEffect(() => {
    if (!enabled || triggered.current) return

    // Honor reduced-motion preference — skip silently.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return
    }

    // ?walk=1 in the URL bypasses the once-per-session gate — useful for
    // testing the animation without having to clear sessionStorage manually.
    const forceShow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('walk') === '1'

    // Once-per-session gate. sessionStorage may be blocked (private mode,
    // some embedded contexts) — degrade silently if so (no-op, doesn't
    // crash the parent component).
    if (!forceShow) {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === '1') {
          console.debug('[WalkingTractovaMark] already shown this session; append ?walk=1 to retest')
          return
        }
      } catch { /* fall through; treat as not-yet-shown */ }
    }

    triggered.current = true

    // Small delay before triggering — feels more organic if it shows up a
    // few seconds AFTER page load rather than racing in alongside content.
    const t = setTimeout(() => {
      // Set the session flag ONLY when the mark actually starts walking,
      // not at component mount. Previous version set the flag on mount,
      // which meant any prior page visit (even one cancelled before the
      // 2.5s delay) would silently consume the once-per-session quota.
      if (!forceShow) {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* best-effort */ }
      }
      setActive(true)
    }, delayMs)
    return () => clearTimeout(t)
  }, [enabled, delayMs])

  // Auto-cleanup after the walk completes — removes the element from the
  // DOM so it can't accidentally interfere with anything else on the page.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(false), 14500)  // 14s walk + 500ms buffer
    return () => clearTimeout(t)
  }, [active])

  if (!active) return null

  return (
    <>
      <style>{`
        @keyframes tractova-walk-across {
          0%   { transform: translateX(-60px); opacity: 0; }
          5%   { transform: translateX(-30px); opacity: 1; }
          35%  { transform: translateX(40vw);  opacity: 1; }
          50%  { transform: translateX(40vw);  opacity: 1; }
          95%  { transform: translateX(110vw); opacity: 1; }
          100% { transform: translateX(110vw); opacity: 0; }
        }
        @keyframes tractova-body-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes tractova-leg-front {
          0%, 100% { transform: rotate(22deg); }
          50%      { transform: rotate(-22deg); }
        }
        @keyframes tractova-leg-back {
          0%, 100% { transform: rotate(-22deg); }
          50%      { transform: rotate(22deg); }
        }
        /* Pause-mid-walk: freeze the leg cycle during the pause segment of
           the walk-across keyframe. The body bob keeps going (subtle idle). */
        @keyframes tractova-leg-cycle {
          0%        { animation-play-state: running; }
          35%, 50%  { animation-play-state: paused;  }
          50.01%, 100% { animation-play-state: running; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="fixed pointer-events-none"
        style={{
          left: 0,
          bottom: '24px',
          // z-index 110 sits above both normal page content (z<100) and the
          // LensOverlay's dark backdrop (z=100), so the mark is visible on
          // either surface. pointer-events:none ensures it never blocks
          // interactions even though it's the topmost layer.
          zIndex: 110,
          animation: 'tractova-walk-across 14s ease-in-out forwards',
          willChange: 'transform, opacity',
        }}
      >
        {/* Body bob wrapper */}
        <div
          style={{
            animation: 'tractova-body-bob 0.45s ease-in-out infinite',
            transformOrigin: 'center bottom',
          }}
        >
          <svg width="28" height="38" viewBox="0 0 26 36" style={{ overflow: 'visible' }}>
            {/* Soft drop-shadow under the character */}
            <ellipse
              cx="13" cy="35" rx="9" ry="1.5"
              fill="rgba(15,23,42,0.18)"
              style={{ filter: 'blur(1px)' }}
            />

            {/* Back leg (rendered before body so it appears behind) */}
            <g
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
                animation: 'tractova-leg-back 0.45s ease-in-out infinite',
              }}
            >
              <rect x="14.5" y="25.5" width="3" height="7.5" rx="1.5" fill="#0A132A" />
            </g>

            {/* Body — canonical Tractova mark, slightly elevated to make
                room for legs at y=25-33. */}
            <g style={{ filter: 'drop-shadow(0 2px 3px rgba(20,184,166,0.18))' }}>
              <rect width="26" height="26" rx="5" fill="#0F1A2E" />
              <rect x="5"     y="7"   width="16"  height="2.5" rx="1.25" fill="#14B8A6" />
              <rect x="11.75" y="9.5" width="2.5" height="10"  rx="1.25" fill="#14B8A6" />
              <rect x="6"     y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
              <rect x="19.2"  y="10"  width="0.8" height="2"   rx="0.4"  fill="#14B8A6" opacity="0.6" />
            </g>

            {/* Front leg (rendered after body so it appears in front) */}
            <g
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 0%',
                animation: 'tractova-leg-front 0.45s ease-in-out infinite',
              }}
            >
              <rect x="8.5" y="25.5" width="3" height="7.5" rx="1.5" fill="#0F1A2E" />
            </g>
          </svg>
        </div>
      </div>
    </>
  )
}
