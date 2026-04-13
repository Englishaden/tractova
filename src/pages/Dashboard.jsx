import { useState } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import TopoBackground from '../components/TopoBackground'
import { stateById } from '../data/statePrograms'

export default function Dashboard() {
  const [selectedStateId, setSelectedStateId] = useState(null)

  const selectedState = selectedStateId ? stateById[selectedStateId] : null

  const handleStateClick = (stateId) => {
    setSelectedStateId((prev) => (prev === stateId ? null : stateId))
  }

  const handleClosePanel = () => {
    setSelectedStateId(null)
  }

  return (
    <div className="min-h-screen bg-surface relative overflow-hidden">
      <TopoBackground />
      <main className="relative z-10 max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* Page header */}
        <div className="mt-4 mb-1">
          <h1 className="text-xl font-bold text-gray-900">Market Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Community solar program status, interconnection conditions, and policy alerts — updated weekly.
          </p>
        </div>

        {/* Metrics bar */}
        <MetricsBar />

        {/* Main two-panel layout */}
        <div className="grid grid-cols-5 gap-5 mt-5" style={{ minHeight: '600px' }}>
          {/* Map — 60% */}
          <div className="col-span-3 relative">
            {/* Radial glow — gives the map a "stage lit" depth against the topo background */}
            <div
              className="absolute -inset-6 rounded-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(15,110,86,0.07) 0%, transparent 72%)' }}
            />
            <USMap
              onStateClick={handleStateClick}
              selectedStateId={selectedStateId}
            />
          </div>

          {/* Side panel — 40% */}
          <div className="col-span-2 flex flex-col" style={{ minHeight: '600px' }}>
            {selectedState ? (
              <StateDetailPanel
                state={selectedState}
                onClose={handleClosePanel}
              />
            ) : (
              <NewsFeed />
            )}
          </div>
        </div>

        {/* Hint when nothing is selected */}
        {!selectedState && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Click any state on the map to view its program details
          </p>
        )}
      </main>
    </div>
  )
}
