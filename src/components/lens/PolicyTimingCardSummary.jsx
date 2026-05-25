// Policy & Timing summary card — §04 Pillar Diagnostics (Pillar 5). Compact
// glance variant; clicking opens the PillarDetailModal's Policy & Timing tab
// (PolicyTimingDetail) with the federal calendar + applicable state events.
// Risk tiers, no dollars.

import { SummaryShell } from './OfftakeCardSummary'

const PILLAR_ACCENT = '#475569'

const TIER = {
  clear:   { label: 'On track', bg: 'rgba(20,184,166,0.12)', fg: '#0F766E', border: 'rgba(20,184,166,0.35)' },
  watch:   { label: 'Watch',    bg: 'rgba(217,119,6,0.12)',  fg: '#92400E', border: 'rgba(217,119,6,0.35)' },
  at_risk: { label: 'At risk',  bg: 'rgba(220,38,38,0.10)',  fg: '#991B1B', border: 'rgba(220,38,38,0.35)' },
}

export default function PolicyTimingCardSummary({ score, coverage, policyDetail, onOpen }) {
  const noData = coverage === 'none' || score == null
  const federal = policyDetail?.federal
  const tier = federal?.tier && TIER[federal.tier] ? federal.tier : null
  const t = tier ? TIER[tier] : null

  const statusChip = (noData || !t) ? null : (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-sm"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}` }}
    >
      Federal · {t.label}
    </span>
  )

  return (
    <SummaryShell
      pillarLabel="05 / Policy"
      pillarAccent={PILLAR_ACCENT}
      title={federal?.headline || 'Federal + State Risk'}
      score={noData ? null : score}
      coverage={coverage}
      statusChip={statusChip}
      onOpen={onOpen}
    />
  )
}
