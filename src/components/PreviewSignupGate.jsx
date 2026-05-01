import { Link } from 'react-router-dom'

// V3-extension — preview-mode signup gate.
//
// Soft-sell card shown on /preview surfaces in place of (or alongside)
// content that's reserved for authed users. Pattern across all surfaces:
// teal-tinted bg with V3 brand chrome, mono '◆ Pro Preview' eyebrow,
// directive message, single 'Create free account' CTA pointing at /signup.
//
// This is the lightest funnel-friction we can add: signup is FREE, so
// the gate is "click here to be a user," not "click here to pay $9.99".
// Friction lands exactly when visitor intent is highest (they're trying
// to dig into a specific state, KPI breakdown, or news article).
//
// Compact prop reduces vertical padding for use inside small containers
// (e.g. MetricsBar modal previews).
export default function PreviewSignupGate({ message, compact = false }) {
  return (
    <div
      className={`rounded-lg ${compact ? 'px-3 py-3' : 'px-4 py-4 mt-3'}`}
      style={{ background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.22)' }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-semibold mb-1.5" style={{ color: '#0F766E' }}>
        ◆ Sign up to view
      </p>
      <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} text-ink leading-relaxed mb-3`}>
        {message}
      </p>
      <Link
        to="/signup"
        className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-3 py-2 rounded-md text-white transition-transform hover:-translate-y-px"
        style={{ background: '#14B8A6', boxShadow: '0 4px 12px rgba(20,184,166,0.22)' }}
      >
        Create free account
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </Link>
      <p className="text-[10px] text-ink-muted mt-2">
        No credit card required to sign up · Pro $29.99/mo with 14-day free trial.
      </p>
    </div>
  )
}
