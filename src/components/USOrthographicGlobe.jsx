import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Sphere } from 'react-simple-maps'

// USOrthographicGlobe — the zoomed-in "globe-curvature" US view that
// the cobe rotating globe transitions to when clicked.
//
// Aden's 2026-05-27 brief: "the globe itself moves and zooms in slightly
// showing the US in a zoomed in version of the globe ... a zoomed in
// version of the globe focusing on each state."
//
// Implementation: d3-geo's `geoOrthographic` projection (the "globe view"
// projection — natural sphere curvature visible at the rim) rotated to
// US-center [100, -38] and scaled up so the contiguous US fills most of
// the visible disc. Layered with:
//   • A <Sphere> element for the spherical-rim outline (sells the globe).
//   • A radial gradient vignette for sphere-curvature shading (darker
//     at the limb, brighter at the visual center near the pole-of-view).
//   • The same state-fill ramp + delta pulse from USMap, dark-surface
//     recolored (deep navies on the unseen states, teal ramp on the
//     active states — reads on the dashboard's #0B1623 page).
//
// Interactivity preserved: click → onStateClick(stateId), hover →
// fixed-positioned tooltip with name + program + status + score.
//
// Distinct file (not a USMap variant) per "keep code concise + easy to
// fix" — USMap is the flat AlbersUSA reference for the Lens result page
// + other surfaces; this globe variant is purely dashboard-scoped.

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const FIPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
}

// Dark-surface 5-bucket teal ramp. Brighter values than the cream-page
// USMap counterpart so the choropleth reads above the dashboard's
// #0B1623 page bg. Same boundaries (75/60/45/25) as USMap so the legend
// vocabulary stays consistent.
function getStateColor(stateId, isHovered, isSelected, stateProgramMap) {
  if (isSelected) return '#A78BFA'   // violet — selected highlight
  const state = stateProgramMap[stateId]
  if (isHovered) return '#5EEAD4'    // brighter teal on hover (visible on dark sphere)

  if (!state || state.csStatus === 'none') return '#1F2A3D' // very dark slate (cards-border tone)
  if (state.csStatus === 'pending')        return '#FBBF24' // amber for pending

  const score = state.feasibilityScore
  if (score >= 75) return '#0F766E'  // teal-700 — strong
  if (score >= 60) return '#14B8A6'  // teal-500 — viable
  if (score >= 45) return '#2DD4BF'  // teal-400 — moderate
  if (score >= 25) return '#5EEAD4'  // teal-300 — weak
  return '#99F6E4'                    // teal-200 — non-viable but at least present
}

function StatusPill({ status }) {
  const cfg = {
    active:  { bg: 'rgba(20,184,166,0.20)', text: '#5EEAD4', label: 'Active' },
    limited: { bg: 'rgba(251,191,36,0.20)', text: '#FBBF24', label: 'Limited' },
    pending: { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24', label: 'Pending' },
    none:    { bg: 'rgba(255,255,255,0.06)', text: '#98A4B6', label: 'No program' },
  }[status] || { bg: 'rgba(255,255,255,0.06)', text: '#98A4B6', label: status || 'Unknown' }
  return (
    <span
      className="inline-flex items-center font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm font-semibold"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

export default function USOrthographicGlobe({
  onStateClick,
  selectedStateId,
  stateProgramMap = {},
  deltaMap = null,
}) {
  const [tooltip, setTooltip] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  const handleMouseMove = (geo, evt) => {
    const fips = String(geo.id).padStart(2, '0')
    const stateId = FIPS[fips]
    setHoveredId(stateId)
    setTooltip({ x: evt.clientX, y: evt.clientY, stateId })
  }

  const handleMouseLeave = () => {
    setHoveredId(null)
    setTooltip(null)
  }

  const handleClick = (geo) => {
    const fips = String(geo.id).padStart(2, '0')
    const stateId = FIPS[fips]
    if (stateId && onStateClick) onStateClick(stateId)
  }

  const tooltipState = tooltip?.stateId ? stateProgramMap[tooltip.stateId] : null

  return (
    <div className="flex items-center justify-center w-full h-full p-4">
      <div className="relative aspect-square w-full max-w-[480px] mx-auto">
        {/* Radial vignette — darkens the limb (sphere edge), brightens
            the visual center. Cheap trick that adds depth without a
            real 3D shader. Layered UNDER the SVG so the choropleth
            fills remain readable. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 42% 38%, rgba(20,184,166,0.18) 0%, rgba(11,22,35,0.10) 45%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        <ComposableMap
          projection="geoOrthographic"
          projectionConfig={{
            // Rotate the globe so the camera looks at central US.
            // d3-geo orthographic: rotate=[lambda, phi, gamma] applies as
            //   rotateZ(-lambda) ∘ rotateX(-phi). With [100, -38]:
            //   • lambda=100 → longitude 100°W comes to the visible center
            //   • phi=-38 → camera tilts so latitude 38°N is at the visual
            //     center (US continental centroid is ~38°N -98°W).
            rotate: [100, -38, 0],
            // scale ≈ sphere radius in SVG units. With viewBox 800×600,
            // scale=1200 gives a sphere of diameter 2400 — way bigger than
            // the viewBox, so the visible disc is a slice. That's what
            // gives the "zoomed in on the US" feel — we're seeing only a
            // chunk of an oversized sphere.
            scale: 1200,
          }}
          width={800}
          height={800}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Sphere outline — the rim of the globe. Drawn first so the
              choropleth sits on top. Stroke is subtle teal so it reads
              as "horizon" not as "border." */}
          <Sphere
            stroke="rgba(20,184,166,0.40)"
            strokeWidth={0.8}
            fill="rgba(11,22,35,0.55)"
          />

          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {/* Layer 1 — choropleth fill + interactivity */}
                {geographies.map((geo) => {
                  const fips = String(geo.id).padStart(2, '0')
                  const stateId = FIPS[fips]
                  const stateInfo = stateProgramMap[stateId]
                  if (!stateInfo) return null
                  const isHovered  = hoveredId === stateId
                  const isSelected = selectedStateId === stateId
                  const ariaLabel = `${stateInfo.name}: ${stateInfo.csStatus} community solar program${stateInfo.feasibilityScore ? `, feasibility ${stateInfo.feasibilityScore} of 100` : ''}.`
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getStateColor(stateId, isHovered, isSelected, stateProgramMap)}
                      stroke="rgba(11,22,35,0.85)"
                      strokeWidth={0.45}
                      style={{ default: { outline: 'none' }, hover: { outline: 'none', filter: 'brightness(1.15)' }, pressed: { outline: 'none' } }}
                      onMouseMove={(evt) => handleMouseMove(geo, evt)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleClick(geo)}
                      onKeyDown={(evt) => { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); handleClick(geo) } }}
                      className="cursor-pointer transition-all duration-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400"
                      role="button"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      aria-pressed={isSelected}
                    />
                  )
                })}

                {/* Layer 2 — delta pulse on states whose feasibility
                    score moved this week. Same pattern as USMap's
                    Layer 3, kept here for parity with the rotating
                    globe's marker-pulse halos. */}
                {deltaMap && geographies.map((geo) => {
                  const fips = String(geo.id).padStart(2, '0')
                  const stateId = FIPS[fips]
                  if (!stateProgramMap[stateId]) return null
                  if (!deltaMap.get?.(stateId)) return null
                  return (
                    <Geography
                      key={`${geo.rsmKey}-pulse`}
                      geography={geo}
                      fill="none"
                      stroke="#5EEAD4"
                      className="state-pulse"
                      style={{
                        default:  { pointerEvents: 'none', outline: 'none' },
                        hover:    { pointerEvents: 'none', outline: 'none' },
                        pressed:  { pointerEvents: 'none', outline: 'none' },
                      }}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  )
                })}
              </>
            )}
          </Geographies>
        </ComposableMap>

        {/* Specular highlight — a small bright spot upper-left of the
            sphere center, mimicking a light source at top-left. Adds
            another depth cue beyond the rim vignette. Sits above the
            map so it occludes a tiny patch of ocean/state where the
            "light" would naturally wash detail out. */}
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            top: '18%',
            left: '22%',
            width: '22%',
            height: '22%',
            background: 'radial-gradient(circle, rgba(94,234,212,0.20) 0%, transparent 65%)',
            filter: 'blur(8px)',
          }}
        />
      </div>

      {/* Tooltip — fixed-positioned so it follows the cursor across
          the sphere's curvature without re-anchoring to each state path. */}
      {tooltip && tooltipState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div
            className="text-xs rounded-md px-3 py-2 shadow-2xl max-w-[220px]"
            style={{
              background: 'rgba(11,22,35,0.96)',
              border: '1px solid rgba(20,184,166,0.40)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <div className="font-semibold">{tooltipState.name}</div>
            {tooltipState.csProgram && (
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{tooltipState.csProgram}</div>
            )}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <StatusPill status={tooltipState.csStatus} />
              {tooltipState.feasibilityScore > 0 && (
                <span className="font-mono tabular-nums" style={{ color: '#5EEAD4', fontWeight: 700 }}>
                  {tooltipState.feasibilityScore}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
