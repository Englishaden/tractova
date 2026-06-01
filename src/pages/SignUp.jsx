import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignUp() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  // 18+ + Terms/Privacy acknowledgment. Required to submit. Statement-only
  // language was already in Terms § 02; this checkbox makes the agreement
  // an affirmative click rather than an implied acceptance, which is the
  // SaaS norm and helps the IP-violation / trade-secret enforcement
  // language in Terms § 04 hold up.
  const [agreed,   setAgreed]   = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.')
      return
    }
    if (!agreed) {
      setError('Please confirm you are at least 18 years old and have read the Terms and Privacy Policy.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(humanizeError(error.message))
      setLoading(false)
      return
    }

    if (data.session) {
      navigate('/')
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return <CheckYourEmailScreen email={email} />
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start building smarter."
      subtitle="Free dashboard access. No credit card. The full five-pillar Lens unlocks on Pro — try free for 14 days."
    >
      <h1 className="lp-h4 mb-1" style={{ color: '#0F1A2E' }}>Create your account</h1>
      <p className="text-xs text-gray-500 mb-6">Dashboard access is free, no credit card required.</p>

      {error && (
        <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <input
            type="text" required autoComplete="name" autoFocus
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Email address">
          <input
            type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Password">
          <input
            type="password" required autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 10 characters"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Confirm password">
          <input
            type="password" required autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className={INPUT_CLASS}
          />
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox" required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 shrink-0 w-4 h-4 rounded-sm border-gray-300 text-teal-600 focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
          />
          <span className="text-[11px] text-gray-600 leading-relaxed">
            I am at least 18 years old and have read the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:no-underline" style={{ color: '#0F766E' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:no-underline" style={{ color: '#0F766E' }}>Privacy Policy</Link>.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !agreed}
          className="w-full text-white text-sm font-semibold py-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: '#14B8A6', boxShadow: '0 8px 24px rgba(20,184,166,0.18)' }}
          onMouseEnter={(e) => { if (!loading && agreed) e.currentTarget.style.background = '#0F766E' }}
          onMouseLeave={(e) => { if (!loading && agreed) e.currentTarget.style.background = '#14B8A6' }}
        >
          {loading ? 'Creating account…' : 'Get started free'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-500 mt-6">
        Already have an account?{' '}
        <Link to="/signin" className="font-medium hover:underline" style={{ color: '#0F766E' }}>
          Sign in →
        </Link>
      </p>
    </AuthShell>
  )
}

// ── Post-signup confirmation with rate-limited Resend (preserved logic) ──────
function CheckYourEmailScreen({ email }) {
  const [resendState, setResendState] = useState('idle')
  const [cooldown, setCooldown] = useState(0)
  const [resendError, setResendError] = useState(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || resendState === 'sending') return
    setResendState('sending')
    setResendError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      setResendError(humanizeError(error.message))
      setResendState('error')
      return
    }
    setResendState('sent')
    setCooldown(60)
  }

  return (
    <AuthShell
      eyebrow="Almost there"
      title="Check your email."
      subtitle="We sent a confirmation link to your inbox. Click it to activate your account — you'll land on the dashboard."
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(20,184,166,0.10)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h2 className="lp-h4 mb-2" style={{ color: '#0F1A2E' }}>Check your email</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          We sent a confirmation link to{' '}
          <span className="font-medium text-gray-700">{email}</span>.
          Click the link to activate your account.
        </p>

        {resendState === 'sent' && (
          <div className="mt-5 px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.30)', color: '#0F766E' }}>
            New confirmation email sent. Check your inbox + spam folder.
          </div>
        )}
        {resendState === 'error' && resendError && (
          <div className="mt-5 px-3 py-2 rounded-md text-xs bg-red-50 border border-red-200 text-red-600">
            {resendError}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendState === 'sending'}
            className="font-medium hover:underline disabled:no-underline disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: '#0F766E' }}
          >
            {resendState === 'sending' ? 'Sending…'
              : cooldown > 0   ? `Resend in ${cooldown}s`
              : 'Resend the email'}
          </button>
        </p>

        <Link
          to="/signin"
          className="inline-block mt-4 text-sm font-medium hover:underline"
          style={{ color: '#0F766E' }}
        >
          ← Back to Sign In
        </Link>
      </div>
    </AuthShell>
  )
}

// ── Shared two-column auth shell (dark left / form right) ────────────────────
// Exported so SignIn / future password reset surfaces can use the identical
// frame — same brand promise, same visual language, no drift between flows.
export function AuthShell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] pt-14">

      {/* Dark left panel — brand + value prop. Mobile: collapses to a thin
          banner above the form. */}
      <aside className="relative overflow-hidden text-white p-8 lg:p-16 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #050A1A 100%)' }}>
        <div className="lp-accent-rail" />

        <div className="flex items-center gap-3">
          <TractovaMark />
          <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.025em' }}>Tractova</span>
        </div>

        <div className="hidden lg:block">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1 h-1 rounded-full" style={{ background: '#5EEAD4' }} />
            <span className="eyebrow-mono" style={{ color: '#5EEAD4' }}>{eyebrow}</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#5EEAD4' }} />
          </div>
          <h2 className="lp-h2 mb-5 text-white">{title}</h2>
          <p className="text-base text-white/65 leading-relaxed max-w-md">{subtitle}</p>

          <ul className="mt-10 space-y-3 max-w-md">
            {[
              'Live federal + state data, refreshed weekly',
              'Five-pillar signal model — every score traceable',
              '14-day Pro trial, cancel anytime',
            ].map(t => (
              <li key={t} className="flex items-center gap-3 text-sm text-white/70">
                <span style={{ color: '#5EEAD4' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <Link to="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex items-center justify-center px-6 lg:px-12 py-10 lg:py-16" style={{ background: '#FAFAF7' }}>
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 lg:p-10 shadow-sm">
            {children}
          </div>
          <p className="lg:hidden text-center text-xs text-gray-400 mt-5">
            <Link to="/" className="hover:text-gray-600 transition-colors">← Back to dashboard</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5 tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLASS = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-colors"

function humanizeError(msg) {
  if (!msg) return 'Something went wrong. Try again.'
  // A2: enumeration-resistant — don't confirm whether an email is registered.
  // (Authoritative fix is Supabase "Confirm email" obfuscation; see CLAUDE.md.)
  if (msg.toLowerCase().includes('already registered')) return 'We couldn’t create the account. If you already have one, sign in or reset your password.'
  if (msg.toLowerCase().includes('password')) return 'Password must be at least 10 characters.'
  return msg
}

function TractovaMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="26" height="26" rx="5" fill="#0F1A2E" stroke="rgba(255,255,255,0.1)" />
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
      <rect x="6" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
      <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
    </svg>
  )
}
