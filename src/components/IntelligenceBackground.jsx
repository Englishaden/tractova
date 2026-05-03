import { useRef } from 'react'

// IntelligenceBackground — fixed-position background layer.
//
// Stacking strategy: this component renders inside a `relative` parent and
// uses `z-0` (NOT negative). The parent must NOT have a solid background
// color (e.g. remove `bg-surface`) so this layer paints visibly. The page
// main content sits at `relative z-10` above this layer.
//
// Layers:
//   1. Edge wash radial gradients — soft teal blooms with off-canvas centers
//      pulling visual weight to the gutters; static.
//   2. Cartographic parcel grid — 32px grid masked to LEFT and RIGHT
//      gutters via mask-image so it frames the centered content; static.
//   3. Floating accent dots — 8 dots in the pillar-color palette (teal /
//      amber / blue / light-teal). Each picks a random START EDGE on mount
//      and drifts toward the OPPOSITE edge. Constellation regenerates per
//      page load. Wrapper is gutter-masked so dots fade through the
//      center reading column rather than passing across content.
//   4. Tractova T Easter egg — the brand mark drifts across the page on
//      one of 6 randomized paths per page session (4 cardinal + 2 diagonal).
//      90s cycle so it stays a rare appearance. Same gutter mask as dots.
//
// (The previous "slow-flowing teal band" layer was removed — too heavy
// at the top of the screen, distracted from reading content.)
//
// All layers are pure CSS (GPU-accelerated, zero JS work per frame).
// Honors `prefers-reduced-motion` (animations disabled, washes preserved).

// ── Pillar-color palette for accent dots ────────────────────────────────────
// Each color maps to one of the platform's intelligence pillars so the
// rising/drifting dots quietly signal "all three pillars processing."
const DOT_COLORS = [
  { color: '#14B8A6', glow: 'rgba(20,184,166,0.65)'  }, // teal · offtake
  { color: '#F59E0B', glow: 'rgba(245,158,11,0.55)'  }, // amber · IX
  { color: '#2563EB', glow: 'rgba(37,99,235,0.55)'   }, // blue · site
  { color: '#5EEAD4', glow: 'rgba(94,234,212,0.65)'  }, // light teal accent
]

// ── Dot drift directions (one per start edge) ──────────────────────────────
// Each variant defines: which edge the dot starts on, the perpendicular-
// axis position style, and the keyframe animation that drifts it across.
const DOT_DRIFT_VARIANTS = {
  bottom: { keyframe: 'tractova-drift-up',    posStyle: { bottom: '-12px' }, posKey: 'left' },
  top:    { keyframe: 'tractova-drift-down',  posStyle: { top:    '-12px' }, posKey: 'left' },
  left:   { keyframe: 'tractova-drift-right', posStyle: { left:   '-12px' }, posKey: 'top'  },
  right:  { keyframe: 'tractova-drift-left',  posStyle: { right:  '-12px' }, posKey: 'top'  },
}

const DOT_EDGES = ['bottom', 'top', 'left', 'right']

function generateDotConstellation() {
  // 8 dots — randomized start edge, position on that edge, color from the
  // pillar palette, size, drift duration, and animation delay. Generated
  // once per page session via useRef so re-renders don't shuffle layout.
  return Array.from({ length: 8 }).map((_, i) => {
    const edge       = DOT_EDGES[Math.floor(Math.random() * DOT_EDGES.length)]
    const variant    = DOT_DRIFT_VARIANTS[edge]
    const posOnEdge  = 5 + Math.random() * 90  // 5-95% along the edge
    const colorPick  = DOT_COLORS[i % DOT_COLORS.length]  // round-robin so all 4 colors appear at least twice
    const size       = 3 + Math.floor(Math.random() * 3)  // 3-5px
    const durationS  = 24 + Math.random() * 18  // 24-42s
    const delayS     = Math.random() * 28       // 0-28s, so they don't all start together
    return { edge, variant, posOnEdge, ...colorPick, size, durationS, delayS }
  })
}

// ── Tractova T Easter-egg path variants ────────────────────────────────────
// 6 random path options. Each picks a starting edge + ending edge and a
// keyframe that translates between them. perpOffset varies the start point
// along the perpendicular axis so even the same direction looks different.
const T_PATH_VARIANTS = [
  { name: 'up',          keyframe: 'tractova-mark-up',          startStyle: (off) => ({ bottom: '-40px', left:  `calc(${off}% - 9px)` }) },
  { name: 'down',        keyframe: 'tractova-mark-down',        startStyle: (off) => ({ top:    '-40px', left:  `calc(${off}% - 9px)` }) },
  { name: 'left-right',  keyframe: 'tractova-mark-leftright',   startStyle: (off) => ({ left:   '-40px', top:   `calc(${off}% - 9px)` }) },
  { name: 'right-left',  keyframe: 'tractova-mark-rightleft',   startStyle: (off) => ({ right:  '-40px', top:   `calc(${off}% - 9px)` }) },
  { name: 'diag-up-r',   keyframe: 'tractova-mark-diag-up-r',   startStyle: (off) => ({ bottom: '-40px', left:  `calc(${off}% - 9px)` }) },
  { name: 'diag-up-l',   keyframe: 'tractova-mark-diag-up-l',   startStyle: (off) => ({ bottom: '-40px', right: `calc(${off}% - 9px)` }) },
]

export default function IntelligenceBackground() {
  // Both random selections captured on mount via useRef so the constellation
  // and T path are stable for the page session. User can refresh Profile to
  // reroll.
  const dots    = useRef(generateDotConstellation())
  const tPath   = useRef(T_PATH_VARIANTS[Math.floor(Math.random() * T_PATH_VARIANTS.length)])
  const tOffset = useRef(15 + Math.random() * 70)  // 15-85% along the perpendicular axis

  return (
    <>
      <style>{`
        /* ── Layer 3: dot drift (one keyframe per direction) ──────────── */
        @keyframes tractova-drift-up {
          0%   { transform: translateY(0)     translateX(0); opacity: 0; }
          10%  { opacity: 0.55; }
          50%  { opacity: 0.75; }
          90%  { opacity: 0.55; }
          100% { transform: translateY(-110vh) translateX(8px); opacity: 0; }
        }
        @keyframes tractova-drift-down {
          0%   { transform: translateY(0)     translateX(0); opacity: 0; }
          10%  { opacity: 0.55; }
          50%  { opacity: 0.75; }
          90%  { opacity: 0.55; }
          100% { transform: translateY(110vh) translateX(-6px); opacity: 0; }
        }
        @keyframes tractova-drift-right {
          0%   { transform: translateX(0)    translateY(0); opacity: 0; }
          10%  { opacity: 0.55; }
          50%  { opacity: 0.75; }
          90%  { opacity: 0.55; }
          100% { transform: translateX(110vw) translateY(-6px); opacity: 0; }
        }
        @keyframes tractova-drift-left {
          0%   { transform: translateX(0)     translateY(0); opacity: 0; }
          10%  { opacity: 0.55; }
          50%  { opacity: 0.75; }
          90%  { opacity: 0.55; }
          100% { transform: translateX(-110vw) translateY(6px);  opacity: 0; }
        }

        /* ── Layer 4: Tractova T path keyframes ───────────────────────────
           Each is 90s. Visible drift ~30s (15%–60% of the cycle), hidden
           gap ~32s (60%–100% + 0%–10%). Same opacity shape across all
           variants so the "rare appearance" feel is consistent. */
        @keyframes tractova-mark-up {
          0%   { transform: translateY(0);      opacity: 0; }
          10%  { transform: translateY(-10vh);  opacity: 0; }
          15%  { transform: translateY(-15vh);  opacity: 0.55; }
          60%  { transform: translateY(-95vh);  opacity: 0.65; }
          68%  { transform: translateY(-110vh); opacity: 0; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
        @keyframes tractova-mark-down {
          0%   { transform: translateY(0);      opacity: 0; }
          10%  { transform: translateY(10vh);   opacity: 0; }
          15%  { transform: translateY(15vh);   opacity: 0.55; }
          60%  { transform: translateY(95vh);   opacity: 0.65; }
          68%  { transform: translateY(110vh);  opacity: 0; }
          100% { transform: translateY(110vh);  opacity: 0; }
        }
        @keyframes tractova-mark-leftright {
          0%   { transform: translateX(0);      opacity: 0; }
          10%  { transform: translateX(10vw);   opacity: 0; }
          15%  { transform: translateX(15vw);   opacity: 0.55; }
          60%  { transform: translateX(95vw);   opacity: 0.65; }
          68%  { transform: translateX(110vw);  opacity: 0; }
          100% { transform: translateX(110vw);  opacity: 0; }
        }
        @keyframes tractova-mark-rightleft {
          0%   { transform: translateX(0);      opacity: 0; }
          10%  { transform: translateX(-10vw);  opacity: 0; }
          15%  { transform: translateX(-15vw);  opacity: 0.55; }
          60%  { transform: translateX(-95vw);  opacity: 0.65; }
          68%  { transform: translateX(-110vw); opacity: 0; }
          100% { transform: translateX(-110vw); opacity: 0; }
        }
        @keyframes tractova-mark-diag-up-r {
          0%   { transform: translate(0, 0);                 opacity: 0; }
          10%  { transform: translate(8vw, -10vh);           opacity: 0; }
          15%  { transform: translate(12vw, -15vh);          opacity: 0.55; }
          60%  { transform: translate(75vw, -95vh);          opacity: 0.65; }
          68%  { transform: translate(90vw, -110vh);         opacity: 0; }
          100% { transform: translate(90vw, -110vh);         opacity: 0; }
        }
        @keyframes tractova-mark-diag-up-l {
          0%   { transform: translate(0, 0);                  opacity: 0; }
          10%  { transform: translate(-8vw, -10vh);           opacity: 0; }
          15%  { transform: translate(-12vw, -15vh);          opacity: 0.55; }
          60%  { transform: translate(-75vw, -95vh);          opacity: 0.65; }
          68%  { transform: translate(-90vw, -110vh);         opacity: 0; }
          100% { transform: translate(-90vw, -110vh);         opacity: 0; }
        }

        /* ── Mark pulse (independent of path) ────────────────────────── */
        @keyframes tractova-mark-pulse {
          0%, 100% { transform: scale(1.0);  filter: drop-shadow(0 0 6px rgba(20,184,166,0.40)); }
          50%      { transform: scale(1.08); filter: drop-shadow(0 0 14px rgba(20,184,166,0.85)); }
        }

        @media (prefers-reduced-motion: reduce) {
          .intel-dot,
          .intel-mark-egg { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      >
        {/* Layer 1 — soft edge washes (radial gradients off-canvas) */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 80% at -10% 30%, rgba(20,184,166,0.10) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 110% 70%, rgba(45,212,191,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 90% 50% at 50% -10%, rgba(94,234,212,0.06) 0%, transparent 70%)
            `,
          }}
        />

        {/* Layer 2 — cartographic parcel grid in gutters only */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(15,118,110,0.07) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(15,118,110,0.07) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)',
            maskImage:       'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        {/* Layers 3 + 4 wrapper — gutter mask so dots and the Tractova T
            never pass through the central reading column. Mask is fully
            opaque on the outer 22% of each side and transparent in the
            inner 30-70% band, with smooth gradient transitions in between.
            The dot/T animations remain identical; the mask just hides them
            mid-drift rather than truncating the keyframe. */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,1) 82%, rgba(0,0,0,1) 100%)',
            maskImage:       'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,1) 82%, rgba(0,0,0,1) 100%)',
          }}
        >
        {/* Layer 3 — randomized constellation of pillar-color accent dots.
            Each dot picks an edge + position + drift direction on mount;
            the configuration is stable per page session (refresh to reroll).
            Distributed across all 4 edges instead of clustered in gutters. */}
        {dots.current.map((d, i) => {
          // Position style: edge anchor + perpendicular-axis percentage.
          const posStyle = { ...d.variant.posStyle, [d.variant.posKey]: `${d.posOnEdge}%` }
          return (
            <span
              key={i}
              className="intel-dot absolute rounded-full"
              style={{
                ...posStyle,
                width: `${d.size}px`,
                height: `${d.size}px`,
                background: d.color,
                boxShadow: `0 0 ${d.size * 3}px ${d.glow}`,
                animation: `${d.variant.keyframe} ${d.durationS}s linear infinite`,
                animationDelay: `${d.delayS}s`,
              }}
            />
          )
        })}

        {/* Layer 4 — Tractova T Easter egg on a randomized 90s path. Path
            and start position picked once at mount (refresh Profile to
            reroll). Two animations stacked: outer wrapper drifts via the
            path keyframe (90s), inner SVG pulses scale + halo (2.4s,
            independent). */}
        <div
          className="intel-mark-egg absolute"
          style={{
            ...tPath.current.startStyle(tOffset.current),
            width: '18px',
            height: '18px',
            animation: `${tPath.current.keyframe} 90s ease-in-out infinite`,
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              animation: 'tractova-mark-pulse 2.4s ease-in-out infinite',
              transformOrigin: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 26 26" fill="none">
              <rect width="26" height="26" rx="5" fill="#0F1A2E" />
              <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
              <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
              <rect x="6" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
              <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
            </svg>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
