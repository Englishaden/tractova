import { useState } from 'react'
import { useCompare } from '../context/CompareContext'

const IX_LABEL = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', very_hard: 'Very Hard' }
const CS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'None' }

const CS_CLS = {
  active:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  limited: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  pending: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/25',
  none:    'text-white/30 bg-white/5 border-white/10',
}
const IX_CLS = {
  easy:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  moderate:  'text-amber-400 bg-amber-400/10 border-amber-400/25',
  hard:      'text-orange-400 bg-orange-400/10 border-orange-400/25',
  very_hard: 'text-red-400 bg-red-400/10 border-red-400/25',
}

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-white/25 italic font-mono">—</span>
  const pct = Math.max(0, Math.min(100, score))
  let barColor = '#34D399'
  if (pct < 25) barColor = '#ef4444'
  else if (pct < 40) barColor = '#f59e0b'
  else if (pct < 55) barColor = '#d97706'
  else if (pct < 75) barColor = '#6ee7b7'

  return (
    <div>
      <div className="flex items-end gap-1 mb-1.5">
        <span className="text-2xl font-bold font-mono" style={{ color: barColor }}>{pct}</span>
        <span className="text-xs text-white/30 font-mono mb-0.5">/ 100</span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function MetricRow({ label, values }) {
  return (
    <div className="grid gap-4 border-b" style={{ gridTemplateColumns: `148px repeat(${values.length}, 1fr)`, borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/30 py-3 pr-2 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {label}
      </span>
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
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${CS_CLS[item.csStatus] || CS_CLS.none}`}>
              {CS_LABEL[item.csStatus] || item.csStatus}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'CS Program',
      render: (item) => <span className="text-xs text-white/65">{item.csProgram || '—'}</span>,
    },
    {
      label: 'IX Difficulty',
      render: (item) => (
        item.ixDifficulty
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${IX_CLS[item.ixDifficulty] || ''}`}>
              {IX_LABEL[item.ixDifficulty] || item.ixDifficulty}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'Project Size',
      render: (item) => <span className="text-xs font-mono text-white/65">{item.mw ? `${item.mw} MW AC` : '—'}</span>,
    },
    {
      label: 'Technology',
      render: (item) => <span className="text-xs text-white/65">{item.technology || '—'}</span>,
    },
    {
      label: 'Stage',
      render: (item) => <span className="text-xs text-white/65">{item.stage || '—'}</span>,
    },
    {
      label: 'Source',
      render: (item) => (
        <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${
          item.source === 'library'
            ? 'text-violet-400 bg-violet-400/10 border-violet-400/25'
            : 'text-sky-400 bg-sky-400/10 border-sky-400/25'
        }`}>
          {item.source === 'library'
            ? `Saved ${new Date(item.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`
            : 'Live (Lens)'}
        </span>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl"
        style={{
          background: '#080E1A',
          border: '1px solid rgba(52,211,153,0.18)',
          boxShadow: '0 0 0 1px rgba(52,211,153,0.06), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Teal accent bar */}
        <div className="h-[3px] w-full rounded-t-xl" style={{ background: 'linear-gradient(90deg, #34D399 0%, #059669 60%, transparent 100%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Project Comparison</h2>
            <p className="text-[10px] font-mono text-white/30 mt-0.5 uppercase tracking-widest">
              {items.length} project{items.length !== 1 ? 's' : ''} · feasibility + key signals
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clear}
              className="text-[10px] font-mono text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded uppercase tracking-widest"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Column headers */}
          <div
            className="grid gap-4 pb-3 mb-1"
            style={{ gridTemplateColumns: `148px repeat(${items.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div />
            {items.map((item) => (
              <div key={item.id} className="px-1">
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xs font-bold text-white/85 leading-snug">{item.name}</p>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
                    </svg>
                  </button>
                </div>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{item.stateName}</p>
              </div>
            ))}
          </div>

          {/* Metric rows */}
          <div>
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
        <div className="px-6 py-3 rounded-b-xl" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[9px] font-mono text-white/20 leading-relaxed uppercase tracking-wide">
            Scores reflect Tractova's composite feasibility index. Verify interconnection and capacity with the serving utility before committing capital.
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
          className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: '#080E1A',
            border: '1px solid rgba(52,211,153,0.22)',
            boxShadow: '0 0 0 1px rgba(52,211,153,0.06), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Icon */}
          <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>

          {/* Project chips */}
          <div className="flex items-center gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 rounded-md px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span className="text-xs font-medium text-white/80 truncate max-w-[120px]">{item.name}</span>
                <button
                  onClick={() => remove(item.id)}
                  className="text-white/25 hover:text-white/70 transition-colors flex-shrink-0"
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
          <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Compare button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ background: '#059669' }}
            onMouseEnter={e => e.currentTarget.style.background = '#047857'}
            onMouseLeave={e => e.currentTarget.style.background = '#059669'}
          >
            Compare
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0"
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
