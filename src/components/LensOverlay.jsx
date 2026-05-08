import { useState, useRef, useEffect } from 'react'
import WalkingTractovaMark from './WalkingTractovaMark'

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Lens fullscreen overlay — sun-fill animation shown while analyzing
// Progress fills slowly to 88% while waiting, then completes when API returns.
// Single pass only — never loops.
// ─────────────────────────────────────────────────────────────────────────────
// V3 §9.1 — Loading overlay rebuilt around the brand mark.
// Animations: scanline travels down the T's vertical stem (2.4s loop),
// the two survey baseline tick marks pulse in sequence (1.6s loop, staggered),
// and a thin teal halo arc fills counter-clockwise around the mark over 14s.
export const LENS_OVERLAY_STYLES = `
  @keyframes tractova-scan {
    0%, 100% { transform: translateY(0); opacity: 0; }
    20%      { opacity: 0.95; }
    50%      { transform: translateY(8px); opacity: 0.7; }
    80%      { opacity: 0.95; }
  }
  @keyframes tractova-tick-left {
    0%, 100% { opacity: 0.25; }
    20%, 50% { opacity: 1; }
  }
  @keyframes tractova-tick-right {
    0%, 100% { opacity: 0.25; }
    50%, 80% { opacity: 1; }
  }
  @keyframes tractova-glow {
    0%, 100% { filter: drop-shadow(0 0 14px rgba(20,184,166,0.35)); }
    50%      { filter: drop-shadow(0 0 22px rgba(20,184,166,0.65)); }
  }
`

export default function LensOverlay({ visible, stateName, countyName, onCancel }) {
  const HALO_R = 78
  const C = 2 * Math.PI * HALO_R  // halo circumference ≈ 489.97
  const [isShown, setIsShown] = useState(false)
  const arcRef  = useRef(null)
  const rafRef  = useRef(null)

  useEffect(() => {
    if (visible) {
      setIsShown(true)
      let startTs = null
      // Asymptotic progress: p = CEIL * (1 - exp(-elapsed / TAU))
      // CEIL = 95% — never reached, so the snap-to-100 on API completion
      //              always has 5+ points of headroom for a clean landing.
      // TAU  = 8000ms — calibrated against the ~15s typical Lens runtime.
      //              At 15s, p ≈ 79%; at 30s, p ≈ 93%; at ∞, p → 95.
      // The RAF loop never exits while visible, so the halo physically
      // cannot stall — even on a 60s slow run the arc keeps creeping
      // forward in tiny sub-pixel increments.
      const CEIL = 95
      const TAU  = 8000

      const tick = (ts) => {
        if (!startTs) startTs = ts
        const elapsed = ts - startTs
        const p = CEIL * (1 - Math.exp(-elapsed / TAU))
        if (arcRef.current) {
          arcRef.current.style.transition = 'none'
          arcRef.current.style.strokeDashoffset = C * (1 - p / 100)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
      if (arcRef.current) {
        arcRef.current.style.transition = 'stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)'
        arcRef.current.style.strokeDashoffset = 0
      }
      const dismissTimer = setTimeout(() => setIsShown(false), 750)
      return () => clearTimeout(dismissTimer)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isShown) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        // F.5 (2026-05-08): solid scrim, no backdrop-filter. iOS Safari
        // 15.0–15.3 has a known bug where backdrop-filter combined with
        // position:fixed + inset:0 can render the entire overlay invisible
        // (white-screens the whole Lens loader). Bumped opacity from 0.94
        // to 0.96 to compensate visually for the lost blur — same look,
        // bulletproof on every iOS.
        background: 'rgba(10,19,42,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
      }}
    >
      {/* Brand mark + halo (200x200 viewBox) */}
      <div style={{ animation: 'tractova-glow 3.2s ease-in-out infinite' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
          {/* Halo track (faint) */}
          <circle cx="100" cy="100" r={HALO_R} stroke="rgba(20,184,166,0.10)" strokeWidth="1.5" fill="none" />
          {/* Halo progress arc — RAF-driven, fills counter-clockwise */}
          <circle
            ref={arcRef}
            cx="100" cy="100" r={HALO_R}
            stroke="#14B8A6"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C}
            style={{ transformOrigin: '100px 100px', transform: 'rotate(-90deg)' }}
          />

          {/* The brand mark — scaled-up version of TractovaMark from Nav.
              Original viewBox is 26x26; centering at (100,100) with scale 4.6x
              puts mark from (40,40) to (160,160), 120x120. */}
          <g transform="translate(40, 40) scale(4.615)">
            {/* Rounded navy square background */}
            <rect width="26" height="26" rx="5" fill="#0F1A2E" />
            {/* Horizontal baseline of the T */}
            <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
            {/* Vertical stem (this is what the scanline travels through) */}
            <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
            {/* Survey tick marks — animated in sequence */}
            <rect x="6"   y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
              style={{ animation: 'tractova-tick-left 1.6s ease-in-out infinite' }} />
            <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
              style={{ animation: 'tractova-tick-right 1.6s ease-in-out infinite' }} />
          </g>

          {/* Scanline traveling down the T stem.
              In SVG coords (after the g transform), the stem runs roughly
              from (94,84) to (108,138) — 14px wide, 54px tall. The scanline
              is a thin teal-glow rect that translates down via CSS keyframe. */}
          <g style={{
            transformOrigin: '100px 100px',
            animation: 'tractova-scan 2.4s ease-in-out infinite',
          }}>
            <rect x="92" y="83" width="16" height="3"
              fill="#5EEAD4"
              style={{ filter: 'drop-shadow(0 0 4px rgba(94,234,212,0.85))' }} />
          </g>
        </svg>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
        <p style={{
          margin: 0,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: '#5EEAD4',
          fontFamily: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`,
        }}>
          Tractova Lens · Intelligence Fetch
        </p>
        {stateName && countyName ? (
          <p style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: `'Source Serif 4', 'Source Serif Pro', Georgia, serif`,
            letterSpacing: '-0.018em',
            lineHeight: 1.2,
          }}>
            Analyzing {stateName}&nbsp;·&nbsp;{countyName} County
          </p>
        ) : (
          <p style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: `'Source Serif 4', 'Source Serif Pro', Georgia, serif`,
            letterSpacing: '-0.018em',
          }}>
            Fetching market intelligence
          </p>
        )}
        <p style={{
          margin: 0,
          fontSize: '10px',
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.32)',
          fontFamily: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`,
        }}>
          Est. ~15s · Cancel anytime
        </p>
      </div>

      {/* Once-per-session walking brand-mark cameo — appears during the
          loading state ~2.5s after it opens, walks across the bottom of
          the screen, pauses briefly, walks off. Sessionstorage-gated so
          it only fires once per browser session. Honors prefers-reduced-
          motion. Renders here AND on Profile; whichever surface the user
          hits first that session gets the cameo. */}
      <WalkingTractovaMark />

      {/* Cancel button — V3 ghost-on-dark */}
      {visible && onCancel && (
        <button
          onClick={onCancel}
          style={{
            padding: '8px 22px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'all 150ms',
            fontFamily: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`,
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'rgba(20,184,166,0.45)'
            e.target.style.color = '#5EEAD4'
            e.target.style.background = 'rgba(20,184,166,0.08)'
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.15)'
            e.target.style.color = 'rgba(255,255,255,0.55)'
            e.target.style.background = 'rgba(255,255,255,0.04)'
          }}
        >
          Cancel · ESC
        </button>
      )}
    </div>
  )
}
