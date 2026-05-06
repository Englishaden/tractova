import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import { generateMarketSummary } from '../lib/lensHelpers.js'
import TractovaLoader from './ui/TractovaLoader'
import {
  sanitizeBrief,
  computeScoreDelta,
  buildSensitivityScenarios,
  CHIP_COLORS,
  BriefDrilldown,
} from '../pages/Search.jsx'

// §7.4: scenario state lifted to SearchContent; we read it from props now.
export default function MarketIntelligenceSummary({ stateProgram, countyData, form, aiInsight, activeScenario, scenarioRationale, setScenarioRationale, rationaleLoading, setRationaleLoading, ixQueueSummary }) {
  const effectiveProgram = activeScenario ? { ...stateProgram, ...activeScenario.override } : stateProgram
  const effectiveSub = computeSubScores(effectiveProgram, countyData, form.stage, form.technology, ixQueueSummary)
  effectiveProgram.feasibilityScore = safeScore(effectiveSub.offtake, effectiveSub.ix, effectiveSub.site)
  const data = generateMarketSummary({ stateProgram: effectiveProgram, countyData, form })

  // Brief feedback loop: when a scenario toggles, pulse a "Brief Updated"
  // indicator AND smooth-scroll the brief into view -- but only if it
  // isn't already visible. Visibility check is read FIRST and the scroll
  // call only fires when needed; this fixes a mobile flash where the page
  // would snap up only to settle in place when the brief was already on
  // screen. Previously a sole opacity dim was the only signal -- too
  // subtle for first-time users to notice.
  const articleRef = useRef(null)
  const [pulseKey, setPulseKey] = useState(0)
  useEffect(() => {
    if (!activeScenario) return
    setPulseKey(k => k + 1)
    if (!articleRef.current) return
    const rect = articleRef.current.getBoundingClientRect()
    // Treat "visible" generously -- brief is in-frame if its top is at
    // least partially within the upper 80% of the viewport.
    const isVisible = rect.top >= 0 && rect.top < window.innerHeight * 0.80
    if (isVisible) return
    articleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeScenario?.id])

  // Fetch AI rationale when a scenario activates. Cleared on deactivation.
  useEffect(() => {
    if (!activeScenario || !stateProgram) {
      setScenarioRationale(null)
      return
    }
    let cancelled = false
    setRationaleLoading(true)
    setScenarioRationale(null)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setRationaleLoading(false); return }
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'sensitivity',
            state: form.state,
            county: form.county,
            mw: form.mw,
            stage: form.stage,
            technology: form.technology,
            scenario: activeScenario.label,
            override: activeScenario.override,
            baseScore: stateProgram.feasibilityScore,
            newScore: effectiveProgram.feasibilityScore,
            stateProgram,
            countyData,
          }),
        })
        if (cancelled) return
        if (!res.ok) { setRationaleLoading(false); return }
        const json = await res.json()
        if (!cancelled) {
          setScenarioRationale(json.rationale || null)
          setRationaleLoading(false)
        }
      } catch {
        if (!cancelled) setRationaleLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeScenario?.id])

  if (!data) return null

  const { verdict, verdictBg, verdictText, summary, signals } = data
  const scenarios = buildSensitivityScenarios(stateProgram, form.technology, form.mw)

  const cleanBrief = sanitizeBrief(aiInsight?.brief)
  // AI brief always shown when available — serves as base case anchor even in scenario mode
  const showAI = !!aiInsight && !!cleanBrief

  return (
    <article
      ref={articleRef}
      className="mb-6 bg-white rounded-lg overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      {/* V3 redesign: editorial-research-note pattern.
          Top teal hairline rail, then mono eyebrow strip, then pull-quote AI brief
          with drop-cap. Replaces the prior navy header band entirely. */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }} />

      {/* Eyebrow metadata strip */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F1A2E' }}>
            Analyst Brief
          </span>
          {showAI && (
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
                  style={{ background: 'rgba(20,184,166,0.10)', color: '#115E59', border: '1px solid rgba(20,184,166,0.30)' }}>
              ◆ Claude · Sonnet 4.6
            </span>
          )}
          {activeScenario && (
            <motion.span
              key={pulseKey}
              initial={{ scale: 1, boxShadow: '0 0 0 0 rgba(245,158,11,0.55)' }}
              animate={{ scale: [1, 1.06, 1], boxShadow: ['0 0 0 0 rgba(245,158,11,0.55)', '0 0 0 6px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0)'] }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#92400E', border: '1px solid rgba(245,158,11,0.30)' }}
            >
              Scenario Mode · Brief Updated
            </motion.span>
          )}
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
          style={{ background: verdictBg, color: verdictText }}
        >
          {verdict}
        </span>
      </div>

      {/* Body — editorial composition */}
      <div className="px-6 py-6">

        {/* AI brief as a pull-quote with serif drop-cap.
            This is the differentiated value the user is paying for —
            present it with conviction, not in a chrome-heavy chatbot tile. */}
        {showAI ? (
          <div className={`relative ${activeScenario ? 'opacity-60' : ''}`}>
            {activeScenario && (
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-2" style={{ color: '#0F766E' }}>
                — Base Analysis —
              </p>
            )}
            <p
              className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85] first-letter:font-serif"
              style={{ letterSpacing: '-0.005em' }}
            >
              {cleanBrief}
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.55] text-ink first-letter:text-[58px] first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:leading-[0.85]">
            {summary}
          </p>
        )}

        {/* Scenario overlay — shown when a scenario is active */}
        {activeScenario && (() => {
          const delta = computeScoreDelta(stateProgram, activeScenario.override)
          const positive = delta > 0
          return (
            <div
              className="mt-4 rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
            >
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(217,119,6,0.08)' }}>
                <div className="flex items-center gap-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: '#92400E' }}>
                    Scenario · {activeScenario.label.replace('What if ', '').replace('?', '')}
                  </span>
                </div>
                <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded ${
                  positive ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Score impact: {positive ? '+' : ''}{delta} pts
                </span>
              </div>
              <div className="px-4 py-3 bg-white">
                {/* Precedent anchor — what real-world event/market this scenario mirrors.
                    Makes scenarios concrete instead of abstract "what ifs". */}
                {activeScenario.precedent && (
                  <div className="mb-2.5 flex items-baseline gap-2 flex-wrap">
                    <span className="text-[8px] font-bold uppercase tracking-[0.20em] px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.25)' }}>
                      Precedent
                    </span>
                    <span className="text-[11px] font-mono leading-snug" style={{ color: '#7C3500' }}>
                      {activeScenario.precedent}
                    </span>
                  </div>
                )}
                <p className="text-[13px] font-medium text-gray-800 leading-relaxed">
                  {activeScenario.detail ?? summary}
                </p>
                {(activeScenario.revenueImpact || activeScenario.timelineImpact) && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {activeScenario.revenueImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200">
                        {activeScenario.revenueImpact}
                      </span>
                    )}
                    {activeScenario.timelineImpact && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border bg-amber-50 text-amber-700 border-amber-200">
                        {activeScenario.timelineImpact}
                      </span>
                    )}
                  </div>
                )}
                {/* V3: AI rationale block -- teal accent (was violet) */}
                {(rationaleLoading || scenarioRationale) && (
                  <div
                    className="mt-3 pt-3 rounded-sm px-3 py-2"
                    style={{
                      borderTop: '1px dashed rgba(20,184,166,0.30)',
                      background: 'rgba(20,184,166,0.04)',
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(15,118,110,0.85)' }}>
                      AI Rationale
                    </p>
                    {rationaleLoading ? (
                      <div className="flex items-center gap-2.5 py-0.5">
                        <TractovaLoader size={28} />
                        <p className="text-[11px] text-gray-500 leading-tight">Analyzing scenario impact…</p>
                      </div>
                    ) : (
                      <p className="text-[12px] text-gray-700 leading-relaxed">{scenarioRationale}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* AI Spotlight grid (Risk + Opportunity) was relocated into the
            Drill-Down accordion below this block — Site-walk Session 5,
            review item #12, option A. */}

        {/* V3: Ticker-tape signal strip -- mono caps, hairline-divided, no boxed cards */}
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

        {/* V3: Immediate Action — editorial side-rule block (was filled tile) */}
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

        {/* Drill-Down accordion (Site-walk Session 5, review item #12, option A).
            Brief + Immediate Action stay always-visible above; the deeper
            analysis sections collapse behind chevrons so users skim before
            drilling in. Risk + Opportunity hide while a scenario is active —
            those are base-case signals and become misleading under a scenario
            override; Stage Guidance + Competitive Context remain visible. */}
        {showAI && (
          (!activeScenario && (aiInsight.primaryRisk || aiInsight.topOpportunity)) ||
          aiInsight.stageSpecificGuidance ||
          aiInsight.competitiveContext
        ) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-gray-400 mb-1">
              Drill-Down
            </p>
            {!activeScenario && aiInsight.primaryRisk && (
              <BriefDrilldown label="Primary Risk" accent="#DC2626" eyebrowColor="#DC2626">
                <p className="text-[13px] text-ink leading-[1.55]">{aiInsight.primaryRisk}</p>
              </BriefDrilldown>
            )}
            {!activeScenario && aiInsight.topOpportunity && (
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

        {/* §7.4: Sensitivity panel + CustomScenarioBuilder MOVED to LensScenarioRow
            (rendered next to the gauge in MarketPositionPanel) so toggling
            updates the score in place — no scroll-up required. The rationale
            (when a scenario is active) still surfaces via the scenario overlay
            block above. */}
      </div>
    </article>
  )
}
