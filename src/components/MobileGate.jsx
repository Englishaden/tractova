import { useState, useEffect } from 'react'

// Mobile-not-yet gate.
//
// Tractova is a desktop-first product right now — the Lens analysis,
// scenario studio, library cards, and dashboard map were all designed
// for ≥768px viewports and degrade poorly on phones. Rather than ship
// a half-rendered experience to mobile users, surface the truth: the
// native iOS/Android app is the long-term plan; for now, please use
// desktop. A small dismiss link lets power users (and Aden) continue
// to the web anyway when they need to.
//
// Threshold: <768px (Tailwind's `md` breakpoint). The gate listens to
// resize so a window-shrunk desktop doesn't trip it persistently —
// but on real phones the dismiss flag also persists per session so
// the user only sees the message once if they choose to continue.
const SESSION_DISMISS_KEY = 'tractova_mobile_gate_dismissed'

export default function MobileGate({ children }) {
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

  if (!isMobile || dismissed) return children

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
              Tractova · Desktop-First
            </p>
          </div>

          <h1 className="font-serif text-[24px] leading-tight font-semibold text-white mb-3">
            Mobile is on the roadmap, not in production.
          </h1>

          <p className="text-[14px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Tractova was built for ≥1024px screens — the Lens analysis,
            scenario studio, dashboard map, and library all assume desktop
            real estate. Phone layouts work but render at ~30% of
            intended fidelity right now.
          </p>

          <p className="text-[14px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.78)' }}>
            The iOS + Android app is in the queue. Until it ships, please
            use a desktop or tablet for any decision-grade work — don't
            rely on mobile output for underwriting or stage gates.
          </p>

          <div className="rounded-md px-4 py-3 mb-5" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)' }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] mb-1.5" style={{ color: '#5EEAD4' }}>
              ◆ What works on desktop
            </p>
            <ul className="text-[12px] leading-relaxed space-y-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
              <li>Full Lens analysis (CS · C&I · BESS · Hybrid)</li>
              <li>50-state map · scenario studio · scenario library</li>
              <li>Saved projects · alerts · weekly digest</li>
            </ul>
          </div>

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
