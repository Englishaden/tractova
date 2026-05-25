import { generateMarketSummary } from '../lib/lensHelpers.js'
import BriefDrilldown from './BriefDrilldown'
import { sanitizeBrief, CHIP_COLORS } from '../lib/searchShared.jsx'

// §02 Analyst Brief — the editorial AI read on the project. Signal-only: the
// What-If sensitivity scenarios (and their $ precedents) were removed in the
// 2026-05 wave-3 cleanup; sensitivity now lives entirely in §03 Dev Feasibility
// (signal levers, no dollars), so this brief carries no synthesized numbers.
//
// `score` is the canonical 5-pillar composite computed once in Search.jsx (the
// same number the §01 gauge shows). The brief used to recompute a partial
// 3-pillar score, so its verdict could disagree with the gauge — now they're
// keyed to one source.
export default function MarketIntelligenceSummary({ stateProgram, countyData, form, aiInsight, score }) {
  const data = generateMarketSummary({
    stateProgram: { ...stateProgram, feasibilityScore: score },
    countyData,
    form,
  })

  if (!data) return null

  const { verdict, verdictBg, verdictText, summary, signals } = data

  const cleanBrief = sanitizeBrief(aiInsight?.brief)
  const showAI = !!aiInsight && !!cleanBrief

  return (
    <article
      className="mb-6 bg-white rounded-lg overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* Top teal hairline rail */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }} />

      {/* Eyebrow metadata strip */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Analyst Brief
          </span>
          {showAI && (
            <span className="eyebrow-mono px-2 py-0.5"
                  style={{ background: 'rgba(20,184,166,0.10)', color: '#115E59', border: '1px solid rgba(20,184,166,0.30)' }}>
              ◆ Claude · Sonnet 4.6
            </span>
          )}
        </div>
        <span
          className="eyebrow-mono px-2 py-0.5"
          style={{ background: verdictBg, color: verdictText }}
        >
          {verdict}
        </span>
      </div>

      {/* Body — editorial composition */}
      <div className="px-6 py-6">

        {/* AI brief as a pull-quote with serif drop-cap. This is the
            differentiated value the user is paying for — present it with
            conviction, not in a chrome-heavy chatbot tile. */}
        {showAI ? (
          <p
            className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85] first-letter:font-serif"
            style={{ letterSpacing: '-0.005em' }}
          >
            {cleanBrief}
          </p>
        ) : (
          <p className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85]">
            {summary}
          </p>
        )}

        {/* Ticker-tape signal strip — mono caps, hairline-divided */}
        {signals.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400 mb-2">
              Decision Signals
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
              {signals.map((sig, i) => {
                const c = CHIP_COLORS[sig.color] || CHIP_COLORS.gray
                return (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="w-1 h-3" style={{ background: c.dot }} />
                    <span className="text-ink">{sig.label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Immediate Action — editorial side-rule block */}
        {showAI && aiInsight.immediateAction && (
          <div className="mt-6 pt-5 border-t border-gray-100 pl-4" style={{ borderLeftWidth: 0, position: 'relative' }}>
            <div className="absolute left-0 top-5 bottom-0 w-[2px]" style={{ background: '#14B8A6' }} />
            <div className="flex items-start gap-3 ml-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-1">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1" style={{ color: '#0F766E' }}>
                  Immediate Action — Next 30 Days
                </p>
                <p className="text-[14px] text-ink leading-[1.55] font-medium">{aiInsight.immediateAction}</p>
              </div>
            </div>
          </div>
        )}

        {/* Drill-Down accordion — deeper analysis collapses behind chevrons so
            users skim the brief + immediate action first, then drill in. */}
        {showAI && (
          aiInsight.primaryRisk ||
          aiInsight.topOpportunity ||
          aiInsight.stageSpecificGuidance ||
          aiInsight.competitiveContext
        ) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400 mb-1">
              Drill-Down
            </p>
            {aiInsight.primaryRisk && (
              <BriefDrilldown label="Primary Risk" accent="#DC2626" eyebrowColor="#DC2626">
                <p className="text-[13px] text-ink leading-[1.55]">{aiInsight.primaryRisk}</p>
              </BriefDrilldown>
            )}
            {aiInsight.topOpportunity && (
              <BriefDrilldown label="Top Opportunity" accent="#0F766E" eyebrowColor="#0F766E">
                <p className="text-[13px] text-ink leading-[1.55]">{aiInsight.topOpportunity}</p>
              </BriefDrilldown>
            )}
            {aiInsight.stageSpecificGuidance && (
              <BriefDrilldown label={`Stage Guidance — ${form.stage || 'General'}`} accent="#0F766E" eyebrowColor="#0F766E">
                <p className="text-[14px] text-ink leading-[1.55]">{aiInsight.stageSpecificGuidance}</p>
              </BriefDrilldown>
            )}
            {aiInsight.competitiveContext && (
              <BriefDrilldown label="Competitive Context" accent="#2563EB" eyebrowColor="#1D4ED8">
                <p className="text-[14px] text-ink leading-[1.55]">{aiInsight.competitiveContext}</p>
              </BriefDrilldown>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
