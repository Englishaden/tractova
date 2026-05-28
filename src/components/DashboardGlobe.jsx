import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import createGlobe from 'cobe'
import USMap from './USMap'

// DashboardGlobe — the page-hero map for the revamped Dashboard.
//
// Two display modes:
//   1) "globe"  — cobe WebGL globe at rest, rotated to US-facing, with green
//                 markers at the top-15 states by feasibility score. Aden's
//                 spec from Dashboard Example 3: "small globe that then
//                 enhances when you click into it and focuses on the USA."
//   2) "map"    — the existing <USMap> in full, choropleth + delta pulse.
//
// Click anywhere on the globe → 600ms spotlight-enter transition to the map.
// "Back to globe" pill in the corner of the map → returns to the globe.
//
// WebGL fallback: cobe needs WebGL. ~5% of visitors have it disabled (corp
// laptops, accessibility tools). We feature-detect at mount and skip the
// globe step entirely on those devices, rendering <USMap> from first paint.
// Never throw, never blank — this is the page hero.
//
// Selecting a state from the globe markers (or, when in map mode, clicking
// a state on the choropleth) calls onStateClick, which the parent uses to
// open <StateDetailPanel>.

// US state centroids — used both to place globe markers and as a
// stable lookup independent of a runtime geocoder. Approximate
// geographic centers (sourced from US Census Bureau gazetteer).
const STATE_CENTROIDS = {
  AL: [32.7794, -86.8287],  AK: [64.0685, -152.2782], AZ: [34.2744, -111.6602],
  AR: [34.8938, -92.4426],  CA: [37.1841, -119.4696], CO: [38.9972, -105.5478],
  CT: [41.6219, -72.7273],  DE: [38.9896, -75.5050],  DC: [38.9072, -77.0369],
  FL: [28.6305, -82.4497],  GA: [32.6415, -83.4426],  HI: [20.2927, -156.3737],
  ID: [44.3509, -114.6130], IL: [40.0417, -89.1965],  IN: [39.8942, -86.2816],
  IA: [42.0751, -93.4960],  KS: [38.4937, -98.3804],  KY: [37.5347, -85.3021],
  LA: [31.0689, -91.9968],  ME: [45.3695, -69.2428],  MD: [39.0550, -76.7909],
  MA: [42.2596, -71.8083],  MI: [44.3467, -85.4102],  MN: [46.2807, -94.3053],
  MS: [32.7364, -89.6678],  MO: [38.3566, -92.4580],  MT: [47.0527, -109.6333],
  NE: [41.5378, -99.7951],  NV: [39.3289, -116.6312], NH: [43.6805, -71.5811],
  NJ: [40.1907, -74.6728],  NM: [34.4071, -106.1126], NY: [42.9538, -75.5268],
  NC: [35.5557, -79.3877],  ND: [47.4501, -100.4659], OH: [40.2862, -82.7937],
  OK: [35.5889, -97.4943],  OR: [43.9336, -120.5583], PA: [40.8781, -77.7996],
  RI: [41.6762, -71.5562],  SC: [33.9169, -80.8964],  SD: [44.4443, -100.2263],
  TN: [35.8580, -86.3505],  TX: [31.4757, -99.3312],  UT: [39.3055, -111.6703],
  VT: [44.0687, -72.6658],  VA: [37.5215, -78.8537],  WA: [47.3826, -120.4472],
  WV: [38.6409, -80.6227],  WI: [44.6243, -89.9941],  WY: [42.9957, -107.5512],
}

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

// Phi/theta target for "US-facing." Phi=4.7 rad (~270°) rotates the globe
// so North America faces the camera; theta=0.35 tilts slightly downward
// so the northern half of the US is in the visual center.
const PHI_US_FACING = 4.7
const THETA_US_FACING = 0.35

export default function DashboardGlobe({
  onStateClick,
  selectedStateId,
  stateProgramMap = {},
  deltaMap = null,
}) {
  // Initial mode: globe if WebGL available, map otherwise.
  // useState init function runs once at mount so we don't re-check on every render.
  const [mode, setMode] = useState(() => (isWebGLAvailable() ? 'globe' : 'map'))
  const canvasRef = useRef(null)
  const globeRef = useRef(null)

  // Top-15 states by feasibility score — recomputed when the map data
  // arrives. These become the highlighted markers on the globe.
  const topMarkers = useMemo(() => {
    const states = Object.values(stateProgramMap || {})
    if (states.length === 0) return []
    return states
      .filter((s) => s.csStatus !== 'none')
      .sort((a, b) => (b.feasibilityScore || 0) - (a.feasibilityScore || 0))
      .slice(0, 15)
      .map((s) => {
        const coords = STATE_CENTROIDS[s.id]
        if (!coords) return null
        const isMover = !!deltaMap?.get?.(s.id)
        return {
          id: s.id,
          location: coords,
          // Markers grow with score (0.04–0.08), movers slightly larger so the
          // eye is pulled to states that changed this week.
          size: 0.04 + ((s.feasibilityScore || 0) / 100) * 0.04 + (isMover ? 0.01 : 0),
        }
      })
      .filter(Boolean)
  }, [stateProgramMap, deltaMap])

  // Globe initialization — re-fires when `mode` flips back to 'globe' (e.g.
  // user returns from the map view). On unmount, we destroy() the cobe
  // instance to release WebGL resources.
  useEffect(() => {
    if (mode !== 'globe') return
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    let animationId = null
    let phi = PHI_US_FACING

    const init = () => {
      const width = canvas.offsetWidth
      if (width === 0 || globeRef.current) return

      globeRef.current = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi: PHI_US_FACING,
        theta: THETA_US_FACING,
        dark: 1,
        diffuse: 0.8,
        mapSamples: 16000,
        mapBrightness: 4.5,
        baseColor: [0.12, 0.18, 0.26],     // Dark slate land (matches --cards-bg vibe)
        markerColor: [0.078, 0.722, 0.651], // Tractova teal #14B8A6
        glowColor: [0.04, 0.10, 0.16],     // Deep navy glow (subtle, no halo blow-out)
        markers: topMarkers.map((m) => ({ location: m.location, size: m.size })),
        opacity: 0.95,
      })

      const animate = () => {
        // Very gentle auto-rotate (Defillama's animation timings inspired this —
        // slow enough that it reads as ambient, not distracting). The rotation
        // is around the US-facing position, so the US stays roughly centered.
        phi += 0.0008
        if (globeRef.current) {
          globeRef.current.update({
            phi,
            theta: THETA_US_FACING,
          })
        }
        animationId = requestAnimationFrame(animate)
      }
      animate()
      // Fade the canvas in once cobe has its first frame — avoids the
      // flash of a black square before the globe materializes.
      setTimeout(() => {
        if (canvas) canvas.style.opacity = '1'
      }, 50)
    }

    // Defer init until the canvas has a width — ResizeObserver handles
    // the case where the parent container hasn't laid out yet.
    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globeRef.current) {
        globeRef.current.destroy()
        globeRef.current = null
      }
    }
  }, [mode, topMarkers])

  // Re-feed marker updates without rebuilding the globe — cobe lets us
  // pass a fresh markers array via update(). Skipped for now; cobe's
  // top-level `markers` is only read at construction, so live marker
  // updates would require destroy+rebuild. We rebuild whenever
  // topMarkers changes (the useEffect dep above), which is rare
  // (only when stateProgramMap or deltaMap changes — every weekly
  // refresh tick).

  const handleGlobeClick = useCallback(() => {
    setMode('map')
  }, [])

  const handleBackToGlobe = useCallback(() => {
    setMode('globe')
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  if (mode === 'map') {
    return (
      <div className="relative dash-spotlight-enter">
        <USMap
          onStateClick={onStateClick}
          selectedStateId={selectedStateId}
          stateProgramMap={stateProgramMap}
          deltaMap={deltaMap}
        />
        {isWebGLAvailable() && (
          <button
            type="button"
            onClick={handleBackToGlobe}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors"
            style={{
              background: 'rgba(11,22,35,0.72)',
              border: '1px solid var(--cards-border, rgba(255,255,255,0.10))',
              color: 'var(--text-label, #98A4B6)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Return to globe view"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold">Globe</span>
          </button>
        )}
      </div>
    )
  }

  // Globe mode
  return (
    <div
      className="relative w-full select-none cursor-pointer"
      style={{ aspectRatio: '1 / 1', maxHeight: '520px' }}
      onClick={handleGlobeClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleGlobeClick() }}
      role="button"
      tabIndex={0}
      aria-label="Open interactive US map"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          opacity: 0,
          transition: 'opacity 1.2s ease',
          touchAction: 'none',
        }}
      />
      {/* Floating CTA so the user knows the globe is clickable. Hidden
          on tap (touch) since the whole canvas is tap-to-zoom. */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ display: 'none' }}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.20em] font-semibold"
          style={{
            background: 'rgba(11,22,35,0.72)',
            border: '1px solid var(--hairline-teal, rgba(20,184,166,0.45))',
            color: 'var(--link, #5EEAD4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#14B8A6' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.6)' }} />
          </span>
          Click to explore US
        </span>
      </div>
    </div>
  )
}
