// Offtake summary card — compact glance variant for the §04 Pillar
// Diagnostics row. Replaces the full OfftakeCard in-grid; clicking it
// opens the PillarDetailModal which renders the full OfftakeCard body.
//
// Visible at-a-glance: pillar eyebrow + program title + MiniArcGauge
// score + status badge + one-line caption. Whole card is a click target;
// "Open detail →" footer link is a redundant affordance for clarity.

import MiniArcGauge from '../library/MiniArcGauge'
import { CSStatusBadge } from '../../lib/searchShared.jsx'
import CoverageChip from './CoverageChip'

const PILLAR_ACCENT = '#0F766E'

export default function OfftakeCardSummary({ stateProgram, score, coverage, technology, mw, onOpen }) {
  const isCS = technology === 'Community Solar' || technology === 'Hybrid'
  const programLabel = isCS ? (stateProgram?.csProgram || 'No CS program') : (technology || 'Offtake')

  // One-line caption rotates by tech path to show the most decision-shaping
  // data point: CS remaining-capacity, BESS clearing-tier label, C&I retail
  // displacement framing. Falls back gracefully when data isn't loaded.
  let caption = null
  if (isCS && stateProgram) {
    if (stateProgram.capacityMW > 0) {
      const shareLine = mw && stateProgram.capacityMW > 0
        ? ` · project ${((parseFloat(mw) / stateProgram.capacityMW) * 100).toFixed(1)}% of cap`
        : ''
      caption = `${stateProgram.capacityMW.toLocaleString()} MW remaining${shareLine}`
    } else if (stateProgram.lmiRequired) {
      caption = `LMI required${stateProgram.lmiPercent ? ` · ${stateProgram.lmiPercent}%` : ''}`
    } else {
      caption = `Status: ${stateProgram.csStatus || 'unknown'}`
    }
  } else if (technology === 'BESS') {
    caption = 'ISO capacity-market clearing'
  } else if (technology === 'C&I Solar') {
    caption = 'Retail-rate displacement'
  } else if (technology === 'Hybrid') {
    caption = 'CS + capacity-market blend'
  }

  return (
    <SummaryShell
      pillarLabel="01 / Offtake"
      pillarAccent={PILLAR_ACCENT}
      title={programLabel}
      score={score}
      coverage={coverage}
      caption={caption}
      statusChip={isCS && stateProgram?.csStatus ? <CSStatusBadge csStatus={stateProgram.csStatus} /> : null}
      onOpen={onOpen}
    />
  )
}

// Shared shell used by all three pillar summary cards. Single source of
// truth for the compact-card chrome (eyebrow + gauge + title + status +
// caption + footer link + click target).
export function SummaryShell({ pillarLabel, pillarAccent, title, score, coverage, caption, statusChip, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left w-full bg-white rounded-lg border border-gray-200 px-4 py-3.5 transition-all hover:border-gray-300 hover:-translate-y-px focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/30"
      style={{ minHeight: 200 }}
      aria-label={`Open ${pillarLabel} detail`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-1.5" style={{ color: pillarAccent }}>
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

      {caption && (
        <p className="text-[11px] text-gray-600 leading-snug mt-2 line-clamp-2">
          {caption}
        </p>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold transition-colors" style={{ color: pillarAccent }}>
          Open detail
        </span>
        <span className="text-[14px] transition-transform group-hover:translate-x-0.5" style={{ color: pillarAccent }}>→</span>
      </div>
    </button>
  )
}

