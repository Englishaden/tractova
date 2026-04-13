import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { stateById } from '../data/statePrograms'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// FIPS numeric ID → state abbreviation
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

// State fills — designed for dark card background
function getStateColor(stateId, isHovered, isSelected) {
  if (isSelected) return '#8B5CF6'   // violet — intelligence highlight
  const state = stateById[stateId]
  if (isHovered) return '#F59E0B'    // amber on hover
  if (!state) return '#1E3028'       // dark muted — no data

  if (state.csStatus === 'pending') return '#D97706'
  if (state.csStatus === 'none')    return '#1E3028'

  const score = state.feasibilityScore
  if (score >= 75) return '#4DE8A8'  // vivid teal-green — top markets
  if (score >= 65) return '#29C98A'
  if (score >= 55) return '#18A872'
  if (score >= 45) return '#0F8A5C'
  return '#0A6E49'
}

export default function USMap({ onStateClick, selectedStateId }) {
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

  const tooltipState = tooltip?.stateId ? stateById[tooltip.stateId] : null

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg, #060E0B 0%, #0A1812 60%, #080F0C 100%)',
        border: '1px solid rgba(52,176,138,0.20)',
        boxShadow: '0 0 0 1px rgba(15,110,86,0.08), 0 24px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      {/* Aurora mesh gradient — absolutely positioned, pure decoration */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 12% 85%, rgba(124,58,237,0.18) 0%, transparent 52%)',
            'radial-gradient(ellipse at 88% 18%, rgba(15,110,86,0.28) 0%, transparent 48%)',
            'radial-gradient(ellipse at 55% 105%, rgba(186,117,23,0.10) 0%, transparent 42%)',
            'radial-gradient(ellipse at 30% 30%, rgba(52,176,138,0.08) 0%, transparent 40%)',
          ].join(', '),
        }}
      />

      {/* Header */}
      <div
        className="relative z-10 px-5 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,110,86,0.06)' }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
            US Community Solar Market
          </h2>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
                    fill={getStateColor(stateId, isHovered, isSelected)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={0.6}
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

      {/* Tooltip */}
      {tooltip && tooltipState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div
            className="text-xs rounded-lg px-3 py-2 shadow-2xl max-w-[200px]"
            style={{
              background: 'rgba(6,14,11,0.96)',
              border: '1px solid rgba(52,176,138,0.25)',
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
                <span style={{ color: '#4DE8A8', fontWeight: 600 }}>
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
            style={{ background: 'rgba(6,14,11,0.96)', border: '1px solid rgba(52,176,138,0.25)' }}
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
    active:  { label: 'Active',   bg: 'rgba(77,232,168,0.12)', text: '#4DE8A8', border: 'rgba(77,232,168,0.25)' },
    limited: { label: 'Limited',  bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
    pending: { label: 'Pending',  bg: 'rgba(217,119,6,0.12)',  text: '#D97706', border: 'rgba(217,119,6,0.25)' },
    none:    { label: 'No Program', bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.10)' },
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
  const items = [
    { color: '#4DE8A8', label: 'High opp (75+)' },
    { color: '#18A872', label: 'Moderate (45–74)' },
    { color: '#0A6E49', label: 'Low / limited' },
    { color: '#D97706', label: 'Pending launch' },
    { color: '#1E3028', label: 'No program', border: 'rgba(255,255,255,0.12)' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: i.color, border: `1px solid ${i.border || 'rgba(255,255,255,0.10)'}` }}
          />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{i.label}</span>
        </div>
      ))}
    </div>
  )
}
