// Interconnection summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'
import { QueueBadge } from '../../lib/searchShared.jsx'

const PILLAR_ACCENT = '#D97706'

export default function InterconnectionCardSummary({ interconnection, queueSummary, hostingCapacity, score, coverage, onOpen }) {
  const servingUtility = interconnection?.servingUtility || 'Utility TBD'
  const queueStatusCode = interconnection?.queueStatusCode || null

  // Caption prefers live data when wired; falls back to curated string.
  let caption = null
  if (queueSummary && queueSummary.signalType === 'cs_pipeline') {
    // Distribution CS pipeline — show pipeline (+ energized when the source
    // reports it), not a study window (these sources don't observe one).
    const region = queueSummary.sourceRegion || 'distribution'
    caption = queueSummary.completedProjects != null
      ? `${queueSummary.totalProjects.toLocaleString()} CS in pipeline · ${queueSummary.completedProjects.toLocaleString()} energized · ${region}`
      : `${queueSummary.totalProjects.toLocaleString()} CS in active pipeline · ${region}`
  } else if (queueSummary && queueSummary.totalProjects > 0) {
    const months = queueSummary.avgStudyMonths
    const mwPending = queueSummary.totalMW
    caption = `${months}-mo avg study · ${mwPending.toLocaleString()} MW pending in ${queueSummary.iso || 'queue'}`
  } else if (hostingCapacity && hostingCapacity.pctWithCapacity != null) {
    // Grid headroom (hosting capacity) — a different live signal than a queue.
    caption = `${hostingCapacity.pctWithCapacity}% of grid open ≥${hostingCapacity.thresholdMw}MW · hosting capacity`
  } else if (interconnection?.avgStudyTimeline) {
    caption = `Curated: ${interconnection.avgStudyTimeline}`
  } else {
    caption = 'Queue data not wired for this state'
  }

  return (
    <SummaryShell
      pillarLabel="02 / Interconnection"
      pillarAccent={PILLAR_ACCENT}
      title={servingUtility}
      score={score}
      coverage={coverage}
      caption={caption}
      statusChip={queueStatusCode ? <QueueBadge statusCode={queueStatusCode} /> : null}
      onOpen={onOpen}
    />
  )
}
