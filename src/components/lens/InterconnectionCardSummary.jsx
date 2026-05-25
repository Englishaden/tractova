// Interconnection summary card — compact glance variant for §04. See
// OfftakeCardSummary for shell + design notes.

import { SummaryShell } from './OfftakeCardSummary'
import { QueueBadge } from '../../lib/searchShared.jsx'

const PILLAR_ACCENT = '#D97706'

export default function InterconnectionCardSummary({ interconnection, score, coverage, onOpen }) {
  const servingUtility = interconnection?.servingUtility || 'Utility TBD'
  const queueStatusCode = interconnection?.queueStatusCode || null

  return (
    <SummaryShell
      pillarLabel="02 / Interconnection"
      pillarAccent={PILLAR_ACCENT}
      title={servingUtility}
      score={score}
      coverage={coverage}
      statusChip={queueStatusCode ? <QueueBadge statusCode={queueStatusCode} /> : null}
      onOpen={onOpen}
    />
  )
}
