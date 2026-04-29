import { useState, useEffect } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import SectionDivider from '../components/SectionDivider'
import { getStateProgramMap, getNewsFeed } from '../lib/programData'

export default function Dashboard({ previewMode = false }) {
  const [selectedStateId,  setSelectedStateId]  = useState(null)
  const [stateProgramMap,  setStateProgramMap]  = useState({})
  const [news,             setNews]             = useState([])

  useEffect(() => {
    getStateProgramMap().then(setStateProgramMap).catch(console.error)
    getNewsFeed().then(setNews).catch(console.error)
  }, [])

  // ESC key closes the state detail panel
  useEffect(() => {
    if (!selectedStateId) return
    const handle = (e) => { if (e.key === 'Escape') setSelectedStateId(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [selectedStateId])

  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null

  const handleStateClick = (stateId) => {
    setSelectedStateId((prev) => (prev === stateId ? null : stateId))
  }

  const handleClosePanel = () => {
    setSelectedStateId(null)
  }

  return (
    <div className="min-h-screen bg-surface">
      {previewMode && (
        <div
          className="sticky top-14 z-30 flex items-center justify-between px-6 py-2.5"
          style={{ background: '#063629', borderBottom: '1px solid rgba(52,211,153,0.20)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Live Preview</span>
            <span className="text-xs text-white/75">
              You're viewing live market intelligence. Sign up for Tractova Lens AI analysis and project tracking.
            </span>
          </div>
          <a
            href="/signup"
            className="flex-shrink-0 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors px-3 py-1.5 rounded-lg"
          >
            Get full access →
          </a>
        </div>
      )}
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* Page header */}
        <div className="mt-4 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Market Dashboard</h1>
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
