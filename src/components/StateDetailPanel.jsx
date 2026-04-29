import { useState } from 'react'
import { Link } from 'react-router-dom'

function formatRelativeDate(date) {
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 7)  return `Updated ${diffDays} days ago`
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
  return `Updated ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
}

const STATUS_CONFIG = {
  active:  { label: 'Active Program',   cls: 'bg-primary-50 text-primary-700 border border-primary-300 ring-1 ring-primary-200' },
  limited: { label: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border border-amber-300' },
  pending: { label: 'Pending Launch',   cls: 'bg-yellow-50 text-yellow-700 border border-yellow-300' },
  none:    { label: 'No Program',       cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
}

const IX_CONFIG = {
  easy:      { label: 'Easy',      cls: 'text-primary-700 bg-primary-50 border-primary-200' },
  moderate:  { label: 'Moderate',  cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  hard:      { label: 'Hard',      cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  very_hard: { label: 'Very Hard', cls: 'text-red-700 bg-red-50 border-red-200' },
}

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, score))
  // V3: align fill color with the choropleth ramp
  let barColor = '#F0FDFA'
  if (pct >= 75) barColor = '#0F766E'
  else if (pct >= 60) barColor = '#14B8A6'
  else if (pct >= 45) barColor = '#2DD4BF'
  else if (pct >= 25) barColor = '#99F6E4'

  return (
    <div>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-3xl font-bold font-mono text-gray-900 tabular-nums">{pct}</span>
        <span className="text-sm text-gray-400 mb-1">/ 100</span>
        <span className="text-xs text-gray-400 mb-1 ml-1">feasibility index</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-gray-800'} font-mono tabular-nums`}>{value}</span>
    </div>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
}

const TABS = [
  { id: 'program',     label: 'Program' },
  { id: 'market',      label: 'Market' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'news',        label: 'News' },
]

function TabBar({ active, onChange, newsCount }) {
  return (
    <div className="flex border-b border-gray-200 px-3 bg-gray-50">
      {TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-2 text-xs font-semibold transition-colors ${
              isActive ? 'text-brand' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.id === 'news' && newsCount > 0 && (
              <span className="ml-1 text-[10px] text-gray-400 font-mono">({newsCount})</span>
            )}
            {isActive && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5 rounded-t"
                style={{ background: '#14B8A6' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Program tab ────────────────────────────────────────────────────────────
function ProgramTab({ state, runway }) {
  if (state.csStatus === 'none') {
    return (
      <div className="px-5 py-6 text-center">
        <p className="text-xs text-gray-500">No community solar program in {state.name}.</p>
        <p className="text-[11px] text-gray-400 mt-1">Monitor for legislative activity or pivot to C&I/PPA structures.</p>
      </div>
    )
  }
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Program Identity</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="Program name" value={state.csProgram || '—'} />
          <StatRow label="Status" value={STATUS_CONFIG[state.csStatus]?.label || '—'} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Capacity</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="Remaining capacity" value={state.capacityMW > 0 ? `${state.capacityMW.toLocaleString()} MW` : '—'} highlight />
          {runway && (
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">Est. program runway</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded font-mono tabular-nums"
                style={{ background: RUNWAY_COLORS[runway.urgency].bg, color: RUNWAY_COLORS[runway.urgency].text }}
              >
                ~{runway.months} mo{runway.urgency === 'watch' ? ' · watch' : runway.urgency === 'urgent' ? ' · act now' : ''}
              </span>
            </div>
          )}
          {state.enrollmentRateMWPerMonth && (
            <StatRow label="Enrollment pace" value={`~${state.enrollmentRateMWPerMonth} MW/mo`} />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Eligibility</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="LMI allocation required" value={state.lmiRequired ? `Yes — ${state.lmiPercent}%` : 'No'} />
        </div>
      </div>

      {state.programNotes && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</h3>
          <div className="bg-surface rounded-md p-3">
            <p className="text-xs text-gray-600 leading-relaxed">{state.programNotes}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Market tab ─────────────────────────────────────────────────────────────
function MarketTab({ state }) {
  const ixCfg = IX_CONFIG[state.ixDifficulty] || IX_CONFIG.moderate
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Interconnection</h3>
        <div className="bg-surface rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">Difficulty rating:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${ixCfg.cls}`}>
              {ixCfg.label}
            </span>
          </div>
          {state.ixNotes && <p className="text-xs text-gray-600 leading-relaxed">{state.ixNotes}</p>}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Feasibility Index</h3>
        <div className="bg-surface rounded-md p-3">
          <ScoreBar score={state.feasibilityScore} />
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            Composite of Offtake (40%), Interconnection (35%), and Site Control (25%).
            Per-county breakdown available in <Link to={`/search?state=${state.id}`} className="text-primary hover:underline">Lens</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Subscribers tab (V3 Wave 2 placeholder) ────────────────────────────────
function SubscribersTab({ state }) {
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">LMI Requirement</h3>
        <div className="bg-surface rounded-md p-3">
          {state.lmiRequired ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800 font-mono tabular-nums">
                {state.lmiPercent}% LMI carve-out
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Of every project's capacity, {state.lmiPercent}% must be subscribed by qualifying low-to-moderate income households.
                Plan for 6–9 months of subscriber sourcing through CBO partnerships and aggregator contracts.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-600">No LMI requirement — full residential and commercial subscriber market is available.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Subscriber Intelligence</h3>
        <div className="bg-surface rounded-md p-3 border border-dashed border-gray-300">
          <p className="text-xs font-semibold text-gray-700 mb-1">Coming in next release</p>
          <ul className="text-[11px] text-gray-500 leading-relaxed space-y-1 ml-3 list-disc">
            <li>Per-county LMI household density (Census ACS)</li>
            <li>CCA enrollment penetration</li>
            <li>Top community-based organizations active in subscriber acquisition</li>
            <li>Aggregator partner directory by state</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── News tab ───────────────────────────────────────────────────────────────
function NewsTab({ state, news }) {
  if (news.length === 0) {
    return (
      <div className="px-5 py-6 text-center">
        <p className="text-xs text-gray-400">No recent activity for {state.name}.</p>
        <p className="text-[11px] text-gray-300 mt-1">Check back as policy developments are tracked.</p>
      </div>
    )
  }
  return (
    <div className="px-5 py-4">
      <div className="space-y-2">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface rounded-md p-3 hover:bg-gray-100 transition-colors"
          >
            <p className="text-xs font-medium text-gray-800 leading-snug">{item.headline}</p>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">
              {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StateDetailPanel({ state, news = [], onClose }) {
  const [activeTab, setActiveTab] = useState('program')
  if (!state) return null

  const status = STATUS_CONFIG[state.csStatus] || STATUS_CONFIG.none
  const runway = state.runway ?? null

  const relatedNews = news.filter(
    (item) => (item.stateIds ?? item.tags ?? []).includes(state.id)
  ).slice(0, 6)

  const latestDate = (() => {
    const v = state.lastVerified ? new Date(state.lastVerified) : null
    const u = state.updatedAt   ? new Date(state.updatedAt)   : null
    if (v && u) return v > u ? v : u
    return v || u
  })()
  const lastUpdatedFmt = latestDate ? formatRelativeDate(latestDate) : null
  const lastUpdatedFull = latestDate
    ? latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{state.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                {status.label}
              </span>
            </div>
            {state.csProgram && (
              <p className="text-xs text-gray-500 mt-0.5">{state.csProgram}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to={`/search?state=${state.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search in Lens
            </Link>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1 -m-1 rounded"
              aria-label="Close state panel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Score header */}
        <div className="mt-4">
          <ScoreBar score={state.feasibilityScore} />
        </div>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} newsCount={relatedNews.length} />

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'program'     && <ProgramTab state={state} runway={runway} />}
        {activeTab === 'market'      && <MarketTab state={state} />}
        {activeTab === 'subscribers' && <SubscribersTab state={state} />}
        {activeTab === 'news'        && <NewsTab state={state} news={relatedNews} />}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-gray-100 bg-chrome rounded-b-lg flex items-center justify-between">
        {lastUpdatedFmt && (
          <p className="text-xs text-gray-400 group relative cursor-default">
            {lastUpdatedFmt}
            {lastUpdatedFull && (
              <span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-[10px] bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none">
                {lastUpdatedFull}
              </span>
            )}
          </p>
        )}
        <Link
          to={`/search?state=${state.id}`}
          className="text-xs font-medium text-primary hover:text-primary-700 transition-colors"
        >
          Analyze in Lens →
        </Link>
      </div>
    </div>
  )
}
