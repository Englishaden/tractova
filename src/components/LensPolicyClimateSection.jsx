// Policy Impact Ecosystem (PIE-001) Phase F — the "4th shadow pillar"
// of Pillar Diagnostics (§ 04). Sits BELOW the 3-card grid (Offtake / IX /
// Site) as a full-width collapsible, surfacing cross-cutting policy events
// that don't have a single pillar card to live on, plus every policy for
// the state grouped by pillar with full provenance.
//
// NOT a top-level § section — it lives inside § 04. That keeps the § order
// stable (§ 04 = Pillar Diagnostics, § 05 = Comparable Deals next) and
// communicates that policy events are a 4th DIMENSION of pillar analysis,
// not a separate scope.
//
// Honest-data discipline (already enforced upstream by policyAdjustments +
// PolicyChipStrip) is surfaced here too: "💵 Modeled in financials" tag
// for high-conf rows that move Studio + composite, "📋 Qualitative — not
// modeled" tag for medium/low.

import { useState } from 'react'
import GlossaryLabel from './ui/GlossaryLabel'
import CollapsibleSubsection from './CollapsibleSubsection'

const PILLAR_LABELS = {
  offtake:         '◆ Offtake',
  ix:              '◆ Interconnect',
  site:            '◆ Site',
  'cross-cutting': '◆ Cross-cutting',
}

const PILLAR_ORDER = ['offtake', 'ix', 'site', 'cross-cutting']

const CONF_STYLE = {
  high:   { tag: '💵 Modeled in financials', color: '#92400E', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  medium: { tag: '📋 Qualitative — not modeled', color: '#92400E', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)' },
  low:    { tag: '📋 Qualitative — not modeled', color: '#475569', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.30)' },
}

function PolicyEventRow({ event }) {
  const [open, setOpen] = useState(false)
  const conf = event.impact_confidence || 'low'
  const style = CONF_STYLE[conf] || CONF_STYLE.low
  const tierTag = (event.min_mw_ac != null && event.max_mw_ac != null) ? ` · ${event.min_mw_ac}-${event.max_mw_ac} MW` : ''

  return (
    <div className="rounded-md border" style={{ borderColor: style.border, background: style.bg }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold truncate" style={{ color: style.color }}>
            {event.event_name}{tierTag}
          </div>
          {event.summary && (
            <div className="text-[10px] mt-0.5 leading-snug opacity-80 line-clamp-2" style={{ color: style.color }}>
              {event.summary}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: style.color, opacity: 0.85 }}>
            {style.tag}
          </span>
          {event.effective_date && (
            <span className="font-mono text-[8px] opacity-70" style={{ color: style.color }}>
              Eff. {event.effective_date}
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-[10px] leading-relaxed border-t" style={{ color: style.color, borderColor: style.border }}>
          {event.impact_methodology && (
            <div className="whitespace-pre-wrap opacity-90 mb-2">
              {event.impact_methodology.slice(0, 800)}
              {event.impact_methodology.length > 800 ? '…' : ''}
            </div>
          )}
          {event.analyst_note && event.analyst_note !== event.impact_methodology && (
            <div className="whitespace-pre-wrap opacity-80 mb-2 italic">
              {event.analyst_note.slice(0, 500)}
              {event.analyst_note.length > 500 ? '…' : ''}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            {event.source_url && (
              <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: style.color }}>
                source ↗
              </a>
            )}
            {event.verified_at && (
              <span className="opacity-60">verified {new Date(event.verified_at).toISOString().slice(0, 10)}</span>
            )}
            {event.feoc_compliance_required && (
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#991B1B' }}>FEOC</span>
            )}
            {event.safe_harbor_eligible && (
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded" style={{ background: '#D1FAE5', color: '#065F46' }}>Safe harbor</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LensPolicyClimateSection({ policyEvents, stateName, mw, technology }) {
  if (!Array.isArray(policyEvents) || policyEvents.length === 0) return null

  // Filter: published + active rows only. Don't MW-band-filter here — the
  // section shows ALL active policy events for the state regardless of size
  // (cross-cutting + tier rows for OTHER MW bands are still informative for
  // a developer scanning the market).
  const active = policyEvents.filter(e => e?.is_active !== false && (e.review_status === 'published' || !e.review_status))
  if (active.length === 0) return null

  const byPillar = {}
  for (const p of PILLAR_ORDER) byPillar[p] = []
  for (const e of active) {
    const pillar = byPillar[e.pillar] ? e.pillar : 'cross-cutting'
    byPillar[pillar].push(e)
  }

  const highConfCount = active.filter(e => e.impact_confidence === 'high').length

  const title = (
    <GlossaryLabel
      term="Active Policy"
      displayAs="◆ Active Policy Climate"
      className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0"
    />
  )

  const description = (
    <>
      shadow pillar · {active.length} event{active.length !== 1 ? 's' : ''} for {stateName}
      {highConfCount > 0 && (
        <>
          {' · '}
          <GlossaryLabel term="Modeled in financials" displayAs={`${highConfCount} modeled`} className="text-[11px] text-gray-500" />
        </>
      )}
    </>
  )

  return (
    <CollapsibleSubsection
      title={title}
      description={description}
      defaultOpen
      borderLeft="#0A1828"
    >
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Cross-cutting and per-pillar policy events for this state. The chips on each
        pillar card above show only the events filed to that pillar; this section is
        the complete view across all four pillars (including the cross-cutting events
        that don't have a single home).
        <GlossaryLabel term="Modeled in financials" displayAs=" High-confidence rows" className="text-[11px] text-gray-500" />
        {' '}feed Scenario Studio + composite; medium/low rows are{' '}
        <GlossaryLabel term="Qualitative — not modeled" displayAs="qualitative" className="text-[11px] text-gray-500" />.
      </p>
      <div className="mt-4 space-y-4">
        {PILLAR_ORDER.map(pillar => {
          const rows = byPillar[pillar]
          if (rows.length === 0) return null
          return (
            <div key={pillar} className="space-y-1.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold text-gray-500">
                {PILLAR_LABELS[pillar]}
              </div>
              <div className="space-y-1.5">
                {rows.map(e => <PolicyEventRow key={e.id} event={e} />)}
              </div>
            </div>
          )
        })}
      </div>
    </CollapsibleSubsection>
  )
}
