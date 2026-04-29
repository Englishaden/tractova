import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'

// V3 §4.7 Deal Memo shareable URL — public read-only memo view.
// No auth required. Token validation + view-cap enforcement happens in the
// /api/lens-insight 'memo-view' action server-side.
export default function MemoView() {
  const { token } = useParams()
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'memo-view', token }),
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Failed to load memo')
          setLoading(false)
          return
        }
        setSnapshot(json.memo)
        setLoading(false)

        // Owner-detection: snapshot embeds ownerUserId at create time, so
        // we can check ownership with a single auth call -- no DB round-trip
        // and no RLS dependency. Anonymous viewers (no session) skip this
        // entirely; the common case is fast.
        const ownerUserId = json.memo?.ownerUserId
        if (ownerUserId) {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!cancelled && user && user.id === ownerUserId) setIsOwner(true)
          } catch { /* not signed in -- public viewer flow */ }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Network error -- please try again')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-muted">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
          <span className="font-mono text-xs uppercase tracking-[0.18em]">Loading memo</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.20em] text-ink-muted mb-3">Tractova · Shared Memo</div>
          <h1 className="font-serif text-2xl font-semibold text-ink mb-3" style={{ letterSpacing: '-0.02em' }}>Memo unavailable</h1>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">{error}</p>
          <Link to="/" className="inline-block font-mono text-xs uppercase tracking-[0.18em] text-teal-700 hover:text-teal-900">Go to Tractova →</Link>
        </div>
      </div>
    )
  }

  const { memo, project, stateProgram, sharedAt, sharedByName } = snapshot
  // Older tokens stored sharedBy: <email>; we deliberately ignore that field
  // here so the shared URL never leaks the owner's email to recipients.
  // Only sharedByName (display name) is rendered.
  const sharedDate = sharedAt ? new Date(sharedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-paper">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>

          {/* Header — brand chrome */}
          <div className="rounded-xl px-8 py-7 mb-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] mb-3" style={{ color: '#5EEAD4' }}>
              ◆ Tractova · Deal Memo
            </div>
            <h1 className="font-serif text-3xl font-semibold text-white tracking-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
              {project?.name || 'Project Memo'}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {project?.county} County, {project?.stateName || project?.state} · {project?.mw} MW · {project?.technology || 'Community Solar'}
            </p>
            {sharedDate && (
              <div className="font-mono text-[10px] tracking-[0.18em] mt-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Shared {sharedDate}{sharedByName ? ` · by ${sharedByName}` : ''}
              </div>
            )}
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <MetricCard label="Feasibility Index" value={project?.feasibilityScore ?? '—'} accent="#0F766E" />
            <MetricCard label="Project Size" value={`${project?.mw ?? '—'} MW`} />
            <MetricCard label="Stage" value={project?.stage || '—'} small />
          </div>

          {/* AI memo sections */}
          {memo && (
            <div className="grid gap-5 mb-8">
              {memo.recommendation && (
                <MemoSection eyebrow="Recommendation · Next 30 days" body={memo.recommendation} accent="#0F766E" highlight />
              )}
              {memo.siteControlSummary && (
                <MemoSection eyebrow="Site Control" body={memo.siteControlSummary} accent="#2563EB" />
              )}
              {memo.ixSummary && (
                <MemoSection eyebrow="Interconnection" body={memo.ixSummary} accent="#D97706" />
              )}
              {memo.revenueSummary && (
                <MemoSection eyebrow="Revenue Outlook" body={memo.revenueSummary} accent="#0F766E" />
              )}
            </div>
          )}

          {/* Program context — frozen at share time */}
          {stateProgram && (
            <div className="rounded-xl px-6 py-5 mb-8" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-ink-muted mb-3">Program Context</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="CS Program" value={stateProgram.csProgram || '—'} />
                <Field label="Status" value={stateProgram.csStatus || '—'} />
                <Field label="Capacity Remaining" value={stateProgram.capacityMW ? `${stateProgram.capacityMW} MW` : '—'} />
                <Field label="LMI Required" value={stateProgram.lmiRequired ? `${stateProgram.lmiPercent}%` : 'Not required'} />
                {stateProgram.programNotes && (
                  <div className="col-span-2 mt-2 pt-3 border-t border-gray-100">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted mb-1">Notes</p>
                    <p className="text-[13px] text-ink leading-relaxed">{stateProgram.programNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Owner CTA -- only renders if the signed-in viewer owns this
              project. Quick path back into Library so the owner can re-open
              the live (un-frozen) view, edit notes, or share again. */}
          {isOwner && (
            <div
              className="rounded-lg px-5 py-4 mb-6 flex items-center justify-between gap-4"
              style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(15,118,110,0.22)' }}
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.20em] mb-1" style={{ color: '#0F766E' }}>
                  ◆ You own this project
                </p>
                <p className="text-[13px] text-ink leading-relaxed">
                  This is the snapshot recipients see. The live view in Library reflects current market data.
                </p>
              </div>
              <Link
                to="/library"
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors"
                style={{ background: '#0F1A2E' }}
              >
                Open in Library
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 border-t" style={{ borderColor: '#E2E8F0' }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-ink-muted mb-2">
              Tractova · Intelligence For The Moment That Matters
            </p>
            <p className="text-[11px] text-ink-muted leading-relaxed max-w-md mx-auto">
              This memo is a frozen snapshot from when it was shared. Underlying market data may have changed since then.
              {' '}
              <Link to="/" className="text-teal-700 hover:text-teal-900 font-medium">Open Tractova →</Link>
            </p>
          </div>

        </motion.div>
      </main>
    </div>
  )
}

function MetricCard({ label, value, accent = '#0F1A2E', small = false }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-ink-muted mb-1">{label}</p>
      <p className={`font-mono font-bold tabular-nums leading-none ${small ? 'text-base' : 'text-2xl'}`} style={{ color: accent }}>
        {value}
      </p>
    </div>
  )
}

function MemoSection({ eyebrow, body, accent, highlight = false }) {
  return (
    <div
      className="rounded-lg px-5 py-4 relative"
      style={{
        background: highlight ? 'rgba(15,118,110,0.05)' : '#FFFFFF',
        border: highlight ? '1px solid rgba(15,118,110,0.20)' : '1px solid #E2E8F0',
      }}
    >
      <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: accent }} />
      <p className="font-mono text-[10px] uppercase tracking-[0.20em] mb-2 ml-2" style={{ color: accent }}>{eyebrow}</p>
      <p className="text-[14px] text-ink leading-relaxed ml-2">{body}</p>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted mb-0.5">{label}</p>
      <p className="text-sm text-ink font-medium">{value}</p>
    </div>
  )
}
