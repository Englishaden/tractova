import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// ── Share Deal Memo button -- generates token-protected public URL ───────
// Posts to /api/lens-insight 'memo-create' with a pre-generated AI memo +
// project snapshot. Server returns { token, url, expiresAt }. We copy the
// fully-qualified URL to clipboard and show a toast.
export default function ShareDealMemoButton({ project, stateProgram, countyData, stage, liveScore, shareCount = 0, onShareSuccess, selectedScenario = null }) {
  const [sharing, setSharing] = useState(false)
  // Persistent share confirmation panel -- the transient toast is easy to
  // miss, especially if the user is mid-scroll. We hold the URL inline until
  // the user explicitly dismisses it so they can copy-again or verify.
  const [sharedUrl, setSharedUrl] = useState(null)
  const [copyState, setCopyState] = useState('idle') // 'idle' | 'copied'

  const handleShare = async (e) => {
    e.stopPropagation()
    setSharing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setSharing(false); return }

      // Step 1: generate AI memo (re-uses the existing 'deal-memo' action).
      let memo = null
      try {
        const memoRes = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'deal-memo',
            project: { ...project, stage, technology: project.technology },
            stateProgram,
            countyData,
          }),
        })
        if (memoRes.ok) {
          const json = await memoRes.json()
          memo = json.memo || null
        }
      } catch { /* fall through with null memo -- still creates a shareable snapshot */ }

      // Step 2: store snapshot + get token.
      const stateOverride = stateProgram ? { ...stateProgram, feasibilityScore: liveScore ?? stateProgram.feasibilityScore } : stateProgram
      const createRes = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'memo-create',
          project,
          stateProgram: stateOverride,
          countyData,
          memo: memo || { recommendation: 'No AI memo generated; viewing project context only.' },
          // Optional saved scenario — when the user has one selected on this
          // card (Include in PDF toggle), it rides the same share so the
          // recipient sees the deal memo + scenario in a single link.
          scenario: selectedScenario || null,
        }),
      })
      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}))
        console.error('[Memo Share] create failed:', errJson)
        setSharing(false)
        return
      }
      const { url } = await createRes.json()
      const fullUrl = `${window.location.origin}${url}`
      let copied = false
      try {
        await navigator.clipboard.writeText(fullUrl)
        copied = true
      } catch { /* clipboard may be blocked; the link is still visible inline */ }

      // Bump the per-project share count locally + flag audit timeline to
      // refetch. Both are passed through onShareSuccess so the parent's state
      // can drive the count pill AND key-bump the timeline.
      if (typeof onShareSuccess === 'function') onShareSuccess()

      // Persist the URL inline so the user can re-copy or verify even if
      // they missed the toast.
      setSharedUrl(fullUrl)
      setCopyState(copied ? 'copied' : 'idle')

      // Toast still fires for users who like the auto-feedback.
      try {
        const evt = new CustomEvent('tractova:toast', { detail: {
          kind: 'success',
          eyebrow: '◆ Memo Link Copied',
          title: copied ? 'Shareable URL copied to clipboard' : 'Shareable URL ready below',
          description: `Expires in 90 days · capped at 100 views`,
        } })
        window.dispatchEvent(evt)
      } catch {}
    } finally {
      setSharing(false)
    }
  }

  const handleCopyAgain = async () => {
    if (!sharedUrl) return
    try {
      await navigator.clipboard.writeText(sharedUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1800)
    } catch {}
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.30)' }}
          title="Copy a read-only shareable link to this Deal Memo (90-day expiry)"
        >
          {sharing ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-teal-300 border-t-teal-700 animate-spin" />
              Building link…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share Link
            </>
          )}
        </button>
        {shareCount > 0 && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm"
            style={{ color: '#5A6B7A', background: 'rgba(90,107,122,0.08)' }}
            title={`${shareCount} active share link${shareCount === 1 ? '' : 's'} (excludes expired)`}
          >
            Shared {shareCount}×
          </span>
        )}
      </div>

      {/* Persistent share confirmation -- shows the URL inline so users who
          miss the transient toast still have the link visible until they
          dismiss the panel. Click "Copy" to re-copy without re-generating. */}
      {sharedUrl && (
        <div
          className="rounded-lg px-3 py-2.5 w-full max-w-[420px]"
          style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold" style={{ color: '#0F766E' }}>
              ◆ {copyState === 'copied' ? 'Copied to clipboard' : 'Share link ready'}
            </p>
            <button
              onClick={() => setSharedUrl(null)}
              aria-label="Dismiss share link"
              className="text-[11px] text-ink-muted hover:text-ink"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={sharedUrl}
              onClick={(e) => e.target.select()}
              className="flex-1 text-[11px] font-mono bg-white px-2 py-1 rounded-sm border border-gray-200 text-ink truncate"
            />
            <button
              onClick={handleCopyAgain}
              className="text-[10px] font-mono uppercase tracking-[0.16em] font-semibold px-2 py-1 rounded-sm text-white"
              style={{ background: '#0F766E' }}
            >
              {copyState === 'copied' ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-ink-muted mt-1.5 leading-relaxed">
            Anyone with this link can view the frozen memo · expires in 90 days · 100-view cap
          </p>
        </div>
      )}
    </div>
  )
}
