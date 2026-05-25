// Incentives summary card — §04 Pillar Diagnostics (Pillar 3). Compact glance
// variant; clicking opens the PillarDetailModal's Incentives tab (IncentivesDetail)
// with the full ITC adder-eligibility breakdown. All data is REAL county-level
// federal eligibility (EPA Energy Communities / Census-CDFI §48(e) / HUD). No $.

import { SummaryShell } from './OfftakeCardSummary'

const PILLAR_ACCENT = '#15803D'

export default function IncentivesCardSummary({ score, coverage, adders, onOpen }) {
  const noData = coverage === 'none' || score == null
  const ec = !!adders?.energyCommunity
  const lic = !!adders?.lowIncomeCommunity
  const ceiling = 30 + (ec ? 10 : 0) + (lic ? 10 : 0)

  const statusChip = noData ? null : (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-sm"
      style={ceiling >= 40
        ? { background: 'rgba(21,128,61,0.12)', color: '#166534', border: '1px solid rgba(21,128,61,0.35)' }
        : { background: 'rgba(15,26,46,0.06)', color: '#475569', border: '1px solid rgba(15,26,46,0.18)' }}
    >
      Up to {ceiling}% ITC
    </span>
  )

  return (
    <SummaryShell
      pillarLabel="03 / Incentives"
      pillarAccent={PILLAR_ACCENT}
      title="ITC Adder Stack"
      score={noData ? null : score}
      coverage={coverage}
      statusChip={statusChip}
      onOpen={onOpen}
    />
  )
}
