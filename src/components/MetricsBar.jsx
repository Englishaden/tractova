import { useState, useEffect } from 'react'
import { getDashboardMetrics, getStatePrograms, getNewsFeed } from '../lib/programData'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import PreviewSignupGate from './PreviewSignupGate'

// In preview mode, modal-content panels render this many rows + a gate.
// Picked low enough that visitors see the SHAPE of the data without
// getting all of it, high enough they get a real taste.
const PREVIEW_ROW_LIMIT = 3

// ── Modal detail content per card ────────────────────────────────────────────

function ActiveCSDetail({ programs = [], previewMode = false }) {
  const active = programs
    .filter((s) => s.csStatus === 'active')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const visible = previewMode ? active.slice(0, PREVIEW_ROW_LIMIT) : active
  const hidden  = previewMode ? Math.max(0, active.length - PREVIEW_ROW_LIMIT) : 0
  return (
    <div>
      <p className="text-xs text-white/45 mb-3">
        These {active.length} states have currently open, funded community solar programs accepting new project applications or subscriber enrollments.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/6">
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">State</th>
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Program</th>
            <th className="text-right py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Capacity Left</th>
            <th className="text-right py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {visible.map((s) => (
            <tr key={s.id} className="hover:bg-white/2.5 transition-colors">
              <td className="py-2 font-semibold text-white/80">{s.name}</td>
              <td className="py-2 text-white/45">{s.csProgram}</td>
              <td className="py-2 text-right text-emerald-400 font-mono">{s.capacityMW.toLocaleString()} MW</td>
              <td className="py-2 text-right text-white/45 font-mono">{s.feasibilityScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {previewMode && hidden > 0 && (
        <PreviewSignupGate compact message={`Plus ${hidden} more state${hidden === 1 ? '' : 's'} with active programs. Sign up to see the full breakdown.`} />
      )}
    </div>
  )
}

function IXCapacityDetail({ previewMode = false }) {
  const notes = [
    { utility: 'Xcel Energy (CO, MN)', territory: 'WECC / MISO', status: 'Headroom available' },
    { utility: 'ComEd (IL)', territory: 'MISO', status: 'Headroom available' },
    { utility: 'PNM (NM)', territory: 'WECC', status: 'Headroom available' },
    { utility: 'Dominion Energy (VA)', territory: 'PJM', status: 'Improving — see SCC order' },
    { utility: 'Pacific Power (OR)', territory: 'WECC', status: 'Headroom available' },
    { utility: 'Puget Sound Energy (WA)', territory: 'WECC', status: 'Moderate headroom' },
    { utility: 'CMP / Versant (ME)', territory: 'ISO-NE', status: 'Improving' },
  ]
  const visible = previewMode ? notes.slice(0, PREVIEW_ROW_LIMIT) : notes
  const hidden  = previewMode ? Math.max(0, notes.length - PREVIEW_ROW_LIMIT) : 0
  return (
    <div>
      <p className="text-xs text-white/45 mb-3">
        Utilities estimated to have meaningful interconnection queue capacity based on FERC Form 1 data, ISO/RTO queue reports, and recent ISA withdrawal activity. Per-utility detail data available on request.
      </p>
      <div className="rounded-md px-3 py-2.5 mb-4" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-400/80">Methodology note</p>
        <p className="text-xs text-amber-300/70 mt-1">
          Count is derived from public FERC and ISO/RTO queue data. "Headroom" means the utility has capacity on at least one transmission line segment without requiring major network upgrades for projects ≤5MW AC.
        </p>
      </div>
      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/40 mb-2">Representative utilities</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/6">
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Utility</th>
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Territory</th>
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {visible.map((n) => (
            <tr key={n.utility} className="hover:bg-white/2.5 transition-colors">
              <td className="py-2 font-medium text-white/80">{n.utility}</td>
              <td className="py-2 text-white/40">{n.territory}</td>
              <td className="py-2 text-emerald-400">{n.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {previewMode && hidden > 0 ? (
        <PreviewSignupGate compact message={`Plus ${hidden} more utilities with IX headroom analysis. Sign up to see the full list.`} />
      ) : (
        <p className="text-xs text-white/30 mt-3">Full utility-level data with ease scores updated as queue reports are published.</p>
      )}
    </div>
  )
}

function PolicyAlertsDetail({ news = [], previewMode = false }) {
  const allRecent = [...news]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7)
  const recent = previewMode ? allRecent.slice(0, PREVIEW_ROW_LIMIT) : allRecent
  const hidden = previewMode ? Math.max(0, allRecent.length - PREVIEW_ROW_LIMIT) : 0

  const PILLAR_BADGE = {
    offtake: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    ix:      'bg-amber-400/10 text-amber-400 border-amber-400/20',
    site:    'bg-sky-400/10 text-sky-400 border-sky-400/20',
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-white/45">
        Most recent policy and market developments across all three pillars.
      </p>
      {recent.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md px-3 py-2.5 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
        >
          <p className="text-xs font-medium text-white/80 leading-snug">{item.headline}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border uppercase tracking-wider ${PILLAR_BADGE[item.pillar]}`}>
              {item.pillar === 'ix' ? 'Interconnection' : item.pillar.charAt(0).toUpperCase() + item.pillar.slice(1)}
            </span>
            <span className="text-xs text-white/35">
              {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </a>
      ))}
      {previewMode && hidden > 0 && (
        <PreviewSignupGate compact message={`Plus ${hidden} more recent policy / market alert${hidden === 1 ? '' : 's'}. Sign up to read all the headlines.`} />
      )}
    </div>
  )
}

function AvgCapacityDetail({ programs = [], previewMode = false }) {
  const states = programs
    .filter((s) => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.capacityMW - a.capacityMW)
  const total = states.reduce((sum, s) => sum + s.capacityMW, 0)
  const visible = previewMode ? states.slice(0, PREVIEW_ROW_LIMIT) : states
  const hidden  = previewMode ? Math.max(0, states.length - PREVIEW_ROW_LIMIT) : 0

  const STATUS_BADGE = {
    active:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    limited: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  }

  return (
    <div>
      <p className="text-xs text-white/45 mb-3">
        Average remaining capacity across active and limited programs, weighted equally by program. Capacity figures sourced from state program administrators and updated weekly.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/6">
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">State</th>
            <th className="text-left py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Status</th>
            <th className="text-right py-1.5 text-[9px] font-mono uppercase tracking-widest text-white/40">Remaining (MW)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {visible.map((s) => (
            <tr key={s.id} className="hover:bg-white/2.5 transition-colors">
              <td className="py-2 font-medium text-white/80">{s.name}</td>
              <td className="py-2">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border uppercase tracking-wider ${STATUS_BADGE[s.csStatus]}`}>
                  {s.csStatus === 'active' ? 'Active' : 'Limited'}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-emerald-400">{s.capacityMW.toLocaleString()}</td>
            </tr>
          ))}
          {!previewMode && (
            <tr className="border-t border-white/8">
              <td colSpan={2} className="py-2 font-semibold text-white/60">Total</td>
              <td className="py-2 text-right font-mono font-bold text-white/90">{total.toLocaleString()} MW</td>
            </tr>
          )}
        </tbody>
      </table>
      {previewMode && hidden > 0 && (
        <PreviewSignupGate compact message={`Plus ${hidden} more state${hidden === 1 ? '' : 's'} (totaling ${total.toLocaleString()} MW of remaining capacity). Sign up to see the full breakdown.`} />
      )}
    </div>
  )
}

function MWPipelineDetail({ programs = [], previewMode = false }) {
  const states = programs
    .filter((s) => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.capacityMW - a.capacityMW)
  const total = states.reduce((sum, s) => sum + s.capacityMW, 0)
  const visible = previewMode ? states.slice(0, PREVIEW_ROW_LIMIT) : states
  const hidden  = previewMode ? Math.max(0, states.length - PREVIEW_ROW_LIMIT) : 0

  return (
    <div>
      <p className="text-xs text-white/45 mb-3">
        Total megawatts of remaining capacity across all active and limited community solar programs. This represents the addressable pipeline for independent developers today.
      </p>
      <div className="space-y-2.5">
        {visible.map((s) => {
          const pct = Math.round((s.capacityMW / total) * 100)
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-white/75">{s.name}</span>
                <span className="text-emerald-400 font-mono">{s.capacityMW.toLocaleString()} MW</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      {previewMode && hidden > 0 ? (
        <PreviewSignupGate compact message={`Plus ${hidden} more state${hidden === 1 ? '' : 's'} (totaling ${total.toLocaleString()} MW addressable). Sign up to see the full pipeline.`} />
      ) : (
        <div className="mt-4 pt-3 flex justify-between text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="font-semibold text-white/60">Total addressable pipeline</span>
          <span className="font-mono font-bold text-white/90">{total.toLocaleString()} MW</span>
        </div>
      )}
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function MetricsModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative rounded-lg w-full max-w-lg flex flex-col"
        style={{
          background: '#080E1A',
          border: '1px solid rgba(20,184,166,0.20)',
          boxShadow: '0 0 0 1px rgba(20,184,166,0.08), 0 32px 64px rgba(0,0,0,0.8)',
          maxHeight: '80vh',
        }}
      >
        {/* Top accent bar — V3 teal */}
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.5) 0%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.5) 100%)' }} />

        {/* Header */}
        <div
          className="px-5 pt-5 pb-3.5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0D1424', borderRadius: '0.5rem 0.5rem 0 0' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-3.5 rounded-full shrink-0" style={{ background: 'rgba(20,184,166,0.75)' }} />
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-white/85">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors font-mono text-lg leading-none px-1 -mr-1"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconMap() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconGauge() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10"/>
      <path d="M12 6v6l4 2"/>
      <circle cx="19" cy="19" r="3"/>
      <path d="M19 16v3h3"/>
    </svg>
  )
}
function IconTrendingUp() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

// V3: brand navy chrome with teal accent rails (replaces dark emerald cards)
const CARD_BG = 'linear-gradient(145deg, #0F1A2E 0%, #0A132A 100%)'

// Returns days-since if > 14, otherwise null (signal only shown when stale)
function staleDays(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  return days > 14 ? days : null
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MetricsBar({ previewMode = false }) {
  const [openKey, setOpenKey]     = useState(null)
  const [liveMetrics, setLiveMetrics] = useState(null)
  const [programs, setPrograms]   = useState([])
  const [news, setNews]           = useState([])

  useEffect(() => {
    getDashboardMetrics().then(setLiveMetrics).catch(console.error)
    getStatePrograms().then(setPrograms).catch(console.error)
    getNewsFeed().then(setNews).catch(console.error)
  }, [])

  // ESC key closes the detail modal
  useEffect(() => {
    if (!openKey) return
    const handle = (e) => { if (e.key === 'Escape') setOpenKey(null) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [openKey])

  // Live values from Supabase with graceful defaults while loading
  const m = {
    statesWithActiveCS:     liveMetrics?.statesWithActiveCS     ?? '—',
    statesWithAnyCS:        liveMetrics?.statesWithAnyCS        ?? '—',
    utilitiesWithIXHeadroom: liveMetrics?.utilitiesWithIXHeadroom ?? '—',
    policyAlertsThisWeek:   liveMetrics?.policyAlertsThisWeek   ?? '—',
    avgCSCapacityRemaining: liveMetrics?.avgCSCapacityRemaining  ?? '—',
    totalMWInPipeline:      liveMetrics?.totalMWInPipeline       ?? '—',
    lastUpdated:            liveMetrics?.lastUpdated             ?? null,
  }

  const CARDS = [
    {
      key: 'activeCS',
      label: 'CS Coverage',
      value: m.statesWithActiveCS,
      sub: `${m.statesWithAnyCS} with any program`,
      icon: <IconMap />,
      modalTitle: 'CS Coverage — Active Markets',
      hint: 'States with funded community solar programs currently accepting new project applications. The denominator counts any state that has a CS statute on the books — including pending and limited.',
      ModalContent: () => <ActiveCSDetail programs={programs} previewMode={previewMode} />,
    },
    {
      key: 'ixCapacity',
      label: 'IX Headroom',
      value: m.utilitiesWithIXHeadroom,
      sub: 'open queue capacity',
      icon: <IconZap />,
      modalTitle: 'IX Headroom — Open Queues',
      hint: 'Utilities estimated to have meaningful interconnection queue capacity for ≤5 MW projects, derived from FERC Form 1 data and ISO/RTO queue reports.',
      ModalContent: () => <IXCapacityDetail previewMode={previewMode} />,
    },
    {
      key: 'policyAlerts',
      label: 'Policy Pulse',
      value: m.policyAlertsThisWeek,
      sub: 'this week · all pillars',
      icon: <IconBell />,
      modalTitle: 'Policy Pulse — This Week',
      hint: 'Count of news-feed items published in the last 7 days across the three pillars (offtake, interconnection, site). Click for the underlying headlines.',
      ModalContent: () => <PolicyAlertsDetail news={news} previewMode={previewMode} />,
    },
    {
      key: 'avgCapacity',
      label: 'Avg Capacity',
      value: (() => {
        const raw = m.avgCSCapacityRemaining
        const num = typeof raw === 'string' ? parseInt(raw, 10) : raw
        return isNaN(num) ? raw : `${num} MW`
      })(),
      sub: 'avg remaining · active states',
      icon: <IconGauge />,
      modalTitle: 'Average Capacity Remaining — Active Programs',
      hint: 'Mean MW of program capacity still open across active and limited states, equally weighted. A leading indicator of how much addressable runway is left in each market.',
      ModalContent: () => <AvgCapacityDetail programs={programs} previewMode={previewMode} />,
    },
    {
      key: 'mwPipeline',
      label: 'Pipeline Load',
      value: typeof m.totalMWInPipeline === 'number' ? m.totalMWInPipeline.toLocaleString() : m.totalMWInPipeline,
      sub: 'active + limited states',
      icon: <IconTrendingUp />,
      modalTitle: 'Pipeline Load — Active + Limited',
      hint: 'Total MW of remaining capacity across all active and limited CS programs — the addressable pipeline for independent developers today.',
      ModalContent: () => <MWPipelineDetail programs={programs} previewMode={previewMode} />,
    },
  ]

  const openCard = CARDS.find((c) => c.key === openKey)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        {CARDS.map((c) => (
          <Tooltip key={c.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setOpenKey(c.key)}
                className="relative overflow-hidden rounded-xl text-left transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                style={{ background: CARD_BG }}
              >
                {/* Top accent line — V3 teal */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />

                {/* Icon */}
                <div className="absolute top-3 right-3 pointer-events-none select-none" style={{ color: 'rgba(20,184,166,0.55)' }}>
                  {c.icon}
                </div>

                <div className="relative px-5 py-5">
                  {/* Label */}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2.5 leading-none">
                    {c.label}
                  </p>

                  {/* Value */}
                  <div className="text-2xl font-bold font-mono text-white leading-none tabular-nums">
                    {c.value}
                  </div>

                  {/* Sub */}
                  <div className="text-[11px] text-white/60 mt-2 leading-none">{c.sub}</div>

                  {/* Hover CTA */}
                  <div className="flex items-center gap-1 mt-4 text-[10px] font-medium text-white/0 group-hover:text-white/55 transition-all duration-200 uppercase tracking-wider">
                    <span>Details</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>

                {/* Bottom shimmer on hover — V3 teal */}
                <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.4) 50%, transparent 100%)' }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50 mb-1">{c.label}</p>
              <p className="text-[12px] leading-relaxed">{c.hint}</p>
              <p className="text-[10px] text-white/40 mt-2">Click for full breakdown.</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {(() => {
        const stale = staleDays(liveMetrics?.lastUpdated)
        return stale ? (
          <p className="text-right text-[10px] font-mono mt-1.5" style={{ color: 'rgba(156,163,175,0.50)' }}>
            <span style={{ color: 'rgba(156,163,175,0.35)' }}>⚠</span> data verified {stale}d ago
          </p>
        ) : null
      })()}

      {openCard && (
        <MetricsModal title={openCard.modalTitle} onClose={() => setOpenKey(null)}>
          <openCard.ModalContent />
        </MetricsModal>
      )}
    </>
  )
}
