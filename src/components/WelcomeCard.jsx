import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

// V3-extension — guided first-run onboarding card.
//
// Renders ONCE per browser for new authed users on the Dashboard. Three
// step explanations + a "Run an example Lens analysis" CTA that pre-
// fills a known-good demo (IL / Will County / 5 MW / Prospecting / CS).
// The pre-fill auto-submits in Search.jsx since all 5 params are present.
//
// Storage: localStorage key `tractova_welcome_dismissed`. Per-device,
// not per-user, intentionally -- we want the welcome to disappear after
// first session even if the user signs out + back in. If they switch
// devices, they see it again -- usually fine for a 3-step intro that
// reinforces basics.
//
// Dismissal happens on:
//   - Explicit X click
//   - Click on the "Try Lens" CTA (they're already off the dashboard)
//   - Click on any step's secondary CTA

const STORAGE_KEY = 'tractova_welcome_dismissed'

// Pre-filled Lens demo: high-feasibility IL CS project. Auto-submits
// because all 5 params are URL-present (per existing Search.jsx logic).
const DEMO_HREF = '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar'

export default function WelcomeCard() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY)
      if (!dismissed) setVisible(true)
    } catch { /* localStorage blocked -- just don't show, fail silent */ }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!visible) return null

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
