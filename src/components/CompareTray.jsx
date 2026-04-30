import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCompare } from '../context/CompareContext'
import { supabase } from '../lib/supabase'

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
  const [aiCompare, setAiCompare] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (items.length < 2) return
    let cancelled = false
    setAiLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      fetch('/api/lens-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'compare',
          projects: items.map(it => ({
            id: it.id, name: it.name, state: it.stateName || it.state,
            county: it.county, mw: it.mw, stage: it.stage,
            technology: it.technology, feasibilityScore: it.feasibilityScore,
            ixDifficulty: it.ixDifficulty, csStatus: it.csStatus
          }))
        })
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!cancelled && data?.comparison) setAiCompare(data) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setAiLoading(false) })
    })
    return () => { cancelled = true }
  }, [items.length])

  // V3.1: rows reorganized into "Composite + Pillars" / "Project" / "Source"
  // sections. New rows surface CS capacity (program runway) and LMI carveout
  // (subscriber-sourcing complexity) -- both decision-critical signals that
  // were previously missing from the compare view.
  const fmtCap = (mw) => mw == null ? '—' : mw >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`
  const rows = [
    {
      label: 'Feasibility Index',
      section: 'COMPOSITE',
      render: (item) => <ScoreBar score={item.feasibilityScore} />,
    },
    {
      label: 'CS Program Status',
      section: 'COMPOSITE',
      render: (item) => (
        item.csStatus
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-sm border ${CS_CLS[item.csStatus] || CS_CLS.none}`}>
              {CS_LABEL[item.csStatus] || item.csStatus}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'CS Program',
      section: 'COMPOSITE',
      render: (item) => <span className="text-xs text-white/65">{item.csProgram || '—'}</span>,
    },
    {
      label: 'Program Capacity',
      section: 'COMPOSITE',
      render: (item) => (
        <span className="text-xs font-mono text-white/65">
          {item.capacityMW != null
            ? <><span className="text-white/85 font-semibold">{fmtCap(item.capacityMW)}</span><span className="text-white/35 ml-1">remaining</span></>
            : '—'}
        </span>
      ),
    },
    {
      label: 'IX Difficulty',
      section: 'COMPOSITE',
      render: (item) => (
        item.ixDifficulty
          ? <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-sm border ${IX_CLS[item.ixDifficulty] || ''}`}>
              {IX_LABEL[item.ixDifficulty] || item.ixDifficulty}
            </span>
          : <span className="text-xs text-white/25 font-mono">—</span>
      ),
    },
    {
      label: 'LMI Carveout',
      section: 'COMPOSITE',
      render: (item) => {
        if (item.lmiRequired === false || item.lmiPercent === 0) {
          return <span className="text-[10px] font-mono text-emerald-300/85">Not required</span>
        }
        if (item.lmiRequired && item.lmiPercent > 0) {
          const tone = item.lmiPercent >= 50 ? 'text-orange-300' : item.lmiPercent >= 30 ? 'text-amber-300' : 'text-yellow-300'
          return (
            <span className={`text-xs font-mono ${tone}`}>
              <span className="font-semibold">{item.lmiPercent}%</span><span className="text-white/35 ml-1">required</span>
            </span>
          )
        }
        return <span className="text-xs text-white/25 font-mono">—</span>
      },
    },
    {
      label: 'Project Size',
      section: 'PROJECT',
      render: (item) => <span className="text-xs font-mono text-white/65">{item.mw ? `${item.mw} MW AC` : '—'}</span>,
    },
    {
      label: 'Technology',
      section: 'PROJECT',
      render: (item) => <span className="text-xs text-white/65">{item.technology || '—'}</span>,
    },
    {
      label: 'Stage',
      section: 'PROJECT',
      render: (item) => <span className="text-xs text-white/65">{item.stage || '—'}</span>,
    },
    {
      label: 'Source',
      section: 'PROJECT',
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

  // Auto-generated "Best for" summary
  const bestFor = (() => {
    if (items.length < 2) return null
    const IX_RANK = { easy: 3, moderate: 2, hard: 1, very_hard: 0 }
    const bestScore = items.reduce((best, item) => (!best || (item.feasibilityScore ?? 0) > (best.feasibilityScore ?? 0)) ? item : best, null)
    const bestIX = items.reduce((best, item) => (!best || (IX_RANK[item.ixDifficulty] ?? 0) > (IX_RANK[best.ixDifficulty] ?? 0)) ? item : best, null)
    const parts = []
    if (bestScore) parts.push(`${bestScore.name} has the strongest feasibility index`)
    if (bestIX && bestIX.id !== bestScore?.id) parts.push(`${bestIX.name} has easier interconnection`)
    return parts.join(' · ') || null
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />
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
              className="text-[10px] font-mono text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded-sm uppercase tracking-widest"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-sm"
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white/85 leading-snug">{item.name}</p>
                    {aiCompare?.recommendedId === item.id && (
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ color: '#34D399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
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

          {/* Metric rows -- grouped by section so the dossier reads as
              two distinct chambers (Composite, Project) instead of one
              long ungrouped list. */}
          <div>
            {Array.from(new Set(rows.map(r => r.section))).map(section => (
              <div key={section}>
                <div
                  className="grid gap-4 pt-3 pb-1"
                  style={{ gridTemplateColumns: `148px repeat(${items.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span
                    className="text-[8px] font-mono uppercase tracking-[0.32em] text-white/30 pr-2 leading-none"
                    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                  >
                    § {section === 'COMPOSITE' ? '01' : '02'} · {section}
                  </span>
                  {items.map(it => <span key={it.id} />)}
                </div>
                {rows.filter(r => r.section === section).map(row => (
                  <MetricRow
                    key={row.label}
                    label={row.label}
                    values={items.map((item) => row.render(item))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* "Open in Lens" row */}
        <div className="px-6 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: `148px repeat(${items.length}, 1fr)` }}>
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/30 py-2 pr-2">
              Actions
            </span>
            {items.map((item) => (
              <div key={item.id} className="py-2 px-1">
                <Link
                  to={`/search?state=${item.state}&county=${encodeURIComponent(item.county)}&mw=${item.mw || ''}&stage=${encodeURIComponent(item.stage || '')}&technology=${encodeURIComponent(item.technology || '')}`}
                  className="text-[10px] font-semibold px-2 py-1 rounded-sm border transition-colors"
                  style={{ color: '#34D399', borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)' }}
                  onClick={onClose}
                >
                  Open in Lens
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* AI comparison + footer */}
        <div className="px-6 py-4 rounded-b-xl" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          {bestFor && (
            <p className="text-[10px] font-medium mb-3" style={{ color: '#34D399' }}>
              {bestFor}
            </p>
          )}
          {aiLoading ? (
            <div className="mb-3 rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.08)' }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-5 h-5 rounded-md animate-pulse" style={{ background: 'rgba(52,211,153,0.2)' }} />
                <div className="h-2.5 w-32 rounded-sm bg-white/8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-2.5 w-full rounded-sm bg-white/5 animate-pulse" />
                <div className="h-2.5 w-4/5 rounded-sm bg-white/5 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="h-14 rounded-lg bg-white/3 animate-pulse" />
                <div className="h-14 rounded-lg bg-white/3 animate-pulse" />
              </div>
            </div>
          ) : aiCompare?.comparison ? (
            <div className="mb-3 rounded-xl overflow-hidden" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.10)' }}>
              <div className="px-4 pt-3 pb-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(52,211,153,0.06)' }}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(5,150,105,0.3))' }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34D399' }}>AI Comparison Analysis</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] leading-relaxed text-white/65">{aiCompare.comparison}</p>
              </div>
              {aiCompare.reason && (
                <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.08)' }}>
                  <svg className="w-3 h-3 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <p className="text-[10px] text-white/50 leading-relaxed">{aiCompare.reason}</p>
                </div>
              )}
            </div>
          ) : null}
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
          <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
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
                  className="text-white/25 hover:text-white/70 transition-colors shrink-0"
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
          <div className="w-px h-5 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Compare button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
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
            className="text-white/25 hover:text-white/60 transition-colors shrink-0"
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
