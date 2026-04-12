import { useState } from 'react'
import metrics from '../data/metrics'
import statePrograms from '../data/statePrograms'
import newsFeed from '../data/newsFeed'

// ── Modal detail content per card ────────────────────────────────────────────

function ActiveCSDetail() {
  const active = statePrograms
    .filter((s) => s.csStatus === 'active')
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        These {active.length} states have currently open, funded community solar programs accepting new project applications or subscriber enrollments.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-400 font-semibold">State</th>
            <th className="text-left py-1.5 text-gray-400 font-semibold">Program</th>
            <th className="text-right py-1.5 text-gray-400 font-semibold">Capacity Left</th>
            <th className="text-right py-1.5 text-gray-400 font-semibold">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {active.map((s) => (
            <tr key={s.id} className="hover:bg-surface">
              <td className="py-2 font-semibold text-gray-800">{s.name}</td>
              <td className="py-2 text-gray-600">{s.csProgram}</td>
              <td className="py-2 text-right text-primary font-medium">{s.capacityMW.toLocaleString()} MW</td>
              <td className="py-2 text-right text-gray-500">{s.opportunityScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IXCapacityDetail() {
  const notes = [
    { utility: 'Xcel Energy (CO, MN)', territory: 'WECC / MISO', status: 'Headroom available' },
    { utility: 'ComEd (IL)', territory: 'MISO', status: 'Headroom available' },
    { utility: 'PNM (NM)', territory: 'WECC', status: 'Headroom available' },
    { utility: 'Dominion Energy (VA)', territory: 'PJM', status: 'Improving — see SCC order' },
    { utility: 'Pacific Power (OR)', territory: 'WECC', status: 'Headroom available' },
    { utility: 'Puget Sound Energy (WA)', territory: 'WECC', status: 'Moderate headroom' },
    { utility: 'CMP / Versant (ME)', territory: 'ISO-NE', status: 'Improving' },
  ]
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Utilities estimated to have meaningful interconnection queue capacity based on FERC Form 1 data, ISO/RTO queue reports, and recent ISA withdrawal activity. Per-utility detail data is coming in Iteration 2.
      </p>
      <div className="bg-accent-50 border border-accent-200 rounded-md px-3 py-2.5 mb-4">
        <p className="text-xs text-accent-700 font-medium">Methodology note</p>
        <p className="text-xs text-accent-700 mt-0.5">
          Count is derived from public FERC and ISO/RTO queue data. "Headroom" means the utility has capacity on at least one transmission line segment without requiring major network upgrades for projects ≤5MW AC.
        </p>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Representative utilities</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-400 font-semibold">Utility</th>
            <th className="text-left py-1.5 text-gray-400 font-semibold">Territory</th>
            <th className="text-left py-1.5 text-gray-400 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {notes.map((n) => (
            <tr key={n.utility}>
              <td className="py-2 font-medium text-gray-800">{n.utility}</td>
              <td className="py-2 text-gray-500">{n.territory}</td>
              <td className="py-2 text-primary">{n.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-3">Full utility-level data with ease scores launches in Iteration 2.</p>
    </div>
  )
}

function PolicyAlertsDetail() {
  const recent = [...newsFeed]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7)

  const PILLAR_BADGE = {
    offtake: 'bg-primary-50 text-primary-700 border-primary-200',
    ix:      'bg-accent-50 text-accent-700 border-accent-200',
    site:    'bg-blue-50 text-blue-700 border-blue-200',
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Most recent policy and market developments across all three pillars.
      </p>
      {recent.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-gray-100 rounded-md px-3 py-2.5 hover:bg-surface transition-colors"
        >
          <p className="text-xs font-medium text-gray-900 leading-snug">{item.headline}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PILLAR_BADGE[item.pillar]}`}>
              {item.pillar === 'ix' ? 'Interconnection' : item.pillar.charAt(0).toUpperCase() + item.pillar.slice(1)}
            </span>
            <span className="text-xs text-gray-400">
              {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </a>
      ))}
    </div>
  )
}

function AvgCapacityDetail() {
  const states = statePrograms
    .filter((s) => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.capacityMW - a.capacityMW)
  const total = states.reduce((sum, s) => sum + s.capacityMW, 0)

  const STATUS_BADGE = {
    active:  'bg-primary-50 text-primary-700 border-primary-200',
    limited: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Average remaining capacity across active and limited programs, weighted equally by program. Capacity figures are manually curated — automated data in Iteration 5.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-1.5 text-gray-400 font-semibold">State</th>
            <th className="text-left py-1.5 text-gray-400 font-semibold">Status</th>
            <th className="text-right py-1.5 text-gray-400 font-semibold">Remaining (MW)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {states.map((s) => (
            <tr key={s.id} className="hover:bg-surface">
              <td className="py-2 font-medium text-gray-800">{s.name}</td>
              <td className="py-2">
                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[s.csStatus]}`}>
                  {s.csStatus === 'active' ? 'Active' : 'Limited'}
                </span>
              </td>
              <td className="py-2 text-right font-semibold text-primary">{s.capacityMW.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200">
            <td colSpan={2} className="py-2 font-semibold text-gray-700">Total</td>
            <td className="py-2 text-right font-bold text-gray-900">{total.toLocaleString()} MW</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MWPipelineDetail() {
  const states = statePrograms
    .filter((s) => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.capacityMW - a.capacityMW)
  const total = states.reduce((sum, s) => sum + s.capacityMW, 0)

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Total megawatts of remaining capacity across all active and limited community solar programs. This represents the addressable pipeline for independent developers today.
      </p>
      <div className="space-y-2">
        {states.map((s) => {
          const pct = Math.round((s.capacityMW / total) * 100)
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="font-medium text-gray-700">{s.name}</span>
                <span className="text-primary font-semibold">{s.capacityMW.toLocaleString()} MW</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
        <span className="font-semibold text-gray-700">Total addressable pipeline</span>
        <span className="font-bold text-gray-900">{total.toLocaleString()} MW</span>
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function MetricsModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 -m-1 rounded"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
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

// ── Card definitions ──────────────────────────────────────────────────────────

const CARDS = [
  {
    key: 'activeCS',
    label: 'States w/ Active CS',
    value: metrics.statesWithActiveCS,
    sub: `${metrics.statesWithAnyCS} with any program`,
    icon: <IconMap />,
    alert: false,
    modalTitle: `${metrics.statesWithActiveCS} States with Active Community Solar Programs`,
    ModalContent: ActiveCSDetail,
  },
  {
    key: 'ixCapacity',
    label: 'Utilities w/ IX Capacity',
    value: metrics.utilitiesWithIXHeadroom,
    sub: 'open queue capacity',
    icon: <IconZap />,
    alert: false,
    modalTitle: `${metrics.utilitiesWithIXHeadroom} Utilities with Interconnection Headroom`,
    ModalContent: IXCapacityDetail,
  },
  {
    key: 'policyAlerts',
    label: 'Policy Alerts',
    value: metrics.policyAlertsThisWeek,
    sub: 'this week · all pillars',
    icon: <IconBell />,
    alert: true,
    modalTitle: 'Policy Alerts This Week',
    ModalContent: PolicyAlertsDetail,
  },
  {
    key: 'avgCapacity',
    label: 'Avg CS Capacity Left',
    value: metrics.avgCSCapacityRemaining,
    sub: 'across active programs',
    icon: <IconGauge />,
    alert: false,
    modalTitle: `Average CS Capacity Remaining: ${metrics.avgCSCapacityRemaining}`,
    ModalContent: AvgCapacityDetail,
  },
  {
    key: 'mwPipeline',
    label: 'MW in Active Pipeline',
    value: metrics.totalMWInPipeline.toLocaleString(),
    sub: 'active + limited states',
    icon: <IconTrendingUp />,
    alert: false,
    modalTitle: `${metrics.totalMWInPipeline.toLocaleString()} MW in Active CS Pipeline`,
    ModalContent: MWPipelineDetail,
  },
]

const CARD_BG = 'linear-gradient(145deg, #0A3D32 0%, #051F19 100%)'

// ── Main component ────────────────────────────────────────────────────────────

export default function MetricsBar() {
  const [openKey, setOpenKey] = useState(null)
  const openCard = CARDS.find((c) => c.key === openKey)

  return (
    <>
      <div className="grid grid-cols-5 gap-3 mt-6">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => setOpenKey(c.key)}
            className="relative overflow-hidden rounded-xl text-left transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
            style={{ background: CARD_BG }}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary-400/60 via-primary-300/80 to-primary-400/60" />

            {/* Watermark icon */}
            <div className="absolute top-3 right-3 text-white/[0.07] pointer-events-none select-none">
              {c.icon}
            </div>

            {/* Alert pulse dot */}
            {c.alert && (
              <span className="absolute top-3.5 left-[4.5rem] flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-400" />
              </span>
            )}

            <div className="relative px-5 py-5">
              {/* Label */}
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2.5 leading-none">
                {c.label}
              </p>

              {/* Value */}
              <div className="text-[2rem] font-bold text-white leading-none tabular-nums">
                {c.value}
              </div>

              {/* Sub */}
              <div className="text-[11px] text-white/35 mt-2 leading-none">{c.sub}</div>

              {/* Hover CTA */}
              <div className="flex items-center gap-1 mt-4 text-[10px] font-medium text-white/0 group-hover:text-white/50 transition-all duration-200 uppercase tracking-wider">
                <span>Details</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>

            {/* Bottom shimmer on hover */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
        ))}
      </div>

      {openCard && (
        <MetricsModal title={openCard.modalTitle} onClose={() => setOpenKey(null)}>
          <openCard.ModalContent />
        </MetricsModal>
      )}
    </>
  )
}
