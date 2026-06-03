// Offtake summary card — compact glance variant for the §04 Pillar
// Diagnostics row. Replaces the full OfftakeCard in-grid; clicking it
// opens the PillarDetailModal which renders the full OfftakeCard body.
//
// Visible at-a-glance: pillar eyebrow + program title + MiniArcGauge
// score + status/coverage chips. Whole card is a click target; the
// "Open detail →" footer is where the full prose breakdown lives — so the
// glance card stays chip-only (no descriptive caption that wraps + grows
// the card unevenly).

import MiniArcGauge from '../library/MiniArcGauge'
import { CSStatusBadge } from '../../lib/searchShared.jsx'
import CoverageChip from './CoverageChip'

const PILLAR_ACCENT = '#0F766E'

export default function OfftakeCardSummary({ stateProgram, score, coverage, technology, onOpen }) {
  const isCS = technology === 'Community Solar' || technology === 'Hybrid'
  const programLabel = isCS ? (stateProgram?.csProgram || 'No CS program') : (technology || 'Offtake')

  return (
    <SummaryShell
      pillarLabel="01 / Offtake"
      pillarAccent={PILLAR_ACCENT}
      title={programLabel}
      score={score}
      coverage={coverage}
      statusChip={isCS && stateProgram?.csStatus ? <CSStatusBadge csStatus={stateProgram.csStatus} /> : null}
      onOpen={onOpen}
    />
  )
}

// Shared shell used by all five pillar summary cards. Single source of
// truth for the compact-card chrome (eyebrow + gauge + title + status/
// coverage chips + footer link + click target). flex-col + mt-auto footer
// + h-full keeps every card in a row the same height with footers aligned
// (the grid row is items-stretch), regardless of title length.
export function SummaryShell({ pillarLabel, pillarAccent, title, score, coverage, statusChip, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col text-left w-full h-full bg-white rounded-lg border border-gray-200 px-4 py-3.5 transition-all duration-200 motion-reduce:transition-none hover:border-teal-300 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-[0_12px_30px_-12px_rgba(20,184,166,0.32)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/30"
      style={{ minHeight: 150 }}
      aria-label={`Open ${pillarLabel} detail`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] font-bold mb-1.5 truncate" style={{ color: pillarAccent }}>
            {pillarLabel}
          </p>
          <h3 className="font-serif text-[17px] font-semibold text-ink leading-tight truncate" style={{ letterSpacing: '-0.015em' }}>
            {title || '—'}
          </h3>
        </div>
        <MiniArcGauge score={score} color={pillarAccent} />
      </div>

      <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
        {statusChip}
        <CoverageChip coverage={coverage} variant="inline" />
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold transition-colors" style={{ color: pillarAccent }}>
          Open detail
        </span>
        <span className="text-[14px] transition-transform group-hover:translate-x-0.5" style={{ color: pillarAccent }}>→</span>
      </div>
    </button>
  )
}

