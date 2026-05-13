import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Mobile gate — Phase 6 (TRACTOVA-UX-001) refactor.
//
// Pre-Phase-6 the gate fired on every route under 768px. That made the
// entire signed-in surface a dead-end on phones: a user couldn't even
// glance at their saved-project library while away from a laptop, let
// alone read a glossary entry or check their Profile.
//
// New posture: gate is ROUTE-AWARE. Library/Profile/Glossary/Dashboard
// and the marketing pages stay accessible on mobile (the Library route
// internally swaps to MobileLibrary cards-only via useIsMobile). Search
// (the Lens form) and Admin stay gated — both are dense desktop tools
// where a half-rendered mobile path would mislead the underwriting flow.
//
// "Send myself a desktop link" affordance: a mailto: link with the
// current URL so a power user reading on a phone can drop the report
// into their email and pick it back up on a laptop.

const SESSION_DISMISS_KEY = 'tractova_mobile_gate_dismissed'

// Paths that still gate on mobile. Use startsWith semantics so /admin and
// nested admin routes both gate. Keep this list short — every entry is
// a feature we've decided is non-functional on a phone.
const GATED_PATHS = ['/search', '/admin']

function pathIsGated(pathname) {
  if (!pathname) return false
  return GATED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export default function MobileGate({ children }) {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1') } catch { /* private mode — best-effort */ }
    setDismissed(true)
  }

  const gated = pathIsGated(location.pathname)
  // Pass through unless: (a) we're on mobile, (b) the user hasn't already
  // dismissed for the session, and (c) the current route is desktop-only.
  if (!isMobile || dismissed || !gated) return children

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://tractova.com'
  const mailtoBody = encodeURIComponent(
    `I want to open this on desktop:\n\n${currentUrl}\n\n— sent from my phone via Tractova`
  )
  const mailtoSubject = encodeURIComponent('Open this on desktop — Tractova')
  const mailtoHref = `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`

  // What the user was trying to reach. Keeps the gate honest about which
  // feature actually requires desktop (so it's not the same message on
  // every page — Lens vs Admin tell different stories).
  const featureLabel = location.pathname.startsWith('/admin')
    ? 'Admin · Data Health'
    : 'Lens · Intelligence Report'

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: '#F8F7F4' }}>
      <div className="max-w-md w-full rounded-lg overflow-hidden" style={{ background: '#0F1A2E', border: '1px solid rgba(20,184,166,0.30)', boxShadow: '0 24px 60px -20px rgba(15,26,46,0.45)' }}>
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
        <div className="px-6 py-7">
          <div className="flex items-center gap-2.5 mb-3">
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="26" height="26" rx="5" fill="#14B8A6" opacity="0.16" />
              <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
              <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
            </svg>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: '#5EEAD4' }}>
              {featureLabel} · Desktop only
            </p>
          </div>

          <h1 className="font-serif text-[24px] leading-tight font-semibold text-white mb-3">
            This view needs a laptop.
          </h1>

          <p className="text-[14px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Tractova’s Library, Profile, and Glossary work on a phone — but
            this surface (the Lens intelligence form, scenario studio,
            compare tray, or admin) is built for ≥1024px screens. Rendering
            it half-resolution on mobile would mislead an underwriting call.
          </p>

          <p className="text-[14px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Send yourself the link and open it on desktop, or continue to a
            limited mobile view of the rest of the site.
          </p>

          <div className="rounded-md px-4 py-3 mb-5" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)' }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] mb-1.5" style={{ color: '#5EEAD4' }}>
              · What works on phones today
            </p>
            <ul className="text-[12px] leading-relaxed space-y-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
              <li>Library (cards view, stage edits, alerts)</li>
              <li>Profile · Glossary · Privacy &amp; Terms</li>
              <li>Dashboard 50-state map (small but functional)</li>
            </ul>
          </div>

          <a
            href={mailtoHref}
            className="block w-full font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-3 rounded-sm text-center transition-all mb-2"
            style={{ background: '#14B8A6', color: '#0F1A2E', minHeight: 44, lineHeight: '20px' }}
          >
            Email myself this link
          </a>

          <button
            onClick={handleDismiss}
            className="w-full font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-3 rounded-sm transition-all"
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)', minHeight: 44 }}
          >
            Continue to mobile site (limited)
          </button>

          <p className="text-[10px] text-center mt-3" style={{ color: 'rgba(255,255,255,0.40)' }}>
            tractova.com — community solar &amp; renewable energy intelligence
          </p>
        </div>
      </div>
    </div>
  )
}
