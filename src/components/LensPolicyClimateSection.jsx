// Policy Impact Ecosystem (PIE-001) Phase F — collapsible Lens section
// listing all active policy_impact_events for the state, grouped by pillar.
//
// Sits at the bottom of Lens (§ 05 · Policy Climate) so the developer sees
// every active high/medium/low-confidence policy for the state — even cross-
// cutting events that don't have a single card to live on.
//
// Honest-data discipline (already enforced upstream by policyAdjustments +
// PolicyChipStrip) is surfaced here too: "💵 Modeled in financials" tag
// for high-conf rows that move Studio + composite, "📋 Qualitative — not
// modeled" tag for medium/low.

import { useState } from 'react'

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
  const [open, setOpen] = useState(true)
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

  return (
    <div className="mb-6 bg-white rounded-lg overflow-hidden relative" style={{ border: '1px solid #E2E8F0' }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #F59E0B 30%, #F59E0B 70%, transparent 100%)' }} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-100 text-left"
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold text-ink">
            § 05 · Active Policy Climate
          </span>
          <span className="text-[11px] text-gray-500">
            {active.length} event{active.length !== 1 ? 's' : ''} for {stateName}
            {highConfCount > 0 && ` · ${highConfCount} modeled in financials`}
          </span>
        </div>
        <span className="text-[10px] text-gray-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-6 py-4 space-y-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Active enacted policies for this state from <code className="text-[10px]">policy_impact_events</code>.
            High-confidence rows feed into Scenario Studio + the state feasibility composite;
            medium/low-confidence rows surface here for situational awareness but don't
            adjust numbers. Click a row for methodology + source.
          </p>
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
      )}
    </div>
  )
}
