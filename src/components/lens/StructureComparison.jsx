// "Which structure monetizes best here" — cross-structure offtake comparison
// for a fixed site + MW. Sits in the Lens results after Dev Feasibility.
//
// Post the 2026-05 signal pivot this ranks the four monetization structures by
// their OFFTAKE signal (0-100) — no synthesized dollars. Numbers come from the
// SAME engine the rest of the Lens uses (computeSubScores), so this never shows
// a parallel/divergent figure. IX & Site sub-scores are identical across
// structures for one site (they're driven by architecture + county, not by how
// you monetize), so offtake is the differentiator. Net Billing is honestly
// gated (no per-state export-credit data) and sinks to the bottom.

import { useMemo } from 'react'
import { computeSubScores } from '../../lib/scoreEngine'
import { STRUCTURE_OPTIONS, normalizeStructure } from '../../lib/lensFormConstants'
import { rankStructureRows } from '../../lib/structureCompare'
import GlossaryLabel from '../ui/GlossaryLabel'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip'

const COMPARE_ARCH = 'Standalone PV'

// Why a structure has no modeled offtake — surfaced verbatim so the gate reads
// as a deliberate honesty stance, not a missing number.
const GATE_REASON = {
  'Net Billing': 'no per-state export-credit data',
}

const offtakeTone = (v) => v == null ? '#475569' : v >= 70 ? '#0F766E' : v >= 50 ? '#92400E' : '#991B1B'

export default function StructureComparison({
  stateProgram, countyData, stage, mw,
  selectedStructure, ixQueueSummary, policyEvents,
  userArchitecture, stateName,
}) {
  const size = parseFloat(mw)
  const result = useMemo(() => {
    if (!stateProgram || !Number.isFinite(size) || size <= 0) return null
    const rows = STRUCTURE_OPTIONS.map((structure) => {
      const axes = { architecture: COMPARE_ARCH, structure }
      const sub = computeSubScores(stateProgram, countyData, stage || '', axes, ixQueueSummary, policyEvents, size)
      return {
        structure,
        offtake: sub.offtake != null ? Math.round(sub.offtake) : null,
        // 'fallback' coverage = no curated monetization model for this state
        // (or a deliberately-gated structure like Net Billing).
        available: sub.coverage?.offtake !== 'fallback',
      }
    })
    return rankStructureRows(rows)
  }, [stateProgram, countyData, stage, size, ixQueueSummary, policyEvents])

  if (!result) return null
  const { ranked, bestKey } = result
  const selected = normalizeStructure(selectedStructure)
  const isStorage = userArchitecture === 'PV + Storage'

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(15,26,46,0.10)', borderLeft: '3px solid #0F766E' }}>
        {/* Header strip — research-panel chrome */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b" style={{ background: 'rgba(20,184,166,0.05)', borderColor: 'rgba(15,26,46,0.06)' }}>
          <span className="eyebrow-mono font-bold text-teal-800">Which structure monetizes best here</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] tabular-nums text-gray-500">
            {stateProgram.id} · {size % 1 === 0 ? size : size.toFixed(1)} MW · Standalone PV
          </span>
        </div>

        {/* Column header row */}
        <div className="px-4 py-1.5 grid grid-cols-[1.8fr_0.8fr_1fr] gap-2 bg-white border-b border-gray-100">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">Structure</span>
          <GlossaryLabel term="Offtake" displayAs="Offtake" className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 text-right justify-self-end" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400 text-right justify-self-end">Coverage</span>
        </div>

        {/* Rows */}
        <div className="bg-white">
          {ranked.map((r) => {
            const isBest = r.structure === bestKey
            const isSelected = r.structure === selected
            const gated = !r.available || r.offtake == null
            const tone = offtakeTone(r.offtake)
            return (
              <div
                key={r.structure}
                className="px-4 py-2.5 grid grid-cols-[1.8fr_0.8fr_1fr] gap-2 items-center border-b border-gray-50 last:border-b-0"
                style={isBest ? { background: 'rgba(20,184,166,0.06)' } : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: gated ? '#CBD5E1' : tone }} />
                  <span className={`text-[12px] font-semibold truncate ${gated ? 'text-gray-400' : 'text-ink'}`}>{r.structure}</span>
                  {isBest && (
                    <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm shrink-0" style={{ background: 'rgba(20,184,166,0.14)', color: '#0F766E' }}>
                      best offtake
                    </span>
                  )}
                  {isSelected && (
                    <span className="eyebrow-mono px-1.5 py-0.5 rounded-sm shrink-0" style={{ background: 'rgba(15,26,46,0.06)', color: '#475569', border: '1px solid rgba(15,26,46,0.14)' }}>
                      your pick
                    </span>
                  )}
                </div>
                {/* Score chip — the focal data point. Tinted to the score tone
                    with a base fill-bar (0-100 fraction) reading the signal at
                    a glance; the winning row's chip carries an emphasis ring. */}
                <div className="justify-self-end">
                  {gated ? (
                    <span
                      className="inline-block min-w-[2.75rem] text-center rounded-md px-2.5 pt-1.5 pb-2 font-mono text-[14px] font-bold tabular-nums text-gray-400 leading-none"
                      style={{ border: '1px dashed rgba(148,163,184,0.55)' }}
                    >
                      —
                    </span>
                  ) : (
                    <span
                      className="relative inline-block min-w-[2.75rem] text-center rounded-md px-2.5 pt-1.5 pb-2 overflow-hidden font-mono text-[14px] font-bold tabular-nums leading-none"
                      style={{
                        color: tone,
                        background: `${tone}14`,
                        border: `1px solid ${tone}3D`,
                        ...(isBest ? { boxShadow: `0 0 0 1.5px ${tone}40, 0 1px 3px ${tone}26` } : {}),
                      }}
                    >
                      {r.offtake}
                      <span
                        className="absolute left-0 bottom-0 h-[2px]"
                        style={{ width: `${r.offtake}%`, background: tone, opacity: 0.85 }}
                      />
                    </span>
                  )}
                </div>
                {gated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-gray-400 italic text-right justify-self-end cursor-help underline decoration-dotted underline-offset-2">not modeled</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="!max-w-[260px]">
                      <p className="leading-relaxed">
                        {GATE_REASON[r.structure]
                          ? `No curated offtake model — ${GATE_REASON[r.structure]}. Shown as not-modeled rather than fabricate a signal.`
                          : `No curated offtake coverage for ${stateName || stateProgram.id} yet — directional baseline only.`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-[11px] tabular-nums text-right justify-self-end text-teal-700 font-medium">
                    curated
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Footnote — methodology + honesty disclosures */}
        <div className="px-4 py-2 border-t border-gray-100" style={{ background: 'rgba(15,26,46,0.02)' }}>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Ranked by the <span className="text-gray-600 font-medium">offtake signal</span> (0-100), from the same engine as the Feasibility Index. Interconnection &amp; Site sub-scores are identical across structures for this site — they're driven by architecture + county, not by how you monetize — so offtake is the differentiator.
            {isStorage && <> Your project is PV&nbsp;+&nbsp;Storage; comparison shown at Standalone PV (offtake is architecture-agnostic for this read).</>}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
