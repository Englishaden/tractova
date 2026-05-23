// Interconnection summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'
import { QueueBadge } from '../../lib/searchShared.jsx'

const PILLAR_ACCENT = '#D97706'

export default function InterconnectionCardSummary({ interconnection, queueSummary, score, coverage, onOpen }) {
  const servingUtility = interconnection?.servingUtility || 'Utility TBD'
  const queueStatusCode = interconnection?.queueStatusCode || null

  // Caption prefers live data when wired; falls back to curated string.
  let caption = null
  if (queueSummary && queueSummary.signalType === 'cs_pipeline') {
    // Distribution CS pipeline (NYSERDA) — show pipeline vs energized, not a
    // study window (this source doesn't observe one).
    caption = `${queueSummary.totalProjects.toLocaleString()} CS in pipeline · ${(queueSummary.completedProjects || 0).toLocaleString()} energized · NY-Sun`
  } else if (queueSummary && queueSummary.totalProjects > 0) {
    const months = queueSummary.avgStudyMonths
    const mwPending = queueSummary.totalMW
    caption = `${months}-mo avg study · ${mwPending.toLocaleString()} MW pending in ${queueSummary.iso || 'queue'}`
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
