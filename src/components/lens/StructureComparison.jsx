// "Which structure pays best here" — cross-structure economics comparison for a
// fixed site + MW. Sits in the Lens results next to Scenario Studio.
//
// v1 scope: compares the four monetization structures at STANDALONE PV. CS / Net
// Metering / C&I have real revenue models; Net Billing is honestly gated (no
// per-state export-credit data). PV+Storage per-structure economics are a
// follow-up — when the user's project is PV+Storage we compute at Standalone PV
// and say so.
//
// Numbers come from the SAME engines the rest of the Lens uses — computeBaseline
// (powers Scenario Studio) for Year-1 revenue + payback, computeSubScores for
// offtake — so this never shows a parallel/divergent figure. IX & Site sub-scores
// are identical across structures for one site (they're driven by architecture +
// county, not by how you monetize), so the differentiator is offtake + revenue.

import { useMemo } from 'react'
import { computeSubScores } from '../../lib/scoreEngine'
import { computeBaseline } from '../../lib/scenarioEngine'
import { STRUCTURE_OPTIONS, normalizeStructure } from '../../lib/lensFormConstants'
import { rankStructureRows } from '../../lib/structureCompare'
import GlossaryLabel from '../ui/GlossaryLabel'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip'

const COMPARE_ARCH = 'Standalone PV'

// Why a structure has no modeled revenue — surfaced verbatim so the gate reads
// as a deliberate honesty stance, not a missing number.
const GATE_REASON = {
  'Net Billing': 'no per-state export-credit data',
}

const offtakeTone = (v) => v == null ? '#475569' : v >= 70 ? '#0F766E' : v >= 50 ? '#92400E' : '#991B1B'

const fmtUSD = (n) => {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000)    return `$${Math.round(n / 1000)}k`
  if (n >= 1000)      return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

export default function StructureComparison({
  stateProgram, countyData, stage, mw, rates,
  selectedStructure, ixQueueSummary, policyEvents,
  userArchitecture, stateName,
}) {
  const size = parseFloat(mw)
  const result = useMemo(() => {
    if (!stateProgram || !Number.isFinite(size) || size <= 0) return null
    const rows = STRUCTURE_OPTIONS.map((structure) => {
      const axes = { architecture: COMPARE_ARCH, structure }
      const sub = computeSubScores(stateProgram, countyData, stage || '', axes, ixQueueSummary, policyEvents, size)
      // Pre-policy structural revenue — clean apples-to-apples across structures
      // (policy applicability is tech-specific and would distort the ranking).
      const baseline = computeBaseline({ stateId: stateProgram.id, technology: axes, mw: size, rates })
      return {
        structure,
        offtake: sub.offtake != null ? Math.round(sub.offtake) : null,
        year1:   baseline?.outputs?.year1Revenue ?? null,
        payback: baseline?.outputs?.paybackYears ?? null,
        modeled: !!baseline && Number.isFinite(baseline?.outputs?.year1Revenue),
      }
    })
    return rankStructureRows(rows)
  }, [stateProgram, countyData, stage, size, rates, ixQueueSummary, policyEvents])

  if (!result) return null
  const { ranked, bestKey, bestBy } = result
  const selected = normalizeStructure(selectedStructure)
  const isStorage = userArchitecture === 'PV + Storage'

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(15,26,46,0.10)', borderLeft: '3px solid #0F766E' }}>
        {/* Header strip — research-panel chrome */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b" style={{ background: 'rgba(20,184,166,0.05)', borderColor: 'rgba(15,26,46,0.06)' }}>
          <span className="eyebrow-mono font-bold text-teal-800">Which structure pays best here</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] tabular-nums text-gray-500">
            {stateProgram.id} · {size % 1 === 0 ? size : size.toFixed(1)} MW · Standalone PV
          </span>
        </div>

        {/* Column header row */}
        <div className="px-4 py-1.5 grid grid-cols-[1.6fr_0.7fr_1fr_0.8fr] gap-2 bg-white border-b border-gray-100">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">Structure</span>
          <GlossaryLabel term="Offtake" displayAs="Offtake" className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 text-right justify-self-end" />
          <GlossaryLabel term="Year 1 Revenue" displayAs="Yr-1 Revenue" className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 text-right justify-self-end" />
          <GlossaryLabel term="Simple Payback" displayAs="Payback" className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 text-right justify-self-end" />
        </div>

        {/* Rows */}
        <div className="bg-white">
          {ranked.map((r) => {
            const isBest = r.structure === bestKey
            const isSelected = r.structure === selected
            const gated = !r.modeled
            return (
              <div
                key={r.structure}
                className="px-4 py-2.5 grid grid-cols-[1.6fr_0.7fr_1fr_0.8fr] gap-2 items-center border-b border-gray-50 last:border-b-0"
                style={isBest ? { background: 'rgba(20,184,166,0.06)' } : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gated ? '' : ''}`} style={{ background: gated ? '#CBD5E1' : offtakeTone(r.offtake) }} />
                  <span className={`text-[12px] font-semibold truncate ${gated ? 'text-gray-400' : 'text-ink'}`}>{r.structure}</span>
                  {isBest && (
                    <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm shrink-0" style={{ background: 'rgba(20,184,166,0.14)', color: '#0F766E' }}>
                      best{bestBy === 'offtake' ? ' offtake' : ''}
                    </span>
                  )}
                  {isSelected && (
                    <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm shrink-0" style={{ background: 'rgba(15,26,46,0.06)', color: '#475569', border: '1px solid rgba(15,26,46,0.14)' }}>
                      your pick
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-bold tabular-nums text-right justify-self-end" style={{ color: offtakeTone(r.offtake) }}>
                  {r.offtake ?? '—'}
                </span>
                {gated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-gray-400 italic text-right justify-self-end cursor-help underline decoration-dotted underline-offset-2">not modeled</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="!max-w-[260px]">
                      <p className="leading-relaxed">
                        {GATE_REASON[r.structure]
                          ? `No revenue model — ${GATE_REASON[r.structure]}. Showing offtake only rather than fabricate a number.`
                          : `No revenue-rate data for ${stateName || stateProgram.id} — offtake shown, revenue not modeled.`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-[13px] font-bold tabular-nums text-right justify-self-end" style={{ color: '#0F766E' }}>
                    {fmtUSD(r.year1)}
                  </span>
                )}
                <span className="text-[12px] tabular-nums text-right justify-self-end text-gray-600">
                  {r.payback != null ? `${r.payback} yr` : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footnote — methodology + honesty disclosures */}
        <div className="px-4 py-2 border-t border-gray-100" style={{ background: 'rgba(15,26,46,0.02)' }}>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Ranked by structural Year-1 revenue (pre-policy), from the same engine as Scenario Studio. <span className="text-gray-600 font-medium">Interconnection &amp; Site sub-scores are identical across structures for this site</span> — they're driven by architecture + county, not by how you monetize, so offtake + revenue are the differentiators.
            {isStorage && <> Your project is PV&nbsp;+&nbsp;Storage; comparison shown at Standalone PV (per-structure storage economics are a follow-up).</>}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
