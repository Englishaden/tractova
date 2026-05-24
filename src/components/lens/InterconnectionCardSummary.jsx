// Interconnection summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'
import { QueueBadge } from '../../lib/searchShared.jsx'
import { structureNoun } from '../../lib/lensFormConstants'

const PILLAR_ACCENT = '#D97706'

export default function InterconnectionCardSummary({ interconnection, queueSummary, hostingCapacity, score, coverage, onOpen }) {
  const servingUtility = interconnection?.servingUtility || 'Utility TBD'
  const queueStatusCode = interconnection?.queueStatusCode || null

  // Caption prefers live data when wired; falls back to curated string.
  let caption = null
  if (queueSummary && queueSummary.signalType === 'cs_pipeline') {
    // Distribution DG pipeline — noun follows the selected monetization-structure
    // view (CS / net-metering / DG), not a hardcoded "CS". Show pipeline (+ energized
    // when the source reports it), not a study window (these sources don't observe one).
    const region = queueSummary.sourceRegion || 'distribution'
    const noun = structureNoun(queueSummary.view, queueSummary.availableStructures).short
    if (queueSummary.totalProjects === 0) {
      caption = `No ${noun} interconnection-queue data for this state yet · curated baseline`
    } else {
      caption = queueSummary.completedProjects != null
        ? `${queueSummary.totalProjects.toLocaleString()} ${noun} in pipeline · ${queueSummary.completedProjects.toLocaleString()} energized · ${region}`
        : `${queueSummary.totalProjects.toLocaleString()} ${noun} in active pipeline · ${region}`
    }
  } else if (queueSummary && queueSummary.totalProjects > 0) {
    const months = queueSummary.avgStudyMonths
    const mwPending = queueSummary.totalMW
    caption = `${months}-mo avg study · ${mwPending.toLocaleString()} MW pending in ${queueSummary.iso || 'queue'}`
  } else if (hostingCapacity && hostingCapacity.utilityCount > 0) {
    // Grid headroom (hosting capacity) — a different live signal than a queue.
    const n = hostingCapacity.utilityCount
    const utils = `${n} ${n === 1 ? 'utility' : 'utilities'}`
    caption = hostingCapacity.maxAvailMw != null
      ? `Hosting capacity: best ${hostingCapacity.maxAvailMw} MW open · ${utils}`
      : `Live grid hosting capacity · ${utils}`
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
