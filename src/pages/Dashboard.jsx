import { useState, useEffect } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import SectionDivider from '../components/SectionDivider'
import { getStateProgramMap, getNewsFeed } from '../lib/programData'

export default function Dashboard() {
  const [selectedStateId,  setSelectedStateId]  = useState(null)
  const [stateProgramMap,  setStateProgramMap]  = useState({})
  const [news,             setNews]             = useState([])

  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
    getNewsFeed().then(setNews).catch(console.error)
  }, [])

  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null

  const handleStateClick = (stateId) => {
    setSelectedStateId((prev) => (prev === stateId ? null : stateId))
  }

  const handleClosePanel = () => {
    setSelectedStateId(null)
  }

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* Page header */}
        <div className="mt-4 mb-1">
          <h1 className="text-xl font-bold text-gray-900">Market Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Community solar program status, interconnection conditions, and policy alerts — updated weekly.
          </p>
        </div>

        <SectionDivider />

        {/* Metrics bar */}
        <MetricsBar />

        <SectionDivider />

        {/* Main two-panel layout */}
        <div className="grid grid-cols-5 gap-5" style={{ minHeight: '600px' }}>
          {/* Map — 60% */}
          <div className="col-span-3">
            <USMap
              onStateClick={handleStateClick}
              selectedStateId={selectedStateId}
              stateProgramMap={stateProgramMap}
            />
          </div>

          {/* Side panel — 40% */}
          <div className="col-span-2 flex flex-col" style={{ minHeight: '600px' }}>
            {selectedState ? (
              <StateDetailPanel
                state={selectedState}
                news={news}
                onClose={handleClosePanel}
              />
            ) : (
              <NewsFeed news={news} />
            )}
          </div>
        </div>

        {/* Hint when nothing is selected */}
        {!selectedState && (
          <>
            <SectionDivider />
            <p className="text-xs text-gray-400 text-center">
              Click any state on the map to view its program details
            </p>
          </>
        )}
      </main>
    </div>
  )
}
