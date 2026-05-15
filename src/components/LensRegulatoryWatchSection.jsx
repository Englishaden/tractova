// § 06 · Regulatory Watch
//
// Chronological view of state regulatory activity. Distinct from § 04
// (Policy Climate) which AGGREGATES policy_impact_events into a pillar
// sub-score, § 06 takes the same table and slices it BY TIME so the
// developer reads "what's pending, what just changed, what's on the books"
// instead of "how does policy stack up against this pillar."
//
// Two subsections:
//   1. ◆ Pending & Recent Events — policy_impact_events feed, organized by
//      recency bucket (pending/upcoming → recent ≤90d → earlier). Reuses
//      results.policyEvents (already fetched by Search.jsx, no new query).
//   2. ◆ Active Proceedings — puc_dockets feed, curation-gated. Hides when
//      no dockets are seeded for the state (most states today). Same panel
//      that previously rendered as MaybeRegulatoryPanel at the bottom of
//      Lens results.
//
// Content tap: low-friction. Policy article URL → AI classify → draft
// policy_impact_events row → admin review → published → surfaces here.
// PDF-text paste intake (planned next slice) widens the funnel further.

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getPucDockets } from '../lib/programData'
import SectionMarker from './SectionMarker'
import RegulatoryActivityPanel from './RegulatoryActivityPanel'
import CollapsibleSubsection from './CollapsibleSubsection'
import GlossaryLabel from './ui/GlossaryLabel'

const EVENT_TYPE_LABEL = {
  enacted_bill:    'Bill',
  puc_order:       'PUC Order',
  tariff_change:   'Tariff Change',
  rule_filing:     'Rule Filing',
  executive_order: 'Exec Order',
}

const STATUS_STYLE = {
  pending:             { label: 'Pending',     bg: 'rgba(20,184,166,0.10)',  color: '#0F766E', border: 'rgba(15,118,110,0.32)' },
  enacted:             { label: 'Enacted',     bg: 'rgba(15,26,46,0.06)',    color: '#0F1A2E', border: 'rgba(15,26,46,0.18)' },
  partially_effective: { label: 'Partial',     bg: 'rgba(245,158,11,0.10)',  color: '#B45309', border: 'rgba(245,158,11,0.30)' },
  overturned:          { label: 'Overturned',  bg: 'rgba(220,38,38,0.08)',   color: '#DC2626', border: 'rgba(220,38,38,0.30)' },
  expired:             { label: 'Expired',     bg: 'rgba(90,107,122,0.08)',  color: '#5A6B7A', border: 'rgba(90,107,122,0.22)' },
}

const PILLAR_COLOR = {
  offtake:        '#0F766E',
  ix:             '#D97706',
  site:           '#2563EB',
  'cross-cutting': '#5A6B7A',
}

const PILLAR_LABEL = {
  offtake:        'Offtake',
  ix:             'Interconnect',
  site:           'Site',
  'cross-cutting': 'Cross-cutting',
}

// Bucket events for organizing the chronological feed.
//   pending  — status='pending' OR effectiveDate in future
//   recent   — effectiveDate within last 90 days
//   earlier  — older / undated
function bucketEvent(event) {
  if (event.status === 'pending') return 'pending'
  if (!event.effectiveDate) return 'earlier'
  const eff = new Date(event.effectiveDate)
  const now = new Date()
  const daysFromNow = Math.round((eff - now) / (1000 * 60 * 60 * 24))
  if (daysFromNow > 0)  return 'pending'
  if (daysFromNow >= -90) return 'recent'
  return 'earlier'
}

function fmtRelative(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.round((d - now) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'today'
  if (diff > 0)   return `in ${diff} day${diff !== 1 ? 's' : ''}`
  if (diff > -30) return `${-diff} day${-diff !== 1 ? 's' : ''} ago`
  const months = Math.round(-diff / 30)
  if (months < 12) return `${months} mo ago`
  const years = Math.round(-diff / 365)
  return `${years} yr ago`
}

function EventRow({ event }) {
  const [open, setOpen] = useState(false)
  const status         = STATUS_STYLE[event.status] || STATUS_STYLE.enacted
  const eventTypeLabel = EVENT_TYPE_LABEL[event.eventType] || event.eventType
  const pillarColor    = PILLAR_COLOR[event.pillar] || '#5A6B7A'
  const pillarLabel    = PILLAR_LABEL[event.pillar] || event.pillar
  const hasDetail      = event.impactMethodology || event.analystNote || event.sourceUrl

  return (
    <div
      className="rounded-md border bg-white transition-colors"
      style={{ borderColor: open && hasDetail ? '#CBD5E1' : '#E2E8F0' }}
    >
      <button
        type="button"
        onClick={() => hasDetail && setOpen(o => !o)}
        aria-expanded={hasDetail ? open : undefined}
        className={`w-full px-3 py-2.5 flex items-start justify-between gap-3 text-left transition-colors ${hasDetail ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded" style={{ background: '#F1F5F9', color: '#475569' }}>
              {eventTypeLabel}
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border" style={{ background: status.bg, color: status.color, borderColor: status.border }}>
              {status.label}
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded" style={{ background: 'transparent', color: pillarColor, border: `1px solid ${pillarColor}33` }}>
              {pillarLabel}
            </span>
            {event.feocComplianceRequired && (
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#991B1B' }}>FEOC</span>
            )}
            {event.safeHarborEligible && (
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>Safe harbor</span>
            )}
          </div>
          <div className="text-[12px] font-semibold text-ink truncate">{event.eventName}</div>
          {event.summary && (
            <div className="text-[10.5px] mt-0.5 leading-snug text-gray-600 line-clamp-2">
              {event.summary}
            </div>
          )}
          {hasDetail && (
            <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-gray-400 mt-1.5">
              {open ? 'Hide details ▴' : 'View methodology & source ▾'}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
          {event.effectiveDate && (
            <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-gray-500 whitespace-nowrap">
              {fmtRelative(event.effectiveDate)}
            </span>
          )}
          {event.effectiveDate && (
            <span className="font-mono text-[8.5px] text-gray-400 whitespace-nowrap">
              {event.effectiveDate}
            </span>
          )}
          {hasDetail && (
            <motion.svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mt-1"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          )}
        </div>
      </button>
      {open && hasDetail && (
        <div className="px-3 pb-2.5 pt-1 text-[10.5px] leading-relaxed border-t border-gray-100">
          {event.impactMethodology && (
            <div className="whitespace-pre-wrap text-gray-700 mb-2">
              {event.impactMethodology.slice(0, 800)}
              {event.impactMethodology.length > 800 ? '…' : ''}
            </div>
          )}
          {event.analystNote && event.analystNote !== event.impactMethodology && (
            <div className="whitespace-pre-wrap text-gray-600 italic mb-2">
              {event.analystNote.slice(0, 500)}
              {event.analystNote.length > 500 ? '…' : ''}
            </div>
          )}
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline text-[10.5px]" style={{ color: '#0F766E' }}>
              source ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }) {
  return <p className="text-[11px] text-gray-500 leading-relaxed">{message}</p>
}

function BucketGroup({ label, events }) {
  if (events.length === 0) return null
  return (
    <div>
      <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">
        {label} · {events.length}
      </div>
      <div className="space-y-1.5">
        {events.map(e => <EventRow key={e.id} event={e} />)}
      </div>
    </div>
  )
}

export default function LensRegulatoryWatchSection({ state, stateName, policyEvents }) {
  // Active Proceedings probe — surfaces the subsection only when at least
  // one puc_dockets row exists for the state. Curation-gated by design.
  const [hasDockets, setHasDockets] = useState(null)
  useEffect(() => {
    if (!state) { setHasDockets(false); return }
    let cancelled = false
    getPucDockets({ state }).then(rows => {
      if (!cancelled) setHasDockets((rows || []).length > 0)
    }).catch(err => {
      console.warn('[LensRegulatoryWatchSection] getPucDockets failed:', err)
      if (!cancelled) setHasDockets(false)
    })
    return () => { cancelled = true }
  }, [state])

  if (!state) return null

  const events    = policyEvents || []
  const pending   = events.filter(e => bucketEvent(e) === 'pending')
  const recent    = events.filter(e => bucketEvent(e) === 'recent')
  const earlier   = events.filter(e => bucketEvent(e) === 'earlier')
  const totalCount = events.length

  // Default-open the feed when there's a pending/recent event the developer
  // probably wants to see immediately; otherwise stay collapsed to keep the
  // Lens vertical density tight.
  const feedDefaultOpen = pending.length > 0 || recent.length > 0

  return (
    <>
      <SectionMarker
        index={6}
        label="Regulatory Watch"
        sublabel="pending bills · enacted events · active proceedings"
      />
      <div className="space-y-3">
        <CollapsibleSubsection
          title={
            <GlossaryLabel
              term="Regulatory Watch"
              displayAs="◆ Pending & Recent Events"
              className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0"
            />
          }
          description={
            <>
              chronological feed · sorted by effective date
              {totalCount > 0 && <> · <span className="font-mono">{totalCount}</span></>}
              {totalCount === 0 && (
                <span className="font-mono text-[10px] ml-1.5" style={{ color: '#94A3B8' }}>(no data yet)</span>
              )}
            </>
          }
          defaultOpen={feedDefaultOpen}
        >
          {totalCount === 0 ? (
            <EmptyState message={`No regulatory events tracked for ${stateName} yet. Admin curation surfaces enacted bills, PUC orders, tariff changes, rule filings, and executive orders here as they're sourced from policy articles or pasted PDF text.`} />
          ) : (
            <div className="space-y-4">
              <BucketGroup label="Pending & Upcoming" events={pending} />
              <BucketGroup label="Recent (last 90 days)" events={recent} />
              {earlier.length > 0 && (
                <details className="text-[10.5px]">
                  <summary className="cursor-pointer font-mono text-[8.5px] uppercase tracking-[0.18em] text-gray-500 hover:text-gray-700 select-none">
                    Earlier events · {earlier.length} ▾
                  </summary>
                  <div className="space-y-1.5 mt-2">
                    {earlier.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                </details>
              )}
            </div>
          )}
        </CollapsibleSubsection>

        {hasDockets && (
          <CollapsibleSubsection
            title={
              <GlossaryLabel
                term="Active Proceedings"
                displayAs="◆ Active Proceedings"
                className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0"
              />
            }
            description="state PUC dockets · comment-open · pending decisions"
            defaultOpen={false}
          >
            <RegulatoryActivityPanel state={state} stateName={stateName} mode="lens" />
          </CollapsibleSubsection>
        )}
      </div>
    </>
  )
}
