import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

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

// V3 5-bucket single-hue teal ramp — light teal (low score) -> deep teal (high score).
// Color-blind safe, matches Tailwind feasibility tokens, legend below uses same buckets.
function getStateColor(stateId, isHovered, isSelected, stateProgramMap) {
  if (isSelected) return '#7C3AED'    // violet — intelligence highlight (kept)
  const state = stateProgramMap[stateId]
  if (isHovered) return '#0F766E'     // deepest teal on hover

  if (!state || state.csStatus === 'none') return '#E2E8F0'  // slate-200 — no program
  if (state.csStatus === 'pending')        return '#F59E0B'  // amber — caution / pending

  const score = state.feasibilityScore
  if (score >= 75) return '#0F766E'   // teal-700 — strong (75+)
  if (score >= 60) return '#14B8A6'   // teal-500 — viable (60-74)
  if (score >= 45) return '#2DD4BF'   // teal-400 — moderate (45-59)
  if (score >= 25) return '#99F6E4'   // teal-200 — weak (25-44)
  return '#F0FDFA'                     // teal-50 — non-viable (<25)
}

export default function USMap({ onStateClick, selectedStateId, stateProgramMap = {} }) {
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
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #FFFFFF 0%, #F0FDFA 100%)',
        border: '1px solid rgba(20,184,166,0.18)',
        boxShadow: '0 0 0 1px rgba(20,184,166,0.06), 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* V3: subtle teal watercolor wash — aligned with new choropleth ramp */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 85% 10%, rgba(20,184,166,0.07) 0%, transparent 50%)',
            'radial-gradient(ellipse at 10% 85%, rgba(15,118,110,0.08) 0%, transparent 52%)',
            'radial-gradient(ellipse at 50% 50%, rgba(45,212,191,0.04) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      {/* Header */}
      <div
        className="relative z-10 px-5 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(20,184,166,0.10)', background: 'rgba(20,184,166,0.04)' }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            US Community Solar Market
          </h2>
          <p className="text-xs text-gray-400">
            Click any state for program details
          </p>
        </div>
        <Legend />
      </div>

      {/* Map */}
      <div className="relative z-10">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const fips = String(geo.id).padStart(2, '0')
                const stateId = FIPS[fips]
                const isHovered  = hoveredId === stateId
                const isSelected = selectedStateId === stateId

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getStateColor(stateId, isHovered, isSelected, stateProgramMap)}
                    stroke="#FFFFFF"
                    strokeWidth={0.7}
                    style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                    onMouseMove={(evt) => handleMouseMove(geo, evt)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleClick(geo)}
                    className="cursor-pointer transition-all duration-100"
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip — keep dark glass style regardless of card bg */}
      {tooltip && tooltipState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div
            className="text-xs rounded-lg px-3 py-2 shadow-2xl max-w-[200px]"
            style={{
              background: 'rgba(7,17,12,0.95)',
              border: '1px solid rgba(20,184,166,0.30)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{tooltipState.name}</div>
            {tooltipState.csProgram && (
              <div className="mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{tooltipState.csProgram}</div>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <StatusPill status={tooltipState.csStatus} />
              {tooltipState.feasibilityScore > 0 && (
                <span className="font-mono tabular-nums" style={{ color: '#2DD4BF', fontWeight: 700 }}>
                  {tooltipState.feasibilityScore}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {tooltip && !tooltipState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div
            className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(7,17,12,0.95)', border: '1px solid rgba(20,184,166,0.30)' }}
          >
            <div className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{tooltip.stateId || 'Unknown'}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)' }}>No data</div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    active:  { label: 'Active',     bg: 'rgba(5,150,105,0.10)',  text: '#065F46', border: 'rgba(5,150,105,0.25)' },
    limited: { label: 'Limited',    bg: 'rgba(180,83,9,0.10)',   text: '#92400E', border: 'rgba(180,83,9,0.25)' },
    pending: { label: 'Pending',    bg: 'rgba(180,83,9,0.10)',   text: '#92400E', border: 'rgba(180,83,9,0.25)' },
    none:    { label: 'No Program', bg: 'rgba(0,0,0,0.04)',      text: '#6B7280', border: 'rgba(0,0,0,0.10)' },
  }
  const cfg = map[status] || map.none
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function Legend() {
  // V3: 5 score buckets that match getStateColor() exactly + 2 status states
  const items = [
    { color: '#0F766E', label: 'Strong (75+)' },
    { color: '#14B8A6', label: 'Viable (60–74)' },
    { color: '#2DD4BF', label: 'Moderate (45–59)' },
    { color: '#99F6E4', label: 'Weak (25–44)' },
    { color: '#F0FDFA', label: 'Non-viable (<25)', border: 'rgba(15,118,110,0.30)' },
    { color: '#F59E0B', label: 'Pending' },
    { color: '#E2E8F0', label: 'No program', border: 'rgba(0,0,0,0.12)' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: i.color, border: `1px solid ${i.border || 'rgba(0,0,0,0.10)'}` }}
          />
          <span className="text-xs text-gray-500">{i.label}</span>
        </div>
      ))}
    </div>
  )
}
