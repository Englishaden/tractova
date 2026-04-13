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

function getStateColor(stateId, isHovered) {
  const state = stateById[stateId]
  if (isHovered) return '#BA7517'
  if (!state) return '#E5E7EB'

  if (state.csStatus === 'pending') return '#FCD34D'
  if (state.csStatus === 'none') return '#E5E7EB'

  const score = state.feasibilityScore
  if (score >= 75) return '#0F6E56'
  if (score >= 65) return '#1A9070'
  if (score >= 55) return '#34B08A'
  if (score >= 45) return '#6ECDB0'
  return '#A7E3D4'
}

const STATUS_LABEL = {
  active:  { text: 'Active Program',  cls: 'bg-primary-50 text-primary border-primary-200' },
  limited: { text: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending: { text: 'Pending Launch',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  none:    { text: 'No Program',       cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function USMap({ onStateClick, selectedStateId }) {
  const [tooltip, setTooltip] = useState(null) // { x, y, stateId }
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-800">US Community Solar Market</h2>
          <p className="text-xs text-gray-400">Click any state for program details</p>
        </div>
        <Legend />
      </div>

      {/* Map */}
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
              const isHovered = hoveredId === stateId
              const isSelected = selectedStateId === stateId

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isSelected ? '#BA7517' : getStateColor(stateId, isHovered)}
                  stroke="#FFFFFF"
                  strokeWidth={0.75}
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

      {/* Tooltip */}
      {tooltip && tooltipState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg max-w-[200px]">
            <div className="font-semibold">{tooltipState.name}</div>
            {tooltipState.csProgram && (
              <div className="text-gray-300 mt-0.5">{tooltipState.csProgram}</div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_LABEL[tooltipState.csStatus]?.cls}`}>
                {STATUS_LABEL[tooltipState.csStatus]?.text}
              </span>
              {tooltipState.feasibilityScore > 0 && (
                <span className="text-gray-300">Score: {tooltipState.feasibilityScore}</span>
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
          <div className="bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg">
            <div className="font-semibold">{tooltip.stateId || 'Unknown'}</div>
            <div className="text-gray-400">No data</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Legend() {
  const items = [
    { color: '#0F6E56', label: 'High opp (75+)' },
    { color: '#34B08A', label: 'Moderate (45–74)' },
    { color: '#A7E3D4', label: 'Low / limited (30–44)' },
    { color: '#FCD34D', label: 'Pending launch' },
    { color: '#E5E7EB', label: 'No program' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ backgroundColor: i.color }} />
          <span className="text-xs text-gray-500">{i.label}</span>
        </div>
      ))}
    </div>
  )
}
