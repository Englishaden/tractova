// IntelligenceBackground — fixed-position background layer for the Profile
// page. Three stacked CSS layers create a "flowing intelligence platform"
// atmosphere without competing with the centered profile content.
//
// Stacking strategy: this component renders inside a `relative` parent and
// uses `z-0` (NOT negative). The parent must NOT have a solid background
// color (e.g. remove `bg-surface`) so this layer paints visibly. The Profile
// main content sits at `relative z-10` above this layer.
//
// Layers:
//   1. Edge wash radial gradients — soft teal blooms with off-canvas centers
//      pulling visual weight to the gutters; static.
//   2. Slow-flowing teal band — wide, blurred horizontal band that drifts
//      across the page over 45s with constant moderate opacity (no fade
//      in/out at edges) so it's continuously visible.
//   3. Cartographic parcel grid — 32px grid masked to LEFT and RIGHT 200px
//      gutters via mask-image so it frames the centered profile without
//      overlapping it; static.
//   4. Floating accent dots — 4 small teal dots drifting across the gutters
//      on independent timers, providing distinctly visible motion that
//      signals "intelligence working" without being noisy.
//
// All layers are pure CSS (GPU-accelerated, zero JS work per frame).
// Honors `prefers-reduced-motion` (motion disabled, washes preserved).
export default function IntelligenceBackground() {
  return (
    <>
      <style>{`
        @keyframes tractova-intel-flow {
          0%   { transform: translateX(-55%); }
          100% { transform: translateX(55%); }
        }
        @keyframes tractova-intel-drift {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 0.55; }
          50%  { opacity: 0.75; }
          90%  { opacity: 0.55; }
          100% { transform: translateY(-110vh) translateX(8px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .intel-flow-band,
          .intel-dot { animation: none !important; opacity: 0 !important; }
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

        {/* Layer 2 — slow-flowing teal band (always visible, just drifts).
            Positioned mid-upper viewport. 45s cycle = visible motion without
            being agitating. */}
        <div
          className="intel-flow-band absolute"
          style={{
            top: '20%',
            left: '50%',
            width: '160%',
            height: '70px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.32) 30%, rgba(94,234,212,0.42) 50%, rgba(20,184,166,0.32) 70%, transparent 100%)',
            filter: 'blur(24px)',
            animation: 'tractova-intel-flow 45s ease-in-out infinite alternate',
            transformOrigin: 'center',
          }}
        />

        {/* Layer 3 — cartographic parcel grid in gutters only */}
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

        {/* Layer 4 — floating accent dots in the gutters. Each drifts
            upward at slightly different speeds with offset start delays so
            the motion never feels mechanical or pulsing-in-lockstep.
            Colors map to the three intelligence pillars (teal = offtake,
            amber = IX, blue = site control) so the rising dots quietly
            signal "all three pillars processing in real time." Sizes and
            glow strengths vary so the visual rhythm has natural depth. */}
        {[
          // Left gutter — 4 dots, mixed pillars + sizes + cycles
          { left: '3%',  delay: '0s',   duration: '28s', size: 4, color: '#14B8A6', glow: 'rgba(20,184,166,0.70)' },   // teal · offtake
          { left: '6%',  delay: '12s',  duration: '38s', size: 3, color: '#F59E0B', glow: 'rgba(245,158,11,0.55)' },   // amber · IX
          { left: '11%', delay: '22s',  duration: '32s', size: 5, color: '#5EEAD4', glow: 'rgba(94,234,212,0.65)' },   // light teal accent
          { left: '14%', delay: '6s',   duration: '40s', size: 3, color: '#2563EB', glow: 'rgba(37,99,235,0.50)' },    // blue · site
          // Right gutter — 4 dots, different mix
          { left: '86%', delay: '4s',   duration: '34s', size: 4, color: '#2563EB', glow: 'rgba(37,99,235,0.55)' },    // blue · site
          { left: '90%', delay: '16s',  duration: '30s', size: 3, color: '#14B8A6', glow: 'rgba(20,184,166,0.65)' },   // teal · offtake
          { left: '93%', delay: '26s',  duration: '36s', size: 5, color: '#F59E0B', glow: 'rgba(245,158,11,0.50)' },   // amber · IX
          { left: '97%', delay: '9s',   duration: '42s', size: 3, color: '#5EEAD4', glow: 'rgba(94,234,212,0.65)' },   // light teal accent
        ].map((d, i) => (
          <span
            key={i}
            className="intel-dot absolute rounded-full"
            style={{
              left: d.left,
              bottom: '-10px',
              width: `${d.size}px`,
              height: `${d.size}px`,
              background: d.color,
              boxShadow: `0 0 ${d.size * 3}px ${d.glow}`,
              animation: `tractova-intel-drift ${d.duration} linear infinite`,
              animationDelay: d.delay,
            }}
          />
        ))}
      </div>
    </>
  )
}
