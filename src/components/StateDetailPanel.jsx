import { Link } from 'react-router-dom'

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
  let barColor = 'bg-gray-300'
  if (pct >= 75) barColor = 'bg-primary'
  else if (pct >= 55) barColor = 'bg-primary-400'
  else if (pct >= 40) barColor = 'bg-accent-400'
  else if (pct >= 25) barColor = 'bg-amber-300'

  return (
    <div>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-3xl font-bold text-gray-900">{pct}</span>
        <span className="text-sm text-gray-400 mb-1">/ 100</span>
        <span className="text-xs text-gray-400 mb-1 ml-1">feasibility score</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
}

export default function StateDetailPanel({ state, news = [], onClose }) {
  if (!state) return null

  const status = STATUS_CONFIG[state.csStatus] || STATUS_CONFIG.none
  const ixCfg  = IX_CONFIG[state.ixDifficulty] || IX_CONFIG.moderate
  const runway = state.runway ?? null

  // Relevant news items for this state — passed from Dashboard (already live)
  const relatedNews = news.filter(
    (item) => (item.stateIds ?? item.tags ?? []).includes(state.id)
  ).slice(0, 4)

  const lastUpdatedFmt = state.lastVerified
    ? new Date(state.lastVerified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

        {/* Opportunity score */}
        <div className="mt-4">
          <ScoreBar score={state.feasibilityScore} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Offtake / CS Program */}
        <Section title="Offtake — Community Solar">
          {state.csStatus === 'none' ? (
            <p className="text-xs text-gray-400 italic">No community solar program in this state.</p>
          ) : (
            <div className="bg-surface rounded-md p-3 space-y-0.5">
              <StatRow label="Program capacity remaining" value={state.capacityMW > 0 ? `${state.capacityMW.toLocaleString()} MW` : '—'} highlight />
              {runway && (
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Est. program runway</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: RUNWAY_COLORS[runway.urgency].bg, color: RUNWAY_COLORS[runway.urgency].text }}
                    >
                      ~{runway.months} months{runway.urgency === 'watch' ? ' — watch' : runway.urgency === 'urgent' ? ' — act now' : ''}
                    </span>
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">est.</span>
                  </div>
                </div>
              )}
              <StatRow label="LMI allocation required"    value={state.lmiRequired ? `Yes — ${state.lmiPercent}%` : 'No'} />
              {state.programNotes && (
                <p className="text-xs text-gray-500 pt-1 leading-relaxed">{state.programNotes}</p>
              )}
            </div>
          )}
        </Section>

        {/* Interconnection */}
        <Section title="Interconnection">
          <div className="bg-surface rounded-md p-3 space-y-0.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Difficulty rating:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${ixCfg.cls}`}>
                {ixCfg.label}
              </span>
            </div>
            {state.ixNotes && (
              <p className="text-xs text-gray-500 leading-relaxed">{state.ixNotes}</p>
            )}
          </div>
        </Section>

        {/* Related news */}
        {relatedNews.length > 0 && (
          <Section title={`Recent News — ${state.id}`}>
            <div className="space-y-2">
              {relatedNews.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-surface rounded-md p-3 hover:bg-gray-100 transition-colors"
                >
                  <p className="text-xs font-medium text-gray-800 leading-snug">{item.headline}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* No program placeholder */}
        {state.csStatus === 'none' && relatedNews.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">No recent activity for {state.name}.</p>
            <p className="text-xs text-gray-300 mt-1">Check back as policy developments are tracked.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-gray-100 bg-chrome rounded-b-lg flex items-center justify-between">
        {lastUpdatedFmt && <p className="text-xs text-gray-400">Updated: {lastUpdatedFmt}</p>}
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
