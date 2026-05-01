// IntelligenceBackground — fixed-position background layer for the Profile
// page (and reusable elsewhere). Three stacked, low-cost CSS layers create a
// "flowing intelligence platform" atmosphere without competing with the
// centered profile content for attention.
//
// Layers (back to front):
//   1. Edge wash — soft teal radial gradients with off-canvas centers, so
//      visual weight pulls toward the page gutters and leaves the center
//      bright/clean. Static.
//   2. Slow-flowing accent — a wide, low-opacity teal band that drifts
//      across the page over 90s. Almost imperceptible motion; reads as
//      ambient "data flow." Pure CSS keyframe (added inline so the
//      component is self-contained).
//   3. Cartographic grid — 32px parcel grid at very low opacity, masked to
//      only the LEFT and RIGHT 200px gutters via mask-image so it frames
//      the centered profile box without overlapping it. References the
//      survey/map vocabulary central to Tractova's brand.
//
// All layers are CSS-only (GPU-accelerated, zero JS work per frame). Sits
// at -z-10 behind the page content; content z-index needs no change.
//
// `prefers-reduced-motion`: animations are disabled via media query so
// users with motion sensitivity see only the static washes.
export default function IntelligenceBackground() {
  return (
    <>
      {/* Inline style for the keyframe + mask logic. Kept here (not in
          index.css) so the component is fully self-contained and can be
          dropped in or removed without touching global CSS. */}
      <style>{`
        @keyframes tractova-intel-flow {
          0%   { transform: translateX(-50%); opacity: 0.0; }
          15%  { opacity: 0.55; }
          50%  { opacity: 0.65; }
          85%  { opacity: 0.55; }
          100% { transform: translateX(50%); opacity: 0.0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .intel-flow-band { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      >
        {/* Layer 1 — soft edge washes (radial gradients off-canvas) */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 80% at -10% 30%, rgba(20,184,166,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 110% 70%, rgba(45,212,191,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 90% 50% at 50% -10%, rgba(94,234,212,0.05) 0%, transparent 70%)
            `,
          }}
        />

        {/* Layer 2 — slow flowing teal band, gravitates left→right over 90s.
            Positioned just below the nav so it grazes the top edge of the
            content area. Very low opacity so it never fights the profile. */}
        <div
          className="intel-flow-band absolute"
          style={{
            top: '14%',
            left: '50%',
            width: '140%',
            height: '60px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.18) 30%, rgba(94,234,212,0.28) 50%, rgba(20,184,166,0.18) 70%, transparent 100%)',
            filter: 'blur(20px)',
            animation: 'tractova-intel-flow 90s linear infinite',
            transformOrigin: 'center',
          }}
        />

        {/* Layer 3 — cartographic parcel grid, masked to left + right
            gutters only so it frames the centered profile rather than
            overlapping it. Mask is a horizontal gradient: opaque at the
            edges, transparent in the middle 60%. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(15,118,110,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(15,118,110,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)',
            maskImage:       'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)',
          }}
        />
      </div>
    </>
  )
}
