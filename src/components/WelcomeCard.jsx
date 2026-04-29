import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// V3-extension — guided first-run onboarding card.
//
// Renders ONCE PER USER on the Dashboard. Persistence is in
// profiles.welcome_dismissed_at (migration 024) so the card stays
// dismissed across devices, browsers, and incognito sessions for
// the same authenticated account.
//
// Hybrid storage:
//   - localStorage 'tractova_welcome_dismissed' is the FAST PATH --
//     read synchronously on mount so we don't flash the card while
//     waiting for the Supabase profile fetch.
//   - profiles.welcome_dismissed_at is the SOURCE OF TRUTH -- if
//     localStorage is empty (e.g. new device for an existing user),
//     we fall back to the DB and sync localStorage forward.
//
// On dismissal we write BOTH stores. If migration 024 hasn't been
// applied yet (column doesn't exist), the DB write fails soft and
// localStorage still wins -- no regression vs the old behavior.

const STORAGE_KEY = 'tractova_welcome_dismissed'

// Pre-filled Lens demo: high-feasibility IL CS project. Auto-submits
// because all 5 params are URL-present (per existing Search.jsx logic).
const DEMO_HREF = '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar'

export default function WelcomeCard() {
  const { user } = useAuth()
  // null = checking, false = hide, true = show
  const [visible, setVisible] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Fast path: localStorage already says dismissed -> never show.
    let localDismissed = false
    try { localDismissed = window.localStorage.getItem(STORAGE_KEY) === '1' } catch {}
    if (localDismissed) { setVisible(false); return }

    // No user yet (auth still resolving) -- defer decision.
    if (!user?.id) return

    // Slow path: check DB. If DB has a dismissal timestamp, sync
    // localStorage forward so future page loads hit the fast path.
    let cancelled = false
    supabase
      .from('profiles')
      .select('welcome_dismissed_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        // Column missing (migration not run) or any other error -> show
        // the card. Fail-soft so onboarding still works pre-migration.
        if (error || !data) { setVisible(true); return }
        if (data.welcome_dismissed_at) {
          setVisible(false)
          try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
        } else {
          setVisible(true)
        }
      })
    return () => { cancelled = true }
  }, [user?.id])

  const dismiss = async () => {
    // Optimistic UI: hide immediately + write localStorage fast path.
    setVisible(false)
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
    // Source of truth: persist to DB. Fail-soft on missing column.
    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ welcome_dismissed_at: new Date().toISOString() })
          .eq('id', user.id)
      } catch (e) {
        console.warn('[WelcomeCard] dismiss persist failed:', e?.message)
      }
    }
  }

  if (visible !== true) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-xl mb-5 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
    >
      {/* V3 teal rail */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 25%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.55) 75%, transparent 100%)' }} />

      {/* Subtle parcel-grid overlay echoing the Tractova mark */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right, #5EEAD4 1px, transparent 1px), linear-gradient(to bottom, #5EEAD4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="relative px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] font-semibold mb-2"
              style={{ color: '#5EEAD4' }}>
              ◆ Welcome to Tractova
            </p>
            <h2 className="font-serif text-2xl sm:text-[28px] font-semibold text-white tracking-tight"
              style={{ letterSpacing: '-0.02em' }}>
              Intelligence for the moment that matters.
            </h2>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
              A 30-second tour of how Tractova works. You can dismiss this and find your way around at any time.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss welcome"
            className="text-white/35 hover:text-white/85 transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center -mt-1 -mr-2 flex-shrink-0"
          >×</button>
        </div>

        {/* Three steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <Step
            n="01"
            title="Scan the market"
            body="Click any state on the map below to drill into program status, IX conditions, and recent news."
          />
          <Step
            n="02"
            title="Run an analysis"
            body="Tractova Lens delivers a county-level feasibility report with three-pillar AI commentary in seconds."
          />
          <Step
            n="03"
            title="Track your pipeline"
            body="Save Lens results to your Library, set alerts, share Deal Memos, and track stage progression."
          />
        </div>

        {/* Primary CTA + dismiss-as-secondary */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={DEMO_HREF}
            onClick={dismiss}
            className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.18em] font-semibold px-4 py-2.5 rounded-lg text-white transition-transform hover:-translate-y-px"
            style={{ background: '#14B8A6', boxShadow: '0 4px 12px rgba(20,184,166,0.30)' }}
          >
            Try a Lens analysis (Will County, IL · 5 MW)
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
          <button
            onClick={dismiss}
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Skip — explore on my own
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Step({ n, title, body }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#5EEAD4' }}>
        {n}
      </p>
      <p className="font-serif text-[15px] font-semibold text-white tracking-tight mb-1" style={{ letterSpacing: '-0.01em' }}>
        {title}
      </p>
      <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
        {body}
      </p>
    </div>
  )
}
