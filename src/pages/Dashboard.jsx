import { useState } from 'react'
import MetricsBar from '../components/MetricsBar'
import USMap from '../components/USMap'
import NewsFeed from '../components/NewsFeed'
import StateDetailPanel from '../components/StateDetailPanel'
import { stateById } from '../data/statePrograms'
import metrics from '../data/metrics'

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
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-10">
        {/* Page header */}
        <div className="mt-4 mb-6">
          <div className="mb-4">
            <p className="text-[10px] font-bold tracking-widest text-primary/60 uppercase mb-1">Market Intelligence</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Market Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Community solar program status, interconnection conditions, and policy alerts — updated weekly.</p>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'States with Active CS', value: metrics.statesWithActiveCS, sub: 'open programs', color: 'border-primary/20 bg-primary-50/60', val: 'text-primary-700' },
              { label: 'IX Headroom Utilities', value: metrics.utilitiesWithIXHeadroom, sub: 'below saturation threshold', color: 'border-accent-200 bg-accent-50/60', val: 'text-accent-700' },
              { label: 'Policy Alerts', value: metrics.policyAlertsThisWeek, sub: 'this week', color: 'border-gray-200 bg-white', val: 'text-gray-800' },
            ].map(({ label, value, sub, color, val }) => (
              <div key={label} className={`border rounded-xl px-4 py-3 ${color}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${val}`}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics bar */}
        <MetricsBar />

        {/* Main two-panel layout */}
        <div className="grid grid-cols-5 gap-5 mt-5" style={{ minHeight: '600px' }}>
          {/* Map — 60% */}
          <div className="col-span-3">
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
