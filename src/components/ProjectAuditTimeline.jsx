import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProjectEvents } from '../lib/projectEvents'
import TractovaLoader from './ui/TractovaLoader'

// ── Audit timeline -- reverse-chrono event log per project ────────────────
// Surfaces the project_events table as a timeline. Lazy-loads on first
// open of the Audit tab so most users never spend the supabase round-trip.
const EVENT_KIND_META = {
  created:         { color: '#0F766E', label: 'Created' },
  stage_change:    { color: '#2563EB', label: 'Stage' },
  score_change:    { color: '#D97706', label: 'Score' },
  alert_triggered: { color: '#DC2626', label: 'Alert' },
  note_updated:    { color: '#5A6B7A', label: 'Note' },
  shared:          { color: '#7C3AED', label: 'Shared' },
}

// Collapse adjacent same-kind same-detail events into one entry with a
// repeat count + earliest/latest range. The score_change inserter has been
// firing duplicate rows when scores oscillate around the threshold (e.g.
// 65 → 70 → 65 → 70 across multiple cron runs). Without dedupe the timeline
// becomes 20 identical rows that obscure the genuinely meaningful events.
function collapseRepeatedEvents(rows) {
  if (!rows || rows.length === 0) return []
  const out = []
  for (const e of rows) {
    const last = out[out.length - 1]
    if (last && last.kind === e.kind && last.detail === e.detail) {
      // Same event firing again -- bump count, widen the time range.
      last.repeatCount = (last.repeatCount || 1) + 1
      last.firstAt = e.created_at  // rows arrive newest-first; earlier = later in iteration
    } else {
      out.push({ ...e, repeatCount: 1, firstAt: e.created_at })
    }
  }
  return out
}

const AUDIT_INITIAL_LIMIT = 8

export default function ProjectAuditTimeline({ projectId, refreshKey = 0 }) {
  const [rawEvents, setRawEvents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  // token → view_count map for `shared` events. Owners see how many times each
  // shared link has actually been opened, turning the audit log into a soft
  // engagement signal ("the IC opened it 4 times" beats "you sent the link").
  const [shareViews, setShareViews] = useState({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setShowAll(false)
    fetchProjectEvents(projectId).then(async (rows) => {
      if (cancelled) return
      setRawEvents(rows)
      setLoading(false)

      const tokens = (rows || [])
        .filter(e => e.kind === 'shared' && e.meta?.token)
        .map(e => e.meta.token)
      if (tokens.length === 0) { setShareViews({}); return }

      const { data, error } = await supabase
        .from('share_tokens')
        .select('token, view_count')
        .in('token', tokens)
      if (cancelled) return
      if (error) { console.warn('[audit] share view counts fetch failed:', error.message); return }
      const map = {}
      for (const row of data || []) map[row.token] = row.view_count
      setShareViews(map)
    })
    return () => { cancelled = true }
  }, [projectId, refreshKey])

  if (loading) {
    // 2026-05-05: switched from LoadingDot (inline green dot) to
    // TractovaLoader per saved feedback memory on cinematic loading style.
    // The Audit tab is a discrete tab-switch; users want a branded loader,
    // not a bare dot.
    return (
      <div className="flex items-center justify-center py-8">
        <TractovaLoader size={48} label="Loading audit trail" />
      </div>
    )
  }

  if (!rawEvents || rawEvents.length === 0) {
    return (
      <p className="text-xs text-ink-muted italic">
        No events logged yet. Stage changes and notes update this timeline. Older projects (created before audit logging shipped) will only show new events from now on.
      </p>
    )
  }

  const collapsed = collapseRepeatedEvents(rawEvents)
  const visible = showAll ? collapsed : collapsed.slice(0, AUDIT_INITIAL_LIMIT)
  const hidden = collapsed.length - visible.length

  return (
    <div>
      <ol className="relative ml-3 border-l border-gray-200">
        {visible.map((e) => {
          const meta = EVENT_KIND_META[e.kind] || { color: '#5A6B7A', label: e.kind }
          const dt = new Date(e.created_at)
          const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const viewCount = e.kind === 'shared' && e.meta?.token ? shareViews[e.meta.token] : undefined
          // For collapsed groups, surface the range (oldest → newest).
          const isRepeat = (e.repeatCount || 1) > 1
          const firstDt = isRepeat ? new Date(e.firstAt) : null
          const firstDateStr = firstDt
            ? firstDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null
          return (
            <li key={e.id} className="ml-4 pb-4 last:pb-0">
              <span
                className="absolute left-[-5px] w-[9px] h-[9px] rounded-full"
                style={{ background: meta.color, boxShadow: '0 0 0 3px #F9FAFB' }}
              />
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                  {isRepeat
                    ? `${firstDateStr} – ${dateStr} · ${timeStr}`
                    : `${dateStr} · ${timeStr}`}
                </span>
                {isRepeat && (
                  <span
                    className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] tabular-nums px-1.5 py-px rounded-xs"
                    style={{ color: '#5A6B7A', background: 'rgba(90,107,122,0.08)', border: '1px solid rgba(90,107,122,0.20)' }}
                    title={`This event fired ${e.repeatCount} times across the date range shown`}
                  >
                    × {e.repeatCount}
                  </span>
                )}
                {typeof viewCount === 'number' && (
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.18em] tabular-nums px-1.5 py-px rounded-xs border"
                    style={{ color: '#7C3AED', borderColor: 'rgba(124, 58, 237, 0.25)', background: 'rgba(124, 58, 237, 0.06)' }}
                    title={viewCount === 0 ? 'Link not yet opened' : `Recipient opened the link ${viewCount} time${viewCount === 1 ? '' : 's'}`}
                  >
                    {viewCount} {viewCount === 1 ? 'view' : 'views'}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink mt-0.5 leading-relaxed">{e.detail}</p>
            </li>
          )
        })}
      </ol>

      {/* Show-more / Show-less toggle. Limits the default render to keep
          the audit tab from scrolling forever on projects with long histories
          (especially when the score_change deduper hasn't been able to
          collapse enough). */}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 ml-3 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700 hover:text-teal-900 transition-colors"
        >
          Show {hidden} earlier event{hidden === 1 ? '' : 's'} →
        </button>
      )}
      {showAll && collapsed.length > AUDIT_INITIAL_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 ml-3 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Show fewer
        </button>
      )}
    </div>
  )
}
