import { CollapsibleCard, CardDrilldown, EaseArcGauge, QueueBadge, SectionLabel } from '../pages/Search.jsx'

export default function InterconnectionCard({ interconnection, stateProgram, stateId, mw, queueSummary }) {
  if (!interconnection) return null
  const { servingUtility, queueStatus, queueStatusCode, easeScore, avgStudyTimeline, queueNotes } = interconnection

  const TREND_ICON = { growing: '↑', stable: '→', shrinking: '↓' }
  const TREND_COLOR = { growing: '#DC2626', stable: '#D97706', shrinking: '#0F766E' }
  const CONGESTION = {
    high:     { label: 'High Congestion',     color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    moderate: { label: 'Moderate Congestion',  color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    low:      { label: 'Low Congestion',       color: '#0F766E', bg: 'rgba(15,118,110,0.08)' },
  }
  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${n.toLocaleString()}`

  return (
    <CollapsibleCard
      accentColor="#D97706"
      eyebrow="02 / Interconnection"
      title={servingUtility || 'Utility TBD'}
      caption="QUEUE & UPGRADE COST CONDITIONS"
    >
      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Utility · Queue · Ease — single structured panel matching the
            ISO Queue Data block below for visual consistency. Replaces the
            two earlier `bg-surface` blocks (DataRow stack + centered gauge)
            with a research-grade panel: amber left-border accent, mono
            eyebrow, gauge inline-left, KV chips inline-right, interpretation
            footer in a tinted strip. */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
        >
          <div
            className="px-3.5 py-2 flex items-baseline justify-between gap-2 border-b border-amber-100"
            style={{ background: 'rgba(217,119,6,0.05)' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-amber-800">
              Utility · Queue · Study Window
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
              county
            </span>
          </div>

          <div className="px-3.5 py-3 grid grid-cols-12 gap-3 items-center bg-white">
            {/* Gauge — anchors the panel visually, pulled out of the centered
                wrapper that ate vertical space. */}
            <div className="col-span-5 flex flex-col items-center justify-center pr-2 border-r border-gray-100">
              <EaseArcGauge score={easeScore} />
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold text-gray-500 mt-0.5">
                Ease Score
              </p>
            </div>
            {/* KV chips — replaces the DataRow flat stack. Right-aligned values
                sit on the same baseline as the labels for clean vertical rhythm. */}
            <div className="col-span-7 space-y-1.5 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 shrink-0">Utility</span>
                <span className="text-[11px] font-semibold text-gray-800 truncate text-right">{servingUtility || '—'}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 shrink-0">Queue</span>
                <QueueBadge statusCode={queueStatusCode} />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 shrink-0">Study window</span>
                <span className="text-[11px] font-semibold text-gray-800 text-right">{avgStudyTimeline || '—'}</span>
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 border-t border-amber-100" style={{ background: 'rgba(217,119,6,0.04)' }}>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              {easeScore >= 7 ? 'Strong interconnection conditions for this county.'
               : easeScore >= 5 ? 'Moderate difficulty — budget for potential upgrade costs.'
               : easeScore >= 3 ? 'Challenging territory — high upgrade costs likely.'
               : easeScore !== null ? 'Extremely difficult — avoid unless project economics are strong.'
               : 'Score not available for this county.'}
            </p>
          </div>
        </div>

        {/* ISO Queue Data — real numbers from public queue reports */}
        {queueSummary && (
          <div>
            <SectionLabel>Queue Data · {queueSummary.iso}</SectionLabel>
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
            >
              {/* Congestion headline */}
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: CONGESTION[queueSummary.congestionLevel].bg }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CONGESTION[queueSummary.congestionLevel].color }}>
                    {CONGESTION[queueSummary.congestionLevel].label}
                  </span>
                  <span className="text-[10px] text-gray-400">·</span>
                  <span className="text-[10px] text-gray-500 tabular-nums">{queueSummary.totalProjects} solar projects in queue</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-700">{queueSummary.totalMW.toLocaleString()} MW</span>
              </div>

              {/* Aggregate stats */}
              <div className="px-4 py-2.5 grid grid-cols-3 gap-3 bg-white border-b border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{queueSummary.avgStudyMonths}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">mo avg study</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{queueSummary.avgWithdrawalPct}%</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">withdrawal</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#D97706' }}>{fmt(queueSummary.estimatedUpgradeCost)}</p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">est. upgrade</p>
                </div>
              </div>

              {/* Per-utility breakdown */}
              <div className="px-4 py-2.5 bg-white space-y-2">
                {queueSummary.utilities.map(u => (
                  <div key={u.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-gray-700 truncate">{u.name}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: TREND_COLOR[u.queueTrend] }}>
                        {TREND_ICON[u.queueTrend]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-gray-500 tabular-nums">
                      <span>{u.projectsInQueue} proj</span>
                      <span>{u.avgStudyMonths}mo</span>
                      <span>${(u.avgUpgradeCostMW / 1000).toFixed(0)}K/MW</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-1.5 border-t border-gray-100">
                <p className="text-[9px] text-gray-400">Aggregated from public ISO queue filings. Solar projects &lt;25MW. Updated Q1 2026.</p>
              </div>
            </div>
          </div>
        )}

        {/* Queue notes — amber-tinted strip matches the rest of the IX card's
            intelligence-style treatment. */}
        {queueNotes && (
          <div
            className="rounded-md px-3 py-2"
            style={{ background: 'rgba(217,119,6,0.05)', borderLeft: '3px solid rgba(217,119,6,0.45)' }}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold text-amber-800 mb-1">
              County queue notes
            </p>
            <p className="text-[11px] text-gray-700 leading-relaxed">{queueNotes}</p>
          </div>
        )}

        {/* State-level IX note */}
        {stateProgram?.ixNotes && (
          <div>
            <SectionLabel>State-Level IX Context</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">{stateProgram.ixNotes}</p>
          </div>
        )}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#D97706" label="Ease score methodology · ISO benchmarks">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>How the 1–10 ease score is computed</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">Queue saturation</span> · projects-in-queue / available capacity by serving utility</li>
            <li><span className="font-semibold text-ink">Study timeline</span> · weighted avg system-impact study months across territory</li>
            <li><span className="font-semibold text-ink">Withdrawal rate</span> · % of historical queue applications that withdrew pre-IA execution</li>
            <li><span className="font-semibold text-ink">Upgrade cost severity</span> · $/MW from utility-published cluster results</li>
          </ul>
          <p className="text-[10px] text-gray-500 italic mt-1.5">10 = fast-track-ready (e.g. MISO post-reform); 1 = severely constrained (e.g. PJM saturated zones).</p>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>ISO benchmarks (2024)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">PJM</p>
              <p className="text-amber-900 font-semibold">$1.5M/MW</p>
              <p className="text-amber-700/70 text-[9px]">30 mo avg study</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">MISO</p>
              <p className="text-amber-900 font-semibold">~$500K/MW</p>
              <p className="text-amber-700/70 text-[9px]">12 mo (fast-track)</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">CAISO</p>
              <p className="text-amber-900 font-semibold">$0.8M/MW</p>
              <p className="text-amber-700/70 text-[9px]">18–24 mo</p>
            </div>
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
              <p className="font-mono uppercase tracking-wider text-amber-800 text-[9px] font-bold">NYISO</p>
              <p className="text-amber-900 font-semibold">$1.0M/MW</p>
              <p className="text-amber-700/70 text-[9px]">20–28 mo</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#B45309' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://planningcenter.pjm.com/planningcenter/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">PJM Queue ↗</a>
            <a href="https://www.misoenergy.org/planning/resource-utilization/GIQ/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">MISO GIQ ↗</a>
            <a href="https://www.caiso.com/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">CAISO ↗</a>
            <a href="https://www.nyiso.com/interconnections" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors">NYISO IX ↗</a>
          </div>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Ease score is a leading indicator. Confirm interconnection economics with a system-impact study before committing capital — actual upgrade costs vary 2–3× from cluster-average benchmarks.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}
