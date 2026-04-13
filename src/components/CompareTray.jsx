import { useState } from 'react'
import { useCompare } from '../context/CompareContext'

const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }
const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }
const CS_CLS   = {
  active:  'text-primary-700 bg-primary-50 border-primary-200',
  limited: 'text-amber-700 bg-amber-50 border-amber-200',
  pending: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  none:    'text-gray-500 bg-gray-100 border-gray-200',
}
const IX_CLS = {
  easy:      'text-primary-700 bg-primary-50 border-primary-200',
  moderate:  'text-yellow-700 bg-yellow-50 border-yellow-200',
  hard:      'text-orange-700 bg-orange-50 border-orange-200',
  very_hard: 'text-red-700 bg-red-50 border-red-200',
}

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-gray-400 italic">—</span>
  const pct = Math.max(0, Math.min(100, score))
  let barColor = 'bg-gray-300'
  if (pct >= 75) barColor = 'bg-primary'
  else if (pct >= 55) barColor = 'bg-primary-400'
  else if (pct >= 40) barColor = 'bg-accent-400'
  else if (pct >= 25) barColor = 'bg-amber-300'

  return (
    <div>
      <div className="flex items-end gap-1 mb-1">
        <span className="text-2xl font-bold text-gray-900">{pct}</span>
        <span className="text-xs text-gray-400 mb-0.5">/ 100</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MetricRow({ label, values }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `140px repeat(${values.length}, 1fr)` }}>
      <span className="text-xs text-gray-500 py-3 pr-2 border-r border-gray-100">{label}</span>
      {values.map((val, i) => (
        <div key={i} className="py-3 px-1">{val}</div>
      ))}
    </div>
  )
}

function CompareModal({ onClose }) {
  const { items, remove, clear } = useCompare()

  const rows = [
    {
      label: 'Feasibility Score',
      render: (item) => <ScoreBar score={item.feasibilityScore} />,
    },
    {
      label: 'CS Program Status',
      render: (item) => (
        item.csStatus
          ? <span className={`text-xs font-medium px-2 py-0.5 rounded border ${CS_CLS[item.csStatus] || CS_CLS.none}`}>
              {CS_LABEL[item.csStatus] || item.csStatus}
            </span>
          : <span className="text-xs text-gray-400">—</span>
      ),
    },
    {
      label: 'CS Program',
      render: (item) => <span className="text-xs text-gray-700">{item.csProgram || '—'}</span>,
    },
    {
      label: 'IX Difficulty',
      render: (item) => (
        item.ixDifficulty
          ? <span className={`text-xs font-medium px-2 py-0.5 rounded border ${IX_CLS[item.ixDifficulty] || ''}`}>
              {IX_LABEL[item.ixDifficulty] || item.ixDifficulty}
            </span>
          : <span className="text-xs text-gray-400">—</span>
      ),
    },
    {
      label: 'Project Size',
      render: (item) => <span className="text-xs text-gray-700">{item.mw ? `${item.mw} MW AC` : '—'}</span>,
    },
    {
      label: 'Technology',
      render: (item) => <span className="text-xs text-gray-700">{item.technology || '—'}</span>,
    },
    {
      label: 'Stage',
      render: (item) => <span className="text-xs text-gray-700">{item.stage || '—'}</span>,
    },
    {
      label: 'Source',
      render: (item) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
          item.source === 'library'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {item.source === 'library' ? `Saved ${new Date(item.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}` : 'Live (Lens)'}
        </span>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Project Comparison</h2>
            <p className="text-xs text-gray-400 mt-0.5">Feasibility score and key metrics across {items.length} project{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clear}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Column headers */}
          <div className="grid gap-4 pb-3 border-b border-gray-200 mb-1" style={{ gridTemplateColumns: `140px repeat(${items.length}, 1fr)` }}>
            <div />
            {items.map((item) => (
              <div key={item.id} className="px-1">
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-bold text-gray-900 leading-snug">{item.name}</p>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">{item.stateName}</p>
              </div>
            ))}
          </div>

          {/* Metric rows */}
          <div className="divide-y divide-gray-50">
            {rows.map((row) => (
              <MetricRow
                key={row.label}
                label={row.label}
                values={items.map((item) => row.render(item))}
              />
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-gray-100 bg-surface rounded-b-xl">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Feasibility scores and program data reflect Tractova's proprietary composite index. Verify interconnection and capacity figures with the serving utility before committing capital.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CompareTray() {
  const { items, remove, clear } = useCompare()
  const [modalOpen, setModalOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <>
      {/* Floating tray bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-3 bg-gray-900 text-white rounded-xl px-4 py-3 shadow-2xl"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)' }}
        >
          {/* Icon */}
          <div className="flex-shrink-0 w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34B08A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>

          {/* Project chips */}
          <div className="flex items-center gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 bg-white/10 rounded-md px-2.5 py-1">
                <span className="text-xs font-medium text-white truncate max-w-[120px]">{item.name}</span>
                <button
                  onClick={() => remove(item.id)}
                  className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
                  aria-label={`Remove ${item.name}`}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 flex-shrink-0" />

          {/* Compare button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            Compare
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            className="text-white/40 hover:text-white/70 transition-colors text-xs flex-shrink-0"
            aria-label="Clear comparison"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && <CompareModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
